-- Manage create/drop data about all other objects in the database
-- Copyright WyattERP.org; See license in root of this package
-- ----------------------------------------------------------------------------
-- TODO:
-- - Default wm priv should be restricted.  Can public still use data-dictionary functions?
-- - 
create schema if not exists wm; grant usage on schema wm to public;

-- Catalog of releases for objects to join to
-- The largest release number is a work in process,  earlier ones are committed
-- ----------------------------------------------------------------------------
create table if not exists wm.releases (
    release	int		primary key default 1 check (release > 0)
  , committed	timestamptz(3)
  , sver_2	int		-- Dummy column: bootstrap schema version
);
insert into wm.releases (release) values (1) on conflict do nothing;

-- The current work-in-progress release; becomes the next committed release
-- ----------------------------------------------------------------------------
create or replace function wm.next() returns int security definer stable language sql as $$
  select coalesce(max(release), 1) from wm.releases;
$$; revoke all on function wm.next from public;

-- Contains an entry for each database object we are creating
-- ----------------------------------------------------------------------------
create table if not exists wm.objects (
    obj_typ	text		not null		-- table, view, function, etc.
  , obj_nam	text		not null		-- schema.name
  , obj_ver	int		not null default 0	-- incremented when the object changes from the last committed release
  , checkit	boolean		default true		-- check dependencies
  , build	boolean		default true		-- modified, needs rebuild
  , built	boolean		default false		-- instantiated in current database
  , module	text		not null		-- name of the schema group this object belongs to
  , deps	text[]		not null		-- List of dependencies, as user entered them
  , ndeps	text[]					-- List of normalized dependencies
  , grants	text[]		not null default '{}'	-- List of grants
  , col_data	text[]		not null default '{}'	-- Extra data about columns, for views
  , delta	text[]		not null default '{}'	-- array of migration commands
  , del_idx	int		not null default 0	-- pointer to next unapplied delta
  , crt_sql	text		not null		-- SQL to create the object
  , drp_sql	text		not null		-- SQL to drop the object
  , min_rel	int		default wm.next() references wm.releases check (min_rel <= max_rel) -- smallest release this object belongs to
  , max_rel	int		default wm.next() references wm.releases	-- largest release this object belongs to
  , crt_date	timestamp(0)	default current_timestamp	-- When record created
  , mod_date	timestamp(0)	default current_timestamp	-- When record last modified
  , primary key (obj_typ, obj_nam, obj_ver)
);

-- Check that release ranges are consistent with release/next
-- ----------------------------------------------------------------------------
create or replace function wm.releases_tf() returns trigger language plpgsql as $$
  begin
    if TG_OP = 'DELETE' then	-- Can only delete the latest
      return case when old.release < wm.next() then null else old end;
    elsif TG_OP = 'UPDATE' then	-- Can only update the date
      return case when new.release != old.release then null else new end;
    end if;
  end;
$$;
drop trigger if exists releases_tr on wm.releases;
create trigger releases_tr before update or delete on wm.releases for each row execute procedure wm.releases_tf();

-- Before deleting an object
-- ----------------------------------------------------------------------------
create or replace function wm.objects_tf_bd() returns trigger language plpgsql as $$
  declare
    retval record = old;
  begin
    if old.obj_ver <= 0 then			-- Draft entry
      return old;
    elsif old.max_rel < wm.next() then		-- Historical object
      raise 'Object %:% part of an earlier committed release', old.obj_typ, old.obj_nam;
    end if;
    if old.max_rel > old.min_rel then		-- Object belongs to more than one release
      update wm.objects set max_rel = max_rel - 1 where obj_typ = old.obj_typ and obj_nam = old.obj_nam and obj_ver = old.obj_ver;
      retval = null;
    end if;
    if old.built then				-- Delete the instantiated object and its dependencies
      perform wm.make(array[old.obj_typ || ':' || old.obj_nam], true, false);
    end if;
    return retval;
  end;
$$;
drop trigger if exists objects_tr_bd on wm.objects;
create trigger objects_tr_bd before delete on wm.objects for each row execute procedure wm.objects_tf_bd();

