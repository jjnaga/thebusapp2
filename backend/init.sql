create table config (id serial, gtfs_last_update timestamptz);

CREATE SCHEMA gtfs AUTHORIZATION postgres;

INSERT into
  public.config (gtfs_last_update)
values
  ('1970-01-01 00:00:000+0');