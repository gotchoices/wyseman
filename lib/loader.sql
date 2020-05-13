-- Bootstrap loader for schema components
create schema if not exists wm;
grant usage on schema wm to public;

create or replace function wm.loader(sch jsonb) returns boolean language plpgsql as $$
  declare
    retval		boolean default false;
    qstring		text;

  begin
    qstring = convert_from(decode(sch->>'bootstrap','base64'), 'UTF8');
raise notice 'Loader: %', qstring;

    return retval;
  end;
$$;
