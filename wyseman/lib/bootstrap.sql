-- Bootstrap the schema with table containing create/drop data about all other objects
-- TODO:
-- X- How to prune the dependencies for objects that can be replaced (functions/views)
-- X- Make routine:
-- X-  optional drop and/or create
-- X-  drop in reverse depth order
-- X-  create in depth order
-- X-  optional, but default, preserve data in tables
-- X- Is there a way to dump tables (like pg_dump) direct from database
-- X- Implement release table
-- X- Move dependencies to a view/virtual table
-- X- Keep grants in object table with create sql
-- - 
-- - What if I silently drop an item from my wms file? (delete it)
-- - When deleting an item from objects, delete the actual object too
-- - Items must track which module,release they are a part of
-- - Can't change items part of a prior release
-- - If table columns have changed, apply alter script before drop/create of table
-- - Function to output sql for a module, release
-- - 

create schema wm;

-- Track official module releases
-- Whatever is max(release) is the current, working copy
-- max(release) - 1 is the last-frozen release, not to be messed with
-- ----------------------------------------------------------------------------
create table wm.releases (
    module	varchar		not null		-- The name of the group of schema objects
  , release	int		default 0 check(release <= 0)
  , primary key (module, release)
);

-- Latest (working) release number
-- ----------------------------------------------------------------------------
create function wm.release(varchar) returns int language sql as $$
  select coalesce(max(release),0) from wm.releases where module = $1
$$;

-- Contains an entry for each database object we are creating
-- ----------------------------------------------------------------------------
create table wm.objects (
    object	varchar		primary key		-- table:schema.name or  function:schema.name(type1,type2,...)
  , obj_type	varchar		not null		-- table, view, trigger, etc.
  , obj_name	varchar		not null		-- schema.name
  , version	int		not null default 0	-- User should increment this each time it is changed, as part of a release
  , deps	varchar[]	not null		-- List of dependencies
  , imp_date	timestamp(0)	default current_timestamp	-- When create last changed/imported
  , clean	boolean		default false		-- actual schema up-to-date with this create script
  , source	varchar		not null		-- name of the source file this object defined in
  , module	varchar		not null		-- name of the schema module this object belongs to
  , min_rel	int		not null		-- smallest release this object belongs to
  , max_rel	int		not null		-- largest release this object belongs to
  , crt_sql	varchar		not null		-- SQL to create the object
  , drp_sql	varchar		not null		-- SQL to drop the object
  , grants	varchar[]	not null default '{}'	-- List of grants
);

-- Tracks dependencies of individual database objects
-- ----------------------------------------------------------------------------
create table wm.depends (
    obj_ref	varchar 				-- An object
    		references wm.objects on update cascade on delete cascade
  , dep_ref	varchar					-- And another object that must exist before the first object
    		references wm.objects on update cascade on delete cascade
  , primary key (obj_ref, dep_ref)
);

-- Permissions granted to various objects
-- ----------------------------------------------------------------------------
-- create table wm.grants (
--     object	varchar		not null		-- An object
--     		references wm.objects on update cascade on delete cascade
--   , priv	varchar		not null		-- Application-defined privilege
--   , level	int		default 1 check(level > 0)	-- Application-defined permission level
--   , allow	varchar check(lower(allow) in ('select','insert','update','delete','usage','truncate','references','trigger','connect','temporary'))
--   , unique (object, priv, level, allow)
-- );

-- Before inserting an object
-- ----------------------------------------------------------------------------
create function wm.objects_tf_bi() returns trigger language plpgsql security definer as $$
  declare
    trec	record;
  begin
    if new.object is null then
      new.object = new.obj_type || ':' || new.obj_name;	-- Generate primary key from type, name
    end if;

    select * into trec from wm.objects o where o.obj_type = new.obj_type and o.obj_name = new.obj_name;
    if not FOUND then			-- If not already a record for this object
      new.min_rel = wm.release(new.module);
      new.max_rel = wm.release(new.module);
      return new;			-- Just insert it
    end if;
    
