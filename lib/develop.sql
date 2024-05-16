drop view if exists wm.column_ambig;
drop view if exists wm.language;
drop function if exists wm.commit();
drop function if exists wm.table_rest(text,text);
drop function if exists wm.table_save(text,text);
create function wm.commit() returns jsonb language plpgsql as $$
  declare
    nxt int = wm.next();
  begin
    update wm.releases set committed = current_timestamp where release = nxt;
    insert into wm.releases (release) values (nxt + 1);
    update wm.objects set max_rel = nxt + 1 where max_rel = nxt;
    nxt = nxt + 1;
    return wm.hist(nxt);
  end;
$$;
create function wm.table_rest(obj text, tag text) returns int language plpgsql as $$
  declare
    count	int;
    file text = wm.workdir(current_database()) || '/' || obj || '-' || tag || '.save';
    collist	text = array_to_string(
      array(
        select column_name::text from information_schema.columns where table_schema || '.' || table_name = obj order by ordinal_position
    ),',');
  begin
    SET session_replication_role = replica;
    execute 'delete from ' || obj;
    execute 'copy ' || obj || '(' || collist || ') from ''' || file || '''';
    execute 'select count(*) from ' || obj || ';' into strict count;
    SET session_replication_role = DEFAULT;
    return count;
  end;
$$;
create function wm.table_save(obj text, tag text) returns int language plpgsql as $$
  declare
    count	int;
    file text = wm.workdir(current_database()) || '/' || obj || '-' || tag || '.save';
    collist	text = array_to_string(
      array(
        select column_name::text from information_schema.columns where table_schema || '.' || table_name = obj order by ordinal_position
    ),',');
  begin
    execute 'copy ' || obj || '(' || collist || ') to ''' || file || '''';
    get diagnostics count = ROW_COUNT;
    return count;
  end;
$$;
create view wm.column_ambig as select
    cu.view_schema	as sch
  , cu.view_name	as tab
  , cu.column_name	as col
  , cn.nat_exp		as spec
  , count(*)		as count
  , array_agg(cu.table_name::varchar order by cu.table_name desc)	as natives
    from		wm.view_column_usage		cu
    join		wm.column_native		cn on cn.cnt_sch = cu.view_schema and cn.cnt_tab = cu.view_name and cn.cnt_col = cu.column_name
    where		view_schema not in ('pg_catalog','information_schema')
    group by		1,2,3,4
    having		count(*) > 1;
create view wm.language as with texts as (
    select tt_sch as sch, tt_tab as tab, 'table' as type,
      null as col, null as tag,		language, title, help, 
      tt_sch || '.' || tt_tab  as sorter
        from wm.table_text
      union all
    select ct_sch as sch, ct_tab as tab, 'column' as type,
      ct_col as col, null as tag,	language, title, help,
      ct_sch || '.' || ct_tab || '.c.' || ct_col as sorter
        from wm.column_text
      union all
    select vt_sch as sch, vt_tab as tab, 'value' as type,
      vt_col as col, value as tag,	language, title, help,
      vt_sch || '.' || vt_tab || '.c.' || vt_col || '.' || value as sorter
        from wm.value_text
      union all
    select mt_sch as sch, mt_tab as tab, 'message' as type,
      null as col, code as tag,		language, title, help,
      mt_sch || '.' || mt_tab || '.m.' || code as sorter
    from wm.message_text
  )
  select tt.tt_sch as sch, tt.tt_tab as tab, tt.tt_sch || '.' || tt.tt_tab as obj,
    tt.language as fr_lang,
    tl.language as language,
    zf.type, zf.col, zf.tag,
    zf.title as fr_title, zf.help as fr_help,
    zt.title, zt.help,
    zt.sorter
  
  from		wm.table_text	tt
  join	(
    select distinct language from wm.table_text
    union select 'xyz' as language
  ) tl on tl.language != tt.language
  join		texts	zf on zf.language = tt.language
  		and zf.sch = tt.tt_sch and zf.tab = tt.tt_tab
  left join	texts	zt on zt.language = tl.language
  		and zt.sorter = zf.sorter;
