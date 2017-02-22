#Build and maintain a data dictionary for wyseman schemas
#---------------------------------------
#Copyright WyattERP: GNU GPL Ver 3; see: License in root of this package
#TODO:
#- 
package require wylib
package provide wyseman 0.50

namespace eval wmddict {
    namespace export tabtext schema bootstrap
    variable v
}

# Handle a structure containing table text information
#------------------------------------------------------------
proc wmddict::tabtext {table args} {
    argform {title help fields} args
    argnorm {{title 2} {help 2} {language 2} {fields 1} {errors 2}} args
    lassign [wmdd::table_parts $table] schema table
    array set ca "language en"
    foreach tag {language} {xswitchs $tag args ca($tag)}
    foreach tag {title help fields errors} {set ca($tag) [sql::esc [wmparse::macsub [xswitchs $tag args]]]}
    set    query "delete from wm.table_text  where tt_sch = '$schema' and tt_tab = '$table' and language = '$ca(language)';\n"
    append query "delete from wm.column_text where ct_sch = '$schema' and ct_tab = '$table' and language = '$ca(language)';\n"
    append query "delete from wm.value_text  where vt_sch = '$schema' and vt_tab = '$table' and language = '$ca(language)';\n"
    append query "delete from wm.error_text  where et_sch = '$schema' and et_tab = '$table' and language = '$ca(language)';\n"
    append query "insert into wm.table_text (tt_sch,tt_tab,language,title,help) values ('$schema','$table','$ca(language)','$ca(title)',E'$ca(help)');\n"

    foreach rec $ca(fields) {			;#for each column
        argform {column title help subfields} rec
        argnorm {{column 2} {title 2} {help 2} {subfields}} rec
        foreach tag {column title help subfields} {set cf($tag) [xswitchs $tag rec]}
        append query "insert into wm.column_text (ct_sch,ct_tab,ct_col,language,title,help) values ('$schema','$table','$cf(column)','$ca(language)','$cf(title)',E'$cf(help)');\n"

        foreach srec $cf(subfields) {		;#for each subfield
            argform {value title help} srec
            argnorm {{value 1} {title 1} {help 1}} srec
            foreach tag {value title help} {set cs($tag) [xswitchs $tag srec]}
            append query "insert into wm.value_text (vt_sch,vt_tab,vt_col,value,language,title,help) values ('$schema','$table','$cf(column)','$cs(value)','$ca(language)','$cs(title)',E'$cs(help)');\n"
        }
    }

    foreach rec $ca(errors) {			;#for each column
        argform {code title help} rec
        argnorm {{code 2} {title 2} {help 2}} rec
        foreach tag {code title help} {set ce($tag) [xswitchs $tag rec]}
        append query "insert into wm.error_text (et_sch,et_tab,code,language,title,help) values ('$schema','$table','$ce(code)','$ca(language)','$ce(title)','$ce(help)');\n"

    }
    return $query
}

# Blocks of initialization code to be executed in order after creating/modifying tables/views in schema
#------------------------------------------------------------
proc wmddict::init_sql {{idx 0}} {

    set sql {}
    if {$idx <= 0} {					;#do on first call
        set sql "select wm.default_native();\n"		;#wm.column_native needs to know the native table for all view columns
    
        foreach natrec [wmparse::natives] {		;#update all forced native fields
#puts "natrec:$natrec"
            foreach col [lassign $natrec tab nat] {
                lassign [wmdd::table_parts $tab] schema table
                lassign [wmdd::table_parts $nat] natsch nattab
                if {[llength $col] > 1} {lassign $col col ncol} else {set ncol $col}
                append sql "update wm.column_native set nat_sch = '$natsch', nat_tab = '$nattab', nat_col = '$ncol', nat_exp = 't' where cnt_sch = '$schema' and cnt_tab = '$table' and cnt_col = '$col';\n"
            }
        }
    } elseif {$idx == 1} {				;#do on second call

        foreach rec [sql::qlist "select cdt_sch,cdt_tab,cdt_col from wm.column_data where is_pkey and cdt_col != '_oid' and field >= 0 order by 1,2"] {		;#ispkey field was not yet valid in first insert so is default false
            lassign $rec sch tab col
            append sql "update wm.column_native set pkey = 't' where cnt_sch = '$sch' and cnt_tab = '$tab' and cnt_col = '$col';\n"
        }

        foreach prirec [wmparse::primaries] {		;#update all forced primary keys
#puts "prirec:$prirec"
             lassign $prirec tab pkcols
             lassign [wmdd::table_parts $tab] schema table
             append sql "update wm.column_native set pkey = (cnt_col in ('[join $pkcols {','}]')) where cnt_sch = '$schema' and cnt_tab = '$table';\n"
        }
    }

#puts "sql:$sql"
    return $sql
}