-- Standard view of dependencies with level and path information
-- ----------------------------------------------------------------------------
create or replace view wm.objects_v_dep as
  with recursive search_deps(object, obj_typ, obj_nam, depend, release, depth, path, cycle) as (
      select (o.obj_typ || ':' || o.obj_nam)::text as object, o.obj_typ, o.obj_nam, null::text, r.release,0, '{}'::text[], false
 	from	wm.objects	o
 	join	wm.releases	r on r.release between o.min_rel and o.max_rel
  	where o.ndeps = '{}'            		-- level 1 dependencies
    union
      select (o.obj_typ || ':' || o.obj_nam)::text as object, o.obj_typ, o.obj_nam, d, r.release,depth + 1, path || d, d = any(path)
 	from	wm.objects	o
 	join	wm.releases	r	on r.release between o.min_rel and o.max_rel
 	join	unnest(o.ndeps)	d	on true
        join    search_deps     dr	on dr.object = d and dr.release = r.release	-- iterate through dependencies
        where			not cycle
  ) select object,obj_typ as od_typ, obj_nam as od_nam, depend, release as od_release, depth, path, cycle, path || object as fpath from search_deps;

-- View of objects and each release they belong to
-- ----------------------------------------------------------------------------
create or replace view wm.objects_v as
       select o.obj_typ || ':' || o.obj_nam as object, o.*, r.release
  from		wm.objects	o
  join		wm.releases	r	on r.release between o.min_rel and o.max_rel;
  
-- View of objects with the working release number
-- ----------------------------------------------------------------------------
create or replace view wm.objects_v_next as
    select * from wm.objects_v where release = wm.next();
  
-- Updatable view of objects with the largest version number
-- ----------------------------------------------------------------------------
create or replace view wm.objects_v_max as
    select o.*
    from	wm.objects	o
    where	o.obj_ver = (select max(s.obj_ver) from wm.objects s where s.obj_typ = o.obj_typ and s.obj_nam = o.obj_nam);
  
-- View of objects including their maximum depth
-- ----------------------------------------------------------------------------
create or replace view wm.objects_v_depth as
  select o.*, od.depth
  from		wm.objects_v	o
  join		(select od_typ, od_nam, od_release, max(depth) as depth from wm.objects_v_dep group by 1,2,3) od on od.od_typ = o.obj_typ and od.od_nam = o.obj_nam and od.od_release = o.release
  order by	depth;

-- The latest committed release, if there is one
-- ----------------------------------------------------------------------------
create or replace function wm.last() returns int security definer stable language sql as $$
  select max(release) from wm.releases where not committed isnull;
$$; revoke all on function wm.last from public;

-- Create a permission group (role) if it doesn't already exist (common to development and distribution modes)
-- ----------------------------------------------------------------------------
create or replace function wm.create_role(grp text, subs text[] default '{}') returns boolean language plpgsql as $$
  declare
    retval	boolean default false;
    sub		text;
  begin
    if not exists (select rolname from pg_roles where rolname = grp) then
      execute 'create role ' || grp;
      retval = true;
    end if;
    foreach sub in array subs loop
      execute 'grant ' || sub || ' to ' || grp;
    end loop;
    return retval;
  end;
$$; revoke all on function wm.create_role from public;

-- Untrusted language, and function to use it to create a working folder for backup/restore
-- ----------------------------------------------------------------------------
create or replace language pltclu;
create or replace function wm.workdir(uniq text default '') returns text stable language pltclu as $$
  set path {/var/tmp/wyseman}
  if {$1 != {}} {set path "$path/$1"}
  if {![file exists $path]} {file mkdir $path}
  return $path
$$; revoke all on function wm.workdir from public;

-- Store a grant in a draft record in the object table
-- ----------------------------------------------------------------------------
create or replace function wm.grant(
    otyp	text		-- Object type we're granting permissions to
  , onam	text		-- Object name we're granting permissions to
  , priv	text		-- A privilege name, defined for the application
  , level	int		-- Application defined level 1,2,3 etc
  , allow	text		-- select, insert, update, delete, etc
) returns boolean language plpgsql as $$
  declare
    pstr	text default array_to_string(array[otyp||':'||onam,priv,level::text,allow], ',');
    grlist	text[];
    blt		boolean;	-- from object record
  begin
    select grants, built into grlist, blt from wm.objects where obj_typ = otyp and obj_nam = onam and obj_ver = 0;
--raise notice 'Grant: % % % %', onam, grlist, priv, pstr;
    if not FOUND then
      raise 'Can not find defined object:%:% to associate permissions with', otyp, onam;
    end if;
    if pstr = any(grlist) then
      if not blt then raise notice 'Grant: % multiply defined on object:%:%', pstr, otyp, onam; end if;
      return false;
    else
      update wm.objects set built = false, grants = grlist || pstr where obj_typ = otyp and obj_nam = onam and obj_ver = 0;
--select grants into grlist from wm.objects where obj_typ = otyp and obj_nam = onam and obj_ver = 0;
--raise notice 'Update: % % %', onam, pstr, grlist;
    end if;
    return true;
  end;