-- Fixme: move version number up when needed and do insert

    if (new.crt_sql is distinct from trec.crt_sql)	or
       (new.drp_sql is distinct from trec.drp_sql)	or
       (new.deps    is distinct from trec.deps)		then
         new.clean = false;
         new.grants = '{}';				-- Have to re-scan grants
         update wm.objects set deps = new.deps, imp_date = current_timestamp, clean = false, source = new.source, module = new.module, max_rel = wm.release(new.module), crt_sql = new.crt_sql, drp_sql = new.drp_sql;
    end if;
    return null;
  end;
$$;
create trigger tr_bi before insert on wm.objects for each row execute procedure wm.objects_tf_bi();
    
-- Standard view of dependencies with level and path information
-- ----------------------------------------------------------------------------
create or replace view wm.depends_v as
  with recursive search_deps(object,depend,depth,path,cycle) as (
      select o.object, null::varchar, 0, '{}'::varchar[], false
 	from	wm.objects	o
  	where o.deps = '{}'            		-- level 1 dependencies
    union
      select o.object, d, depth + 1, path || d, d = any(path)
 	from	wm.objects	o
 	join	unnest(o.deps)	d	on true
        join    search_deps     dr	on d = dr.object	-- iterate through dependencies
        where			not cycle
  ) select *, path || object as fpath from search_deps;

-- View of objects with all their max dependency levels
-- ----------------------------------------------------------------------------
create view wm.objects_v as
  select o.*, od.depth
  from		wm.objects o
  join		(select object, max(depth) as depth from wm.depends_v group by 1) od on od.object = o.object
  order by	depth;

-- Expand dependencies, populate link table
-- ----------------------------------------------------------------------------
create function wm.check_deps() returns boolean language plpgsql as $$
  declare
    orec	record;		-- Outer loop record
    trec	record;		-- Dependency record
    d		varchar;	-- Iterator
    darr	varchar[];	-- Accumulates cleaned up array
  begin
    for orec in select * from wm.objects where not clean loop
-- raise notice 'Checking object:% deps:%', orec.object, orec.deps;
        darr = '{}';
      foreach d in array orec.deps loop
-- raise notice '            dep:%', d;
          select * into trec from wm.objects where object = d;	-- Is this a full object name?
          if not FOUND then
            begin
              select * into strict trec from wm.objects where obj_name = d;	-- Is it just the name, with no type
              EXCEPTION
                when NO_DATA_FOUND then
                  raise exception 'Dependency:%, by object:%, not found', d, orec.object;
                when TOO_MANY_ROWS then
                  raise exception 'Dependency:%, by object:%, not unique', d, orec.object;
            end;
            d = trec.object;		-- Use fully qualified object name
          end if;
-- raise notice '         insert:%:%:', orec.object, d;
--          insert into wm.depends (obj_ref, dep_ref) values (orec.object, d) on conflict (obj_ref, dep_ref) do nothing;	-- Obsolete
          darr = darr || d;
      end loop;
      update wm.objects set deps = darr where object = orec.object;		-- Write out cleaned up array
    end loop;
    return true;
  end;
$$;

-- Store a grant in the object table
-- ----------------------------------------------------------------------------
create function wm.grant(
    obj		varchar		-- Object we're granting permissions to
  , priv	varchar		-- A privilege name, defined for the application
  , level	int		-- Application defined level 1,2,3 etc
  , allow	varchar		-- select, insert, update, delete, etc
) returns boolean language plpgsql as $$
  declare
    pstr	varchar default array_to_string(array[obj,priv,level::varchar,allow], ',');
    grlist	varchar[];
  begin
    select grants into grlist from wm.objects where object = obj;
    if not FOUND then
      raise 'Can not find defined object:% to associate permissions with', obj;
    end if;
    if pstr = any(grlist) then
      raise notice 'Grant: % multiply defined', pstr;
      return false;
    else
      update wm.objects set grants = grlist || pstr where object = obj;
    end if;
    return true;
  end;
$$;