# Produce SQL to create certain basic structures that are assumed to exist
# These objects are created/replaced by: wyseman -oper init and are ignored
# from then on by drop/create operations
#------------------------------------------------------------
proc wmddict::bootstrap {} {return {
    create schema wm;			-- to store all wyseman stuff in
    grant usage on schema wm to public;

    -- Track version info for wyseman objects (can't be inside the wm schema)
    -- -------------------------------------------
    create table wm.obj_vers (
       object		varchar		primary key
      , obj_type	varchar(64)	not null
      , version		int		not null default 0
      , dep		varchar
      , drop		varchar		not null
    );

    -- Store version info for wyseman table objects
    -- -------------------------------------------
    create or replace function wm.vers(varchar,varchar,int,varchar,varchar) returns int language plpgsql as $$
        begin
            update wm.obj_vers set obj_type = $2, version = $3, dep = $4 where object = $1;
            if not found then
                insert into wm.obj_vers (object, obj_type, version, dep, drop) values ($1,$2,$3,$4,$5);
            end if;
            return $3;
        end;
    $$;

    -- Remove version info for wyseman table objects
    -- -------------------------------------------
    create or replace function wm.vers(varchar) returns void language plpgsql as $$
        begin
            delete from wm.obj_vers where object = $1;
        end;
    $$;

    create or replace language plpgsql;
    create or replace language pltcl;
    create or replace language pltclu;
	 revoke create on schema public from public;
}}

# Produce SQL to create the data dictionary schema
#------------------------------------------------------------
proc wmddict::schema {} {return {

    # Help text for tables
    #-------------------------------------------
    table wm.table_text {} {
        tt_sch		name
      , tt_tab		name
      , language	varchar not null
      , title		varchar
      , help		varchar
      , primary key (tt_sch, tt_tab, language)
    } -text {{Table Text} {Contains a description of each table in the system} {
        {tt_sch		{Schema Name}	{The schema this table belongs to}}
        {tt_tab		{Table Name}	{The name of the table being described}}
        {language	{Language}	{The language this description is in}}
        {title		{Title}		{A short title for the table}}
        {help		{Description}	{A longer description of what the table is used for}}
    }} -grant public

    # Help text for columns
    #-------------------------------------------
    table wm.column_text {} {
        ct_sch		name
      , ct_tab		name
      , ct_col		name
      , language	varchar not null
      , title		varchar
      , help		varchar
      , primary key (ct_sch, ct_tab, ct_col, language)
    } -text {{Column Text} {Contains a description for each column of each table in the system} {
        {ct_sch		{Schema Name}	{The schema this column's table belongs to}}
        {ct_tab		{Table Name}	{The name of the table this column is in}}
        {ct_col		{Column Name}	{The name of the column being described}}
        {language	{Language}	{The language this description is in}}
        {title		{Title}		{A short title for the column}}
        {help		{Description}	{A longer description of what the column is used for}}
    }} -grant public
    
    # Help text for enumerated types
    #-------------------------------------------
    table wm.value_text {} {
        vt_sch		name
      , vt_tab		name
      , vt_col		name
      , value		varchar
      , language	varchar not null
      , title		varchar		-- Normal title
      , help		varchar		-- longer help description
      , primary key (vt_sch, vt_tab, vt_col, value, language)
    } -text {{Value Text} {Contains a description for the values which certain columns may be set to.  Used only for columns that can be set to one of a finite set of values (like an enumerated type).} {
        {vt_sch		{Schema Name}	{The schema of the table the column belongs to}}
        {vt_tab		{Table Name}	{The name of the table this column is in}}
        {vt_col		{Column Name}	{The name of the column whose values are being described}}
        {value		{Value}		{The name of the value being described}}
        {language	{Language}	{The language this description is in}}
        {title		{Title}		{A short title for the value}}
        {help		{Description}	{A longer description of what it means when the column is set to this value}}
    }} -grant public

    # Help text for schema error and other messages
    #-------------------------------------------
    table wm.error_text {} {
        et_sch		name
      , et_tab		name
      , code		varchar(4)
      , language	varchar not null
      , title		varchar		-- brief title for error message
      , help		varchar		-- longer help description
      , primary key (et_sch, et_tab, code, language)
    } -text {{Value Text} {Contains a description for the values which certain columns may be set to.  Used only for columns that can be set to one of a finite set of values (like an enumerated type).} {
        {vt_sch		{Schema Name}	{The schema of the table this column belongs to}}
        {vt_tab		{Table Name}	{The name of the table this column is in}}
        {vt_col		{Column Name}	{The name of the column whose values are being described}}
        {value		{Value}		{The name of the value being described}}
        {language	{Language}	{The language this description is in}}
        {title		{Title}		{A short title for the value}}
        {help		{Description}	{A longer description of what it means when the column is set to this value}}
    }} -grant public
    
    # A table to cache information about the native source(s) of a view's column
    #-------------------------------------------
    table wm.column_native {} {
        cnt_sch		name
      , cnt_tab		name
      , cnt_col		name
      , nat_sch		name
      , nat_tab		name
      , nat_col		name
      , nat_exp		boolean not null default 'f'
      , pkey		boolean
      , primary key (cnt_sch, cnt_tab, cnt_col)	-- each column can have only zero or one table considered as its native source
    } -text {{Native Columns} {Contains cached information about the tables and their columns which various higher level view columns derive from.  To query this directly from the information schema is somewhat slow, so wyseman caches it here when building the schema for faster access.} {
        {cnt_sch	{Schema Name}	{The schema of the table this column belongs to}}
        {cnt_tab	{Table Name}	{The name of the table this column is in}}
        {cnt_col	{Column Name}	{The name of the column whose native source is being described}}
        {nat_sch	{Schema Name}	{The schema of the native table the column derives from}}
        {nat_tab	{Table Name}	{The name of the table the column natively derives from}}
        {nat_col	{Column Name}	{The name of the column in the native table from which the higher level column derives}}
        {nat_exp	{Explic Native}	{The information about the native table in this record has been defined explicitly in the schema description (not derived from the database system catalogs)}}
        {pkey		{Primary Key}	{Wyseman can often determine the "primary key" for views on its own from the database.  When it can't, you have to define it explicitly in the schema.  This indicates that thiscolumn should be regarded as a primary key field when querying the view.}}
    }} -grant public
    index {} wm.column_native {nat_sch nat_tab}

    # The rest is an abstraction layer on postgres system tables and the tables 
    # above to create a data dictionary describing our schema
    #-------------------------------------------

    # Backend information about tables (includes system tables)
    #-------------------------------------------
    view wm.table_data {} {
        select
            ns.nspname		as td_sch
          , cl.relname		as td_tab
          , cl.relkind		as tab_kind
          , cl.relhaspkey	as has_pkey
          , cl.relnatts		as columns
        from	pg_class	cl
        join	pg_namespace	ns	on cl.relnamespace = ns.oid
        where	cl.relkind in ('r','v');	--only show tables and views
    } -text {{Table Data} {Contains information from the system catalogs about views and tables in the system} {
        {td_sch		{Schema Name}	{The schema the table is in}}
        {td_tab		{Table Name}	{The name of the table being described}}
        {tab_kind	{Kind}		{Tells whether the relation is a table or a view}}
        {has_pkey	{Has Pkey}	{Indicates whether the table has a primary key defined in the database}}
        {columns	{Columns}	{Indicates how many columns are in the table}}
    }} -primary {td_sch td_tab} -grant public

    # Unified information about non-system tables
    #-------------------------------------------
    view wm.table_pub {wm.table_data wm.table_text} {
        select
            td.td_sch				as sch
          , td.td_tab				as tab
          , td.tab_kind
          , td.has_pkey
          , td.columns
          , tt.language
          , tt.title
          , tt.help
          , td.td_sch || '.' || td.td_tab	as obj
        from		wm.table_data	td
        join		wm.table_text	tt on td.td_sch = tt.tt_sch and td.td_tab = tt.tt_tab;
--        where		not td.td_sch in ('pg_catalog','information_schema');
    } -text {{Tables} {Joins information about tables from the system catalogs with the text descriptions defined in wyseman} {
        {sch		{Schema Name}	{The schema the table belongs to}}
        {tab		{Table Name}	{The name of the table being described}}
        {obj		{Object Name}	{The table name, prefixed by the schema (namespace) name}}
    }} -primary {sch tab} -grant public

    # A permissioned view of the same name in information schema
    #-------------------------------------------
    view wm.view_column_usage {} {
        select * from information_schema.view_column_usage
    } -text {{View Column Usage} {A version of a similar view in the information schema but faster.  For each view, tells what underlying table and column the view column uses.} {
        {view_schema	{View Schema}	{The schema the view belongs to}}
        {view_name	{View Name}	{The name of the view being described}}
        {table_schema	{Table Schema}	{The schema the underlying table belongs to}}
        {table_name	{Table Name}	{The name of the underlying table}}
        {column_name	{Column Name}	{The name of the column in the view}}
    }} -primary {view_schema view_name} -grant public

    # Initialize the cache of native tables/columns with default values
    # Scan through view_column_usage iteratively until we resolve to a relation of table type (the native table)
    #-------------------------------------------
    function {wm.default_native()} {wm.column_native wm.column_data wm.view_column_usage} {
      returns int language plpgsql as $$
        declare
            crec	record;
            nrec	record;
            sname	varchar;
            tname	varchar;
            cnt		int default 0;
        begin
            delete from wm.column_native;
            for crec in select * from wm.column_data where cdt_col != '_oid' and field  >= 0 and cdt_sch not in ('pg_catalog','information_schema') loop
                sname := crec.cdt_sch;
                tname := crec.cdt_tab;
                loop
                    select into nrec * from wm.view_column_usage where view_schema = sname and view_name = tname and column_name = crec.cdt_col order by table_name desc limit 1;	-- order at least gives a predictable result if there are 2 or more...
                    if not found then exit; end if;
                    sname := nrec.table_schema;
                    tname := nrec.table_name;
                end loop;
                insert into wm.column_native (cnt_sch, cnt_tab, cnt_col, nat_sch, nat_tab, nat_col, pkey) values (crec.cdt_sch, crec.cdt_tab, crec.cdt_col, sname, tname, crec.cdt_col, crec.is_pkey);
            end loop;
            return cnt;
        end;
      $$;
    }

    # Backend information about columns
    #-------------------------------------------
    view wm.column_data {wm.column_native} {
      select
          n.nspname		as cdt_sch
        , c.relname		as cdt_tab
        , a.attname		as cdt_col
        , a.attnum		as field
        , t.typname		as type
        , na.attnotnull		as nonull		-- notnull of native table
        , case when a.attlen < 0 then null else a.attlen end 	as length
        , coalesce(na.attnum = any((select conkey from pg_constraint
              where connamespace = nc.relnamespace
              and conrelid = nc.oid and contype = 'p')::int4[]),'f') as is_pkey
        , ts.pkey		-- like ispkey, but can be overridden explicitly in the wms file
        , ts.nat_sch
        , ts.nat_tab
        , ts.nat_col
      from		pg_class	c
          join		pg_attribute	a	on a.attrelid =	c.oid
          join		pg_type		t	on t.oid = a.atttypid
          join		pg_namespace	n	on n.oid = c.relnamespace
          left join	wm.column_native ts	on ts.cnt_sch = n.nspname and ts.cnt_tab = c.relname and ts.cnt_col = a.attname
          left join	pg_namespace	nn	on nn.nspname = ts.nat_sch
          left join	pg_class	nc	on nc.relnamespace = nn.oid and nc.relname = ts.nat_tab
          left join	pg_attribute	na	on na.attrelid = nc.oid and na.attname = a.attname
      where c.relkind in ('r','v');		-- only include tables and views
--        and a.attnum >= 0 			-- don't include system columns
    } -text {{Column Data} {Contains information from the system catalogs about columns of tables in the system} {
        {cdt_sch	{Schema Name}	{The schema of the table this column belongs to}}
        {cdt_tab	{Table Name}	{The name of the table this column is in}}
        {cdt_col	{Column Name}	{The name of the column whose data is being described}}
        {field		{Field}		{The number of the column as it appears in the table}}
        {nonull		{Not Null}	{Indicates that the column is not allowed to contain a null value}}
        {is_pkey	{Def Prim Key}	{Indicates that this column is defined as a primary key in the database (can be overridden by a wyseman setting)}}
    }} -primary {cdt_sch cdt_tab cdt_col} -grant public

    # Unified information about columns in non-system tables
    #-------------------------------------------
    view wm.column_pub {wm.column_data wm.column_text} {
      select
        cd.cdt_sch					as sch
      , cd.cdt_tab					as tab
      , cd.cdt_col					as col
      , cd.cdt_sch || '.' || cd.cdt_tab			as obj
      , cd.field
      , cd.type
      , cd.nonull
      , cd.length
      , cd.is_pkey
      , cd.pkey
      , cd.nat_sch
      , cd.nat_tab
      , cd.nat_sch || '.' || cd.nat_tab			as nat
      , cd.nat_col
      , coalesce(vt.language, nt.language, 'en')	as language
      , coalesce(vt.title, nt.title, cd.cdt_col)	as title
      , coalesce(vt.help, nt.help)			as help
      from		wm.column_data cd
        left join	wm.column_text vt	on vt.ct_sch = cd.cdt_sch and vt.ct_tab = cd.cdt_tab and vt.ct_col = cd.cdt_col
        left join	wm.column_text nt	on nt.ct_sch = cd.nat_sch and nt.ct_tab = cd.nat_tab and nt.ct_col = cd.nat_col

        where		cd.cdt_col != '_oid'
        and		cd.field >= 0;
--        and		not cd.cdt_sch in ('pg_catalog','information_schema');
    } -text {{Columns} {Joins information about table columns from the system catalogs with the text descriptions defined in wyseman} {
        {sch		{Schema Name}	{The schema of the table the column belongs to}}
        {tab		{Table Name}	{The name of the table that holds the column being described}}
        {col		{Column Name}	{The name of the column being described}}
        {obj		{Object Name}	{The table name, prefixed by the schema (namespace) name}}
        {nat		{Native Object}	{The name of the native table, prefixed by the native schema}}
        {language	{Language}	{The language of the included textual descriptions}}
        {title		{Title}		{A short title for the table}}
        {help		{Description}	{A longer description of what the table is used for}}
    }} -primary {sch tab col} -grant public

    # Generate an array of column names from their position numbers
    #-------------------------------------------
    function {wm.column_names(oid,int4[])} {} {
      returns varchar[] as $$
        declare
            val	varchar[];
            rec	record;
        begin
            for rec in select * from pg_attribute where attrelid = $1 and attnum = any($2) loop
                if val isnull then
                    val := array[rec.attname::varchar];
                else
                    val := val || rec.attname::varchar;
                end if;
            end loop;
            return val;
        end;
      $$ language plpgsql stable;
    }

    # Information about foreign keys, listed as a single record for every group of fields belonging to a single key
    #-------------------------------------------
    view wm.fkeys_data {wm.column_names(oid,int4[])} {
      select
          co.conname					as conname
        , tn.nspname					as kst_sch
        , tc.relname					as kst_tab
        , wm.column_names(co.conrelid,co.conkey)	as kst_cols
        , fn.nspname					as ksf_sch
        , fc.relname					as ksf_tab
        , wm.column_names(co.confrelid,co.confkey)	as ksf_cols
      from		pg_constraint	co 
        join		pg_class	tc on tc.oid = co.conrelid
        join		pg_namespace	tn on tn.oid = tc.relnamespace
        join		pg_class	fc on fc.oid = co.confrelid
        join		pg_namespace	fn on fn.oid = fc.relnamespace
      where co.contype = 'f';
    } -text {{Keys Data} {Includes data from the system catalogs about how key fields in a table point to key fields in a foreign table.  Each key group is described on a separate row.} {
        {kst_sch	{Base Schema}		{The schema of the table that has the referencing key fields}}
        {kst_tab	{Base Table}		{The name of the table that has the referencing key fields}}
        {kst_cols	{Base Columns}		{The name of the columns in the referencing table's key}}
        {ksf_sch	{Foreign Schema}	{The schema of the table that is referenced by the key fields}}
        {ksf_tab	{Foreign Table}		{The name of the table that is referenced by the key fields}}
        {ksf_cols	{Foreign Columns}	{The name of the columns in the referenced table's key}}
        {conname	{Constraint}		{The name of the the foreign key constraint in the database}}
    }} -grant public -primary {conname}

    # Information about foreign keys to public tables/views
    #-------------------------------------------
    view wm.fkeys_pub {wm.fkeys_data wm.column_native} {
      select
        tk.conname
      , tn.cnt_sch				as tt_sch
      , tn.cnt_tab				as tt_tab
      , tn.cnt_sch || '.' || tn.cnt_tab		as tt_obj
      , tk.kst_cols				as tt_cols
      , tn.nat_sch				as tn_sch
      , tn.nat_tab				as tn_tab
      , tn.nat_sch || '.' || tn.nat_tab		as tn_obj
      , fn.cnt_sch				as ft_sch
      , fn.cnt_tab				as ft_tab
      , fn.cnt_sch || '.' || fn.cnt_tab		as ft_obj
      , tk.ksf_cols				as ft_cols
      , fn.nat_sch				as fn_sch
      , fn.nat_tab				as fn_tab
      , fn.nat_sch || '.' || fn.nat_tab		as fn_obj
      from	wm.fkeys_data		tk
        join	wm.column_native	tn on tn.nat_sch = tk.kst_sch and tn.nat_tab = tk.kst_tab and tn.nat_col = tk.kst_cols[1]
        join	wm.column_native	fn on fn.nat_sch = tk.ksf_sch and fn.nat_tab = tk.ksf_tab and fn.nat_col = tk.ksf_cols[1]
      where	not tk.kst_sch in ('pg_catalog','information_schema');
    } -text {{Keys} {Public view to see foreign key relationships between views and tables and what their native underlying tables/columns are.  One row per key group.} {
        {tt_sch		{Schema}		{The schema of the table that has the referencing key fields}}
        {tt_tab		{Table}			{The name of the table that has the referencing key fields}}
        {tt_cols	{Columns}		{The name of the columns in the referencing table's key}}
        {tt_obj		{Object}		{Concatenated schema.table that has the referencing key fields}}
        {tn_sch		{Nat Schema}		{The schema of the native table that has the referencing key fields}}
        {tn_tab		{Nat Table}		{The name of the native table that has the referencing key fields}}
        {tn_cols	{Nat Columns}		{The name of the columns in the native referencing table's key}}
        {tn_obj		{Nat Object}		{Concatenated schema.table for the native table that has the referencing key fields}}
        {ft_sch		{For Schema}		{The schema of the table that is referenced by the key fields}}
        {ft_tab		{For Table}		{The name of the table that is referenced by the key fields}}
        {ft_cols	{For Columns}		{The name of the columns referenced by the key}}
        {ft_obj		{For Object}		{Concatenated schema.table for the table that is referenced by the key fields}}
        {fn_sch		{For Nat Schema}	{The schema of the native table that is referenced by the key fields}}
        {fn_tab		{For Nat Table}		{The name of the native table that is referenced by the key fields}}
        {fn_cols	{For Nat Columns}	{The name of the columns in the native referenced by the key}}
        {fn_obj		{For Nat Object}	{Concatenated schema.table for the native table that is referenced by the key fields}}
    }} -grant public -primary {conname}
    
    # Information about foreign keys, listed as a separate record for every key component
    #-------------------------------------------
    view wm.fkey_data {} {
      select
          co.conname				as conname
        , tn.nspname				as kyt_sch
        , tc.relname				as kyt_tab
        , ta.attname				as kyt_col
        , co.conkey[s.a]			as kyt_field
        , fn.nspname				as kyf_sch
        , fc.relname				as kyf_tab
        , fa.attname				as kyf_col
        , co.confkey[s.a]			as kyf_field
        , s.a					as key
        , array_upper(co.conkey,1)		as keys
      from		pg_constraint	co 
        join		generate_series(1,10) s(a)	on true
        join		pg_attribute	ta on ta.attrelid = co.conrelid  and ta.attnum = co.conkey[s.a]
        join		pg_attribute	fa on fa.attrelid = co.confrelid and fa.attnum = co.confkey[s.a]
        join		pg_class	tc on tc.oid = co.conrelid
        join		pg_namespace	tn on tn.oid = tc.relnamespace
        left join	pg_class	fc on fc.oid = co.confrelid
        left join	pg_namespace	fn on fn.oid = fc.relnamespace
      where co.contype = 'f';
    } -text {{Key Data} {Includes data from the system catalogs about how key fields in a table point to key fields in a foreign table.  Each separate key field is listed as a separate row.} {
        {kyt_sch	{Base Schema}		{The schema of the table that has the referencing key fields}}
        {kyt_tab	{Base Table}		{The name of the table that has the referencing key fields}}
        {kyt_col	{Base Columns}		{The name of the column in the referencing table's key}}
        {kyt_field	{Base Field}		{The number of the column in the referencing table's key}}
        {kyf_sch	{Foreign Schema}	{The schema of the table that is referenced by the key fields}}
        {kyf_tab	{Foreign Table}		{The name of the table that is referenced by the key fields}}
        {kyf_col	{Foreign Columns}	{The name of the columns in the referenced table's key}}
        {kyf_field	{Foreign Field}		{The number of the column in the referenced table's key}}
        {key		{Key}			{The number of which field of a compound key this record describes}}
        {keys		{Keys}			{The total number of columns used for this foreign key}}
        {conname	{Constraint}		{The name of the the foreign key constraint in the database}}
    }} -grant public -primary {conname}
    
    # Information about foreign keys to public tables/views
    #-------------------------------------------
    view wm.fkey_pub {wm.fkey_data wm.column_native} {
      select
        kd.conname
      , tn.cnt_sch				as tt_sch
      , tn.cnt_tab				as tt_tab
      , tn.cnt_sch || '.' || tn.cnt_tab		as tt_obj
      , tn.cnt_col				as tt_col
      , tn.nat_sch				as tn_sch
      , tn.nat_tab				as tn_tab
      , tn.nat_sch || '.' || tn.nat_tab		as tn_obj
      , tn.nat_col				as tn_col
      , fn.cnt_sch				as ft_sch
      , fn.cnt_tab				as ft_tab
      , fn.cnt_sch || '.' || fn.cnt_tab		as ft_obj
      , fn.cnt_col				as ft_col
      , fn.nat_sch				as fn_sch
      , fn.nat_tab				as fn_tab
      , fn.nat_sch || '.' || fn.nat_tab		as fn_obj
      , fn.nat_col				as fn_col
      , kd.key
      , kd.keys
      , case when exists (select * from wm.column_native where cnt_sch = tn.cnt_sch and cnt_tab = tn.cnt_tab and nat_sch = tn.nat_sch and nat_tab = tn.nat_tab and cnt_col != tn.cnt_col and nat_col = kd.kyt_col) then
            tn.cnt_col
        else
            null
        end						as unikey
      , coalesce(vt.language, nt.language, 'en')	as language
      , coalesce(vt.title, nt.title, tn.cnt_col)	as title
      , coalesce(vt.help, nt.help)			as help

      from	wm.fkey_data		kd
        join	wm.column_native	tn on tn.nat_sch = kd.kyt_sch and tn.nat_tab = kd.kyt_tab and tn.nat_col = kd.kyt_col
        join	wm.column_native	fn on fn.nat_sch = kd.kyf_sch and fn.nat_tab = kd.kyf_tab and fn.nat_col = kd.kyf_col
        left join wm.column_text vt	on vt.ct_sch = tn.cnt_sch and vt.ct_tab = tn.cnt_tab and vt.ct_col = tn.cnt_col
        left join wm.column_text nt	on nt.ct_sch = tn.nat_sch and nt.ct_tab = tn.nat_tab and nt.ct_col = kd.kyt_col
      where	not kd.kyt_sch in ('pg_catalog','information_schema');
    } -text {{Key Info} {Public view to see foreign key relationships between views and tables and what their native underlying tables/columns are.  One row per key column.} {
        {tt_sch		{Schema}		{The schema of the table that has the referencing key fields}}
        {tt_tab		{Table}			{The name of the table that has the referencing key fields}}
        {tt_col		{Column}		{The name of the column in the referencing table's key component}}
        {tt_obj		{Object}		{Concatenated schema.table that has the referencing key fields}}
        {tn_sch		{Nat Schema}		{The schema of the native table that has the referencing key fields}}
        {tn_tab		{Nat Table}		{The name of the native table that has the referencing key fields}}
        {tn_col		{Nat Column}		{The name of the column in the native referencing table's key component}}
        {tn_obj		{Nat Object}		{Concatenated schema.table for the native table that has the referencing key fields}}
        {ft_sch		{For Schema}		{The schema of the table that is referenced by the key fields}}
        {ft_tab		{For Table}		{The name of the table that is referenced by the key fields}}
        {ft_col		{For Column}		{The name of the column referenced by the key component}}
        {ft_obj		{For Object}		{Concatenated schema.table for the table that is referenced by the key fields}}
        {fn_sch		{For Nat Schema}	{The schema of the native table that is referenced by the key fields}}
        {fn_tab		{For Nat Table}		{The name of the native table that is referenced by the key fields}}
        {fn_col		{For Nat Column}	{The name of the column in the native referenced by the key component}}
        {fn_obj		{For Nat Object}	{Concatenated schema.table for the native table that is referenced by the key fields}}
        {unikey		{Unikey}		{Used to differentiate between multiple fkeys pointing to the same destination, and multi-field fkeys pointing to multi-field destinations}}
    }} -grant public -primary {conname}
    
    # View members of roles by name
    #-------------------------------------------
    view wm.role_members {} {
      select ro.rolname as role, me.rolname  as member
        from        pg_auth_members am
        join        pg_authid       ro on ro.oid = am.roleid
        join        pg_authid       me on me.oid = am.member;
    } -text {{Role Members} {Summarizes information from the system catalogs about members of various defined roles} {
        {role		{Role}		{The name of a role}}
        {member		{Member}	{The username of a member of the named role}}
    }} -primary {role member}

    # Show view columns that have ambiguous native tables
    #-------------------------------------------
    view wm.column_ambig {wm.view_column_usage wm.column_native} {select
        cu.view_schema		as sch
      , cu.view_name		as tab
      , cu.column_name		as col
      , cn.nat_exp		as spec
      , count(*)		as count
      , array_agg(cu.table_name::varchar order by cu.table_name desc)	as natives
        from	wm.view_column_usage		cu
        join	wm.column_native		cn on cn.cnt_sch = cu.view_schema and cn.cnt_tab = cu.view_name and cn.cnt_col = cu.column_name
        where	view_schema not in ('pg_catalog','information_schema')
        group by	1,2,3,4
        having	count(*) > 1;
    } -text {{Ambiguous Columns} {A view showing view and their columns for which no definitive native table and column can be found automatically} {
        {sch		{Schema}	{The name of the schema this view is in}}
        {tab		{Table}		{The name of the view}}
        {col		{Column}	{The name of the column within the view}}
        {spec		{Specified}	{True if the definitive native table has been specified explicitly in the schema definition files}}
        {count		{Count}		{The number of possible native tables for this column}}
        {natives	{Natives}	{A list of the possible native tables for this column}}
    }} -primary {sch tab col}
}}