$$; revoke all on function wm.grant from public;

-- Return JSON history object
-- ----------------------------------------------------------------------------
create or replace function wm.hist(rel int = null) returns json language plpgsql as $$
  begin
    if rel isnull then
      rel = wm.next();
      if rel = wm.last() then	-- Make sure there is s development release
        rel = rel + 1;
        insert into wm.releases (release) values (rel);
        update wm.objects set max_rel = rel where max_rel = rel-1;
      end if;
    end if;
    return to_json(s) from (
      select rel as release, null as module,
      (select json_agg(coalesce(to_json(r.committed::text), '0'::json)) as releases
        from (select * from wm.releases where release <= rel order by 1) r),
      (select to_json(coalesce(array_agg(o), '{}')) as prev from
        (select obj_typ,obj_nam,obj_ver,module,min_rel,max_rel,deps,grants,col_data,delta,crt_sql,drp_sql
          from wm.objects_v where max_rel < rel order by 1,2) o)
    ) as s;
  end;
$$; revoke all on function wm.hist from public;

-- Check any draft (obj_ver=0) entries, to be merged or promoted
-- ----------------------------------------------------------------------------
create or replace function wm.check_drafts(orph boolean default false) returns boolean language plpgsql as $$
  declare
    drec	record;		-- draft object record
    prec	record;		-- previous latest record
    changes	boolean default false;
  begin
    if orph then -- Find any orphaned objects (only works if there is at least one valid object remaining in each module)
      for drec in select o.*
        from wm.objects o
        join (select distinct module from wm.objects where obj_ver = 0) as od on od.module = o.module
        where wm.next() between o.min_rel and o.max_rel
        and o.module != ''
        and not exists (select obj_nam from wm.objects where obj_typ = o.obj_typ and obj_nam = o.obj_nam and obj_ver = 0)
      loop
raise notice 'Orphan: %:%:%', drec.obj_typ, drec.obj_nam, drec.obj_ver;
        delete from wm.objects where obj_typ = drec.obj_typ and obj_nam = drec.obj_nam and obj_ver = drec.obj_ver;
      end loop;
    end if;

    for drec in select * from wm.objects where obj_ver = 0 loop		-- For each newly parsed record
      select * into prec from wm.objects_v_max where obj_typ = drec.obj_typ and obj_nam = drec.obj_nam and obj_ver > 0;	-- Get the latest non-draft record
      if not found then
raise notice 'Adding: %:%', drec.obj_typ, drec.obj_nam;
        update wm.objects set obj_ver = coalesce((select obj_ver from wm.objects_v_max where obj_typ = drec.obj_typ and obj_nam = drec.obj_nam), 0) + 1,
          checkit = true, build = true, mod_date = current_timestamp where obj_typ = drec.obj_typ and obj_nam = drec.obj_nam and obj_ver = 0;
        continue;
      end if;

      if (drec.crt_sql  is distinct from prec.crt_sql)	or	-- Has anything important changed?
         (drec.drp_sql  is distinct from prec.drp_sql)	or
         (drec.deps     is distinct from prec.deps)	or
         (drec.col_data is distinct from prec.col_data)	or
         (drec.grants   is distinct from prec.grants)	or
         (drec.module   is distinct from prec.module)	then
       
        if prec.min_rel >= wm.next() then		-- if prior record starts with the current working release, then update it with our new changes
raise notice 'Modify: %:%', drec.obj_typ, drec.obj_nam;
          update wm.objects set checkit = true, build = true, module = drec.module, deps = drec.deps, grants = drec.grants, col_data = drec.col_data, crt_sql = drec.crt_sql, drp_sql = drec.drp_sql, mod_date = current_timestamp where obj_typ = prec.obj_typ and obj_nam = prec.obj_nam and obj_ver = prec.obj_ver;
          delete from wm.objects where obj_typ = drec.obj_typ and obj_nam = drec.obj_nam and obj_ver = 0;
        else						-- else, prior record belongs to earlier, committed releases, so create a new, modified record
raise notice 'Increm: %:%', drec.obj_typ, drec.obj_nam;
          update wm.objects set max_rel = wm.next()-1, checkit = false, build = false, built = false where obj_typ = prec.obj_typ and obj_nam = prec.obj_nam and obj_ver = prec.obj_ver;
          update wm.objects set obj_ver = prec.obj_ver + 1, checkit = true, build = true, built = prec.built, mod_date = current_timestamp where obj_typ = drec.obj_typ and obj_nam = drec.obj_nam and obj_ver = drec.obj_ver;
        end if;
      else						-- No changes from prior record, so delete the draft record