-- Attempt to replace a view or function
-- ----------------------------------------------------------------------------
create function wm.replace(obj varchar) 
  returns boolean language plpgsql as $$
  declare
    trec	record;
  begin

    select * into strict trec from wm.objects_v where object = obj;
    execute regexp_replace(trec.crt_sql,'create ','create or replace ','ig');
raise notice 'Replace:% :%:', trec.depth, trec.object;
    update wm.objects set clean = true where object = obj;
    return true;
  end;

$$;

-- Drop/create a group of database objects
-- ----------------------------------------------------------------------------
create function wm.make(
    objs varchar[]		-- array of objects to act on
  , drp boolean default true	-- drop objects in the specified branch
  , crt boolean default true	-- create objects in the specified branch
  , wrk text default '/var/tmp/wyseman'	-- server folder to store temp backup files in
) returns boolean language plpgsql as $$
  declare
    s		varchar;		-- temporary string
    trec	record;			-- temp record
    irec	record;			-- info record
    objlist	varchar[] default '{}';	-- expanded list of objects we will work on
    collist	varchar;		-- list of columns to save/restore in table
    cnt		int;			-- how many records saved/restored
    garr	varchar[];		-- grant array
    glev	varchar;		-- grant group_level
    otype	varchar;		-- object type, coerced to table for views
  begin
    foreach s in array objs loop	-- for each specified object, expand to dependent objects
      objlist = objlist || array(select distinct object from wm.depends_v where s = any(fpath));
    end loop;
-- raise notice 'objlist:%', objlist;
    create temporary table _table_info (obj_name varchar primary key, columns varchar, fname varchar, rows int);

    if drp then			-- Drop specified objects
      for trec in select * from wm.objects_v where object = any(objlist) order by depth desc loop
-- raise notice 'Drop:% :%:', trec.depth, trec.object;

        if trec.obj_type = 'table' then
          execute 'select count(*) from ' || trec.obj_name || ';' into strict cnt;
        end if;
        if trec.obj_type = 'table' and cnt > 0 then		-- Attempt to preserve existing table data
          collist = array_to_string(array(select column_name::text from information_schema.columns where table_schema || '.' || table_name = trec.obj_name order by ordinal_position),',');
-- raise notice 'collist:%', collist;
          s = wrk || '/' || trec.obj_name || '.dump';
          execute 'copy ' || trec.obj_name || '(' || collist || ') to ''' || s || '''';
          get diagnostics cnt = ROW_COUNT;
-- raise notice 'Count:%', cnt;
          insert into _table_info (obj_name,columns,fname,rows) values (trec.obj_name, collist, s, cnt);
        end if;

        execute trec.drp_sql;
      end loop;
    end if;

    if crt then			-- Create specified objects
      for trec in select * from wm.objects_v where object = any(objlist) order by depth loop
-- raise notice 'Create:% :%:', trec.depth, trec.object;
        execute trec.crt_sql;
        
        if trec.obj_type = 'table' then		-- Attempt to restore data into the table
          select * into irec from _table_info i where i.obj_name = trec.obj_name;
          if FOUND then
            execute 'copy ' || trec.obj_name || '(' || irec.columns || ') from ''' || irec.fname || '''';
            execute 'select count(*) from ' || trec.obj_name || ';' into strict cnt;
            if cnt != irec.rows then
              raise exception 'Restored % records to table % when % had been saved', cnt, trec.obj_name, irec.rows;
            end if;
          end if;
        end if;
        
        foreach s in array trec.grants loop	-- for each specified object, expand to dependent objects
-- raise notice 'Grant:% :%', trec.object, s;
          garr = string_to_array(s,',');
          glev = garr[2] || '_' || garr[3];
          if garr[2] = 'public' then
            glev = garr[2];
          elsif not exists (select rolname from pg_roles where rolname = glev) then
            execute 'create role ' || glev || ';';
          end if;
          otype = trec.obj_type; if otype = 'view' then otype = 'table'; end if;
          execute 'grant ' || garr[4] || ' on ' || otype || ' ' || trec.obj_name || ' to ' || glev || ';'; 
        end loop;
      end loop;
    end if;
    
    update wm.objects set clean = true where object = any(objlist);
    return true;
  end;
$$;
