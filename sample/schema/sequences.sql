-- Initialize our sequences to match current data in tables

select setval('empl_seq',	(select coalesce(max(empl_id),1000)	from empl));