-- raise notice 'Ignore: %:%', drec.obj_typ, drec.obj_nam;
        delete from wm.objects where obj_typ = drec.obj_typ and obj_nam = drec.obj_nam and obj_ver = 0;
      end if;
    end loop;
    return true;
  end;
$$; revoke all on function wm.check_drafts from public;
    
-- Normalize dependencies on yet unchecked objects
-- ----------------------------------------------------------------------------
create or replace function wm.check_deps() returns boolean language plpgsql as $$
  declare
    orec	record;		-- Outer loop record
    trec	record;		-- Dependency record
    d		text;		-- Iterator
    darr	text[];		-- Accumulates cleaned up array
  begin
    for orec in select * from wm.objects_v where release = wm.next() and checkit loop
-- raise notice 'Checking object:% rel:% deps:%', orec.object, orec.release, orec.deps;
      darr = '{}';
      foreach d in array orec.deps loop
-- raise notice '            dep:%:', d;
          select * into trec from wm.objects_v where object = d and release = orec.release;	-- Is this a full object name?
          if not FOUND then
            begin
              select * into strict trec from wm.objects_v where obj_nam = d and release = orec.release;	-- Do we only have the name, with no type?
            exception
              when NO_DATA_FOUND then
                raise exception 'Dependency:% r%, by object:%, not found', d, orec.release, orec.object;
              when TOO_MANY_ROWS then
                raise exception 'Dependency:% r%, by object:%, not unique', d, orec.release, orec.object;
            end;
            d = trec.object;				-- Use fully qualified object name
          end if;
-- raise notice '         insert:%:%', orec.object, d;
          darr = darr || d;
      end loop;
      update wm.objects set ndeps = darr, checkit = false where obj_typ = orec.obj_typ and obj_nam = orec.obj_nam and obj_ver = orec.obj_ver;		-- Write out cleaned up array
    end loop;
    return true;
  end;
$$; revoke all on function wm.check_deps from public;

-- Attempt to replace a view or function
-- ----------------------------------------------------------------------------
create or replace function wm.replace(obj text) 
  returns boolean language plpgsql as $$
  declare
    trec	record;
  begin

    select * into strict trec from wm.objects_v where object = obj and release = wm.next();
    execute regexp_replace(trec.crt_sql,'create ','create or replace ','ig');
raise notice 'Replace:% :%:', trec.depth, trec.object;
    update wm.objects set built = true where obj_typ = trec.obj_typ and obj_nam = trec.obj_nam and obj_ver = trec.obj_ver;
    return true;
  end;
$$; revoke all on function wm.replace from public;

-- Drop/create a group of database objects
-- ----------------------------------------------------------------------------
create or replace function wm.make(
    objs text[]			-- array of objects to act on
  , drp boolean default true	-- drop objects in the specified branch
  , crt boolean default true	-- create objects in the specified branch
) returns int language plpgsql as $$
  declare
    s		text;			-- temporary string
    trec	record;			-- temp record
    irec	record;			-- info record
    objlist	text[] default '{}';	-- expanded list of objects we will work on
    collist	text;			-- list of columns to save/restore in table
    cnt		int;			-- how many records saved/restored
    garr	text[];			-- grant array
    glev	text;			-- grant group_level
    otype	text;			-- object type, coerced to table for views
    counter	int default 0;		-- how many objects we build
    sess_id	text default (select to_hex(trunc(extract (epoch from backend_start))::integer)||'.'||to_hex(pid) from pg_stat_activity where pid = pg_backend_pid());
  begin
    if objs is null then		-- Defaults to drop/create of all objects needing build
      select into objs coalesce(array_agg(object), '{}'::text[]) from wm.objects_v where release = wm.next() and build;
    end if;
--raise notice 'Pre-search:%', objs;

    select into objlist array_agg(distinct object) from wm.objects_v_dep o	-- Include dependencies
      join (select unnest(objs) as obj) as d on d.obj = any(o.fpath);
--raise notice 'objlist:%', objlist;
    create temporary table _table_info (obj_nam text primary key, columns text, fname text, rows int);

    if drp then			-- Drop specified objects
      for trec in select * from wm.objects_v_depth where object = any(objlist) and built order by depth desc loop
raise notice 'Drop:% :%:%', trec.depth, trec.object, trec.obj_ver;

        if trec.obj_typ = 'table' then
          begin
            execute 'select count(*) from ' || trec.obj_nam || ';' into strict cnt;
            exception when undefined_table then
              raise notice 'Skipping non-existant: %:%', trec.obj_typ, trec.obj_nam;
              continue;
          end;
          if crt then perform wm.migrate(trec); end if;		-- Need to modify table?
        end if;
        if trec.obj_typ = 'table' and cnt > 0 then		-- Attempt to preserve existing table data
          collist = array_to_string(array(select column_name::text from information_schema.columns where table_schema || '.' || table_name = trec.obj_nam order by ordinal_position),',');
--raise notice 'collist:%', collist;
          s = wm.workdir(sess_id) || '/' || trec.obj_nam || '.dump';
          execute 'copy ' || trec.obj_nam || '(' || collist || ') to ''' || s || '''';
          get diagnostics cnt = ROW_COUNT;
--raise notice 'Count:%', cnt;
          insert into _table_info (obj_nam,columns,fname,rows) values (trec.obj_nam, collist, s, cnt);
        end if;

        execute trec.drp_sql;
      end loop;
    end if;

    if crt then			-- Create specified objects
      for trec in select * from wm.objects_v_depth where object = any(objlist) and release = wm.next() order by depth loop
raise notice 'Create:% :%:%', trec.depth, trec.object, trec.obj_ver;
        execute trec.crt_sql;
        
        if trec.obj_typ = 'table' then		-- Attempt to restore data into the table
          select * into irec from _table_info i where i.obj_nam = trec.obj_nam;
          if FOUND then
            execute 'copy ' || trec.obj_nam || '(' || irec.columns || ') from ''' || irec.fname || '''';
            execute 'select count(*) from ' || trec.obj_nam || ';' into strict cnt;
            if cnt != irec.rows then
              raise exception 'Restored % records to table % when % had been saved', cnt, trec.obj_nam, irec.rows;
            end if;
          end if;
        end if;
        
        foreach s in array trec.grants loop	-- for each specified object, expand to dependent objects
-- raise notice 'Grant:% :%', trec.object, s;
          garr = string_to_array(s,',');
          glev = garr[2] || '_' || garr[3];
          if garr[2] = 'public' then
            glev = garr[2];
          else
            perform wm.create_role(glev);
          end if;
          otype = trec.obj_typ; if otype = 'view' then otype = 'table'; end if;
          execute 'grant ' || garr[4] || ' on ' || otype || ' ' || trec.obj_nam || ' to ' || glev || ';'; 
        end loop;
        update wm.objects set built = true, build = false, checkit = false, del_idx = coalesce(array_length(delta, 1),0)
          where obj_typ = trec.obj_typ and obj_nam = trec.obj_nam and obj_ver = trec.obj_ver;
        counter = counter + 1;
      end loop;
    end if;

    drop table _table_info;
    return counter;
  end;
$$; revoke all on function wm.make from public;

-- Process group of object migration commands
-- ----------------------------------------------------------------------------
create or replace function wm.migrate(orec record, max_ver int = null)
  returns boolean language plpgsql as $$
  declare
    del_idx	int = orec.del_idx;
    cmd		text;
    sql		text;
    trec	record;
    i		int default 0;
  begin
--raise notice 'Migrate: %:%', orec.obj_nam, orec.obj_ver;
    foreach cmd in array orec.delta loop		-- for each migration command
      if i >= del_idx then				-- not already processed
        if cmd ~* '^(drop|rename|add)\s' then
          sql = 'alter table ' || orec.obj_nam || ' ' || cmd || ';';
        elsif cmd ~* '^update\s' then
          sql = 'update ' || orec.obj_nam || ' set ' || cmd ';';
        else continue;
        end if;
raise notice '  Delta: %:%: %', orec.obj_nam, orec.obj_ver, cmd;
--raise notice '  SQL: %', sql;
        execute sql;
      end if;
      i = i + 1;
    end loop;

    if max_ver isnull then				-- at top recursion level
      max_ver = (select obj_ver from wm.objects_v_max where obj_typ = orec.obj_typ and obj_nam = orec.obj_nam);
      for trec in select * from wm.objects where obj_ver > orec.obj_ver and obj_ver <= max_ver order by obj_ver loop
        perform wm.migrate(trec, max_ver);		-- migrate any later versions
      end loop;
    end if;
    if orec.obj_ver < max_ver then			-- only the newly made version will do this in make
      update wm.objects set del_idx = i, built = false where obj_typ = orec.obj_typ and obj_nam = orec.obj_nam and obj_ver = orec.obj_ver;
    end if;
    return true;
  end;
$$; revoke all on function wm.migrate from public;
