--
-- PostgreSQL database dump
--

-- Dumped from database version 14.7 (Homebrew)
-- Dumped by pg_dump version 14.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SET timezone = 'Pacific/Honolulu';

--
-- Name: api; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA api;


ALTER SCHEMA api OWNER TO postgres;

--
-- Name: gtfs; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA gtfs;


ALTER SCHEMA gtfs OWNER TO postgres;

--
-- Name: thebus; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA thebus;


ALTER SCHEMA thebus OWNER TO postgres;

--
-- Name: audit_action; Type: TYPE; Schema: api; Owner: postgres
--

CREATE TYPE api.audit_action AS ENUM (
    'SNAPSHOT',
    'INSERT',
    'UPDATE_OLD',
    'UPDATE_NEW',
    'DELETE'
);


ALTER TYPE api.audit_action OWNER TO postgres;

--
-- Name: tg_audit_vehicle_info(); Type: FUNCTION; Schema: api; Owner: postgres
--


CREATE FUNCTION api.tg_audit_vehicle_info() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO api.vehicle_info_audit
        VALUES (default, new.*, TG_OP::api.audit_action, now());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO api.vehicle_info_audit
        VALUES (default, old.*, 'UPDATE_OLD'::api.audit_action, now()),
               (default, new.*, 'UPDATE_NEW'::api.audit_action, now());
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO api.vehicle_info_audit
        VALUES (default, old.*, TG_OP::api.audit_action, now());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION api.tg_audit_vehicle_info() OWNER TO postgres;

--
-- Name: update_timestamp(); Type: FUNCTION; Schema: api; Owner: postgres
--

CREATE FUNCTION api.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
      NEW.vehicle_last_updated = now(); 
      RETURN NEW;
   ELSE
      RETURN OLD;
   END IF;
END;
$$;


ALTER FUNCTION api.update_timestamp() OWNER TO postgres;

--
-- Name: update_trips_info_timestamp(); Type: FUNCTION; Schema: api; Owner: postgres
--

CREATE FUNCTION api.update_trips_info_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
       new.vehicle_last_updated = now(); 
      RETURN NEW;
   ELSE
      RETURN OLD;
   END IF;
END;
$$;


ALTER FUNCTION api.update_trips_info_timestamp() OWNER TO postgres;

--
-- Name: get_day_single_char(); Type: FUNCTION; Schema: thebus; Owner: postgres
--

CREATE FUNCTION thebus.get_day_single_char() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
declare
	dow numeric;
	day varchar(1);
BEGIN
      -- get the rate based on film_id
        
     select extract(dow from current_date) into dow;

    case 
    WHEN dow = 0 THEN
            day = 's';
    WHEN dow = 1 THEN
            day = 'm';
    WHEN dow = 2 THEN
            day = 'u';
    WHEN dow = 3 THEN
            day = 't';
    WHEN dow = 4 THEN
            day = 't';
    WHEN dow = 5 THEN
            day = 'f';
    WHEN dow = 6 THEN
            day = 'a';
    END CASE;
    
   return day;
END; $$;


ALTER FUNCTION thebus.get_day_single_char() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_hits_count; Type: TABLE; Schema: api; Owner: postgres
--

CREATE TABLE api.api_hits_count (
    date date NOT NULL,
    hits integer DEFAULT 0 NOT NULL,
    CONSTRAINT api_hits_count_pkey PRIMARY KEY (date)
);


ALTER TABLE api.api_hits_count OWNER TO postgres;

--
-- Name: trips_info; Type: TABLE; Schema: api; Owner: postgres
--

CREATE TABLE api.trips_info (
    trip_id numeric NOT NULL primary key,
    active bool NOT NULL DEFAULT false,
    canceled boolean NOT NULL,
    route text null,
    vehicle_number character varying,
    vehicle_last_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);



ALTER TABLE api.trips_info OWNER TO postgres;

--
-- Name: vehicle_info; Type: TABLE; Schema: api; Owner: postgres
--

CREATE TABLE api.vehicle_info (
	number text NOT NULL,
	driver numeric NULL,
	latitude numeric NULL,
	longitude numeric NULL,
	adherence numeric NULL,
	last_message timestamptz NULL,
    route text null,
	updated_on timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT vehicle_info_pkey PRIMARY KEY (number)
);




ALTER TABLE api.vehicle_info OWNER TO postgres;

--
-- Name: vehicle_info_audit; Type: TABLE; Schema: api; Owner: postgres
--

CREATE TABLE api.vehicle_info_audit (
    audit_entry serial NOT NULL,
    "number" text NOT NULL,
    driver numeric,
    latitude numeric,
    longitude numeric,
    adherence numeric,
    last_message timestamp without time zone,
    route text,
    updated_on timestamp with time zone,
    action api.audit_action NOT NULL,
    log_time timestamp with time zone NOT NULL
);


ALTER TABLE api.vehicle_info_audit OWNER TO postgres;

--
-- Name: vehicle_info_audit_audit_entry_seq; Type: SEQUENCE; Schema: api; Owner: postgres
--

-- CREATE SEQUENCE api.vehicle_info_audit_audit_entry_seq
--     AS integer
--     START WITH 1
--     INCREMENT BY 1
--     NO MINVALUE
--     NO MAXVALUE
--     CACHE 1;


-- ALTER TABLE api.vehicle_info_audit_audit_entry_seq OWNER TO postgres;

--
-- Name: vehicle_info_audit_audit_entry_seq; Type: SEQUENCE OWNED BY; Schema: api; Owner: postgres
--

ALTER SEQUENCE api.vehicle_info_audit_audit_entry_seq OWNED BY api.vehicle_info_audit.audit_entry;




--
-- Name: calendar; Type: TABLE; Schema: gtfs; Owner: postgres
--

CREATE TABLE gtfs.calendar (
    service_id numeric PRIMARY KEY,
    monday numeric,
    tuesday numeric,
    wednesday numeric,
    thursday numeric,
    friday numeric,
    saturday numeric,
    sunday numeric,
    start_date numeric,
    end_date numeric,
    events_and_status character varying(20),
    operating_days character varying(20),
    duty character varying(20)
);


ALTER TABLE gtfs.calendar OWNER TO postgres;

CREATE TABLE gtfs.calendar_staging (
    service_id numeric,
    monday numeric,
    tuesday numeric,
    wednesday numeric,
    thursday numeric,
    friday numeric,
    saturday numeric,
    sunday numeric,
    start_date numeric,
    end_date numeric,
    events_and_status character varying(20),
    operating_days character varying(20),
    duty character varying(20)
);


ALTER TABLE gtfs.calendar_staging OWNER TO postgres;

--
-- Name: calendar_dates; Type: TABLE; Schema: gtfs; Owner: postgres
--

CREATE TABLE gtfs.calendar_dates (
    service_id numeric NOT NULL,
    date numeric,
    exception_type numeric,
    PRIMARY KEY(service_id, date)
);


ALTER TABLE gtfs.calendar_dates OWNER TO postgres;

CREATE TABLE gtfs.calendar_dates_staging (
    service_id numeric,
    date numeric,
    exception_type numeric
);


ALTER TABLE gtfs.calendar_dates OWNER TO postgres;



ALTER TABLE gtfs.calendar_dates_staging OWNER TO postgres;






--
-- Name: stop_times; Type: TABLE; Schema: gtfs; Owner: postgres
--

CREATE TABLE gtfs.stop_times (
    trip_id numeric,
    arrival_time character varying(8),
    departure_time character varying(8),
    stop_id character varying(10),
    stop_sequence numeric,
    stop_headsign numeric,
    pickup_type numeric,
    drop_off_type numeric,
    shape_dist_traveled numeric,
    timepoint numeric,
    stop_code numeric,
    primary key (trip_id, stop_sequence)
);


ALTER TABLE gtfs.stop_times OWNER TO postgres;

CREATE TABLE gtfs.stop_times_staging (
    trip_id numeric,
    arrival_time character varying(8),
    departure_time character varying(8),
    stop_id character varying(10),
    stop_sequence numeric,
    stop_headsign numeric,
    pickup_type numeric,
    drop_off_type numeric,
    shape_dist_traveled numeric,
    timepoint numeric,
    stop_code numeric
);


ALTER TABLE gtfs.stop_times_staging OWNER TO postgres;

--
-- Name: trips; Type: TABLE; Schema: gtfs; Owner: postgres
--

CREATE TABLE gtfs.trips (
    route_id numeric,
    service_id numeric,
    trip_id numeric PRIMARY KEY,
    trip_headsign character varying(40),
    direction_id numeric,
    block_id numeric,
    shape_id character varying(25),
    trip_headsign_short character varying(33),
    apc_trip_id numeric,
    display_code character varying(8),
    trip_serial_number numeric,
    block character varying(7)
);


ALTER TABLE gtfs.trips OWNER TO postgres;


CREATE TABLE gtfs.trips_staging (
    route_id numeric,
    service_id numeric,
    trip_id numeric,
    trip_headsign character varying(40),
    direction_id numeric,
    block_id numeric,
    shape_id character varying(25),
    trip_headsign_short character varying(33),
    apc_trip_id numeric,
    display_code character varying(8),
    trip_serial_number numeric,
    block character varying(7)
);


ALTER TABLE gtfs.trips_staging OWNER TO postgres;
--
-- Name: first_and_last_stops_of_routes; Type: VIEW; Schema: gtfs; Owner: postgres
--

CREATE OR REPLACE materialized VIEW gtfs.first_and_last_stops_of_routes
AS SELECT DISTINCT stops.stop_id
   FROM ( SELECT t.trip_headsign,
            st.stop_id,
            t.shape_id,
            st.stop_sequence
           FROM gtfs.stop_times st
             JOIN gtfs.trips t ON t.trip_id = st.trip_id
          WHERE st.stop_sequence = (( SELECT max(st2.stop_sequence) AS max
                   FROM gtfs.stop_times st2
                  WHERE st.trip_id = st2.trip_id))
          GROUP BY t.trip_headsign, st.stop_id, t.shape_id, st.stop_sequence
        UNION
         SELECT t.trip_headsign,
            st.stop_id,
            t.shape_id,
            st.stop_sequence
           FROM gtfs.stop_times st
             JOIN gtfs.trips t ON t.trip_id = st.trip_id
          WHERE st.stop_sequence = (( SELECT min(st2.stop_sequence) AS min
                   FROM gtfs.stop_times st2
                  WHERE st.trip_id = st2.trip_id))
          GROUP BY t.trip_headsign, st.stop_id, t.shape_id, st.stop_sequence) stops;

ALTER TABLE gtfs.first_and_last_stops_of_routes OWNER TO postgres;

--
-- Name: routes; Type: TABLE; Schema: gtfs; Owner: postgres
--

CREATE TABLE gtfs.routes (
    route_id character varying(9) PRIMARY KEY,
    route_short_name character varying(3),
    route_long_name character varying(47),
    route_desc numeric,
    route_type numeric,
    agency_id varchar(255),
    route_color varchar(255),
    route_text_color varchar(255)
);


ALTER TABLE gtfs.routes OWNER TO postgres;

CREATE TABLE gtfs.routes_staging (
    route_id character varying(9),
    route_short_name character varying(3),
    route_long_name character varying(47),
    route_desc numeric,
    route_type numeric,
    agency_id varchar(255),
    route_color varchar(255),
    route_text_color varchar(255)
);


ALTER TABLE gtfs.routes_staging OWNER TO postgres;


--
-- Name: shapes; Type: TABLE; Schema: gtfs; Owner: postgres
--

CREATE TABLE gtfs.shapes (
    shape_id character varying(25),
    shape_pt_lat numeric,
    shape_pt_lon numeric,
    shape_pt_sequence numeric,
    PRIMARY KEY(shape_id, shape_pt_sequence)
);


ALTER TABLE gtfs.shapes OWNER TO postgres;

CREATE TABLE gtfs.shapes_staging (
    shape_id character varying(25),
    shape_pt_lat numeric,
    shape_pt_lon numeric,
    shape_pt_sequence numeric
);


ALTER TABLE gtfs.shapes_staging OWNER TO postgres;

--
-- Name: stops; Type: TABLE; Schema: gtfs; Owner: postgres
--

CREATE TABLE gtfs.stops (
    stop_id character varying(10) PRIMARY KEY,
    stop_code numeric,
    stop_name character varying(50),
    stop_desc numeric,
    stop_lat numeric,
    stop_lon numeric,
    zone_id numeric,
    stop_url character varying(41),
    location_type numeric,
    parent_station numeric,
    stop_serial_number numeric
);


ALTER TABLE gtfs.stops OWNER TO postgres;

CREATE TABLE gtfs.stops_staging (
    stop_id character varying(10),
    stop_code numeric,
    stop_name character varying(50),
    stop_desc numeric,
    stop_lat numeric,
    stop_lon numeric,
    zone_id numeric,
    stop_url character varying(41),
    location_type numeric,
    parent_station numeric,
    stop_serial_number numeric
);


ALTER TABLE gtfs.stops_staging OWNER TO postgres;


CREATE SEQUENCE gtfs.vehicle_info_audit_seq
    START WITH 101
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE gtfs.vehicle_info_audit_seq OWNER TO postgres;


--
-- Name: active_buses; Type: VIEW; Schema: thebus; Owner: postgres
--

CREATE VIEW thebus.active_buses AS
 SELECT DISTINCT ti2.vehicle_number
   FROM (( SELECT to_timestamp(((CURRENT_DATE)::text || (
                CASE
                    WHEN ((st.arrival_time)::text ~ '^2[456789]'::text) THEN ((((("substring"((st.arrival_time)::text, 1, 2))::integer - 24))::text || "substring"((st.arrival_time)::text, 3)))::time without time zone
                    ELSE (st.arrival_time)::time without time zone
                END)::text), 'YYYY-MM-DDHH24:MI:SS'::text) AS arrival,
            (st.arrival_time)::time without time zone AS arrival_time,
            t.trip_id
           FROM ((gtfs.trips t
             JOIN gtfs.stop_times st ON ((st.trip_id = t.trip_id)))
             JOIN api.trips_info ti ON ((ti.trip_id = t.trip_id)))) sq2
     JOIN api.trips_info ti2 ON (((ti2.trip_id = sq2.trip_id) AND (ti2.vehicle_last_updated > (CURRENT_TIMESTAMP - '00:35:00'::interval)))))
  WHERE ((sq2.arrival > (CURRENT_TIMESTAMP - '01:00:00'::interval)) AND (sq2.arrival < (CURRENT_TIMESTAMP + '01:00:00'::interval)));


ALTER TABLE thebus.active_buses OWNER TO postgres;

--
-- Name: vehicle_info_audit audit_entry; Type: DEFAULT; Schema: api; Owner: postgres
--

ALTER TABLE ONLY api.vehicle_info_audit ALTER COLUMN audit_entry SET DEFAULT nextval('api.vehicle_info_audit_audit_entry_seq'::regclass);


--
-- Name: vehicle_info pg_audit_vehicle_info; Type: TRIGGER; Schema: api; Owner: postgres
--

CREATE TRIGGER pg_audit_vehicle_info AFTER INSERT OR DELETE OR UPDATE ON api.vehicle_info FOR EACH ROW EXECUTE FUNCTION api.tg_audit_vehicle_info();



--
-- Name: gtfs.backup_gtfs() Moves current gtfs tables to table_name_timestamp for future refrence.
--
CREATE OR REPLACE FUNCTION gtfs.backup_gtfs()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
	declare 
		log_file   text;
		gtfs_table text;
		gtfs_table_new_name text;
		gtfs_tables_c cursor for select
								   table_name 
								 from
								   information_schema.tables
								 where table_schema = 'gtfs'
								 and table_name ~ '^[^0-9]+$'
								 and table_name <> 'config'
								and table_type = 'BASE TABLE';
begin
	log_file := concat(log_file || 'Starting\n');
	open gtfs_tables_c;

	loop
		fetch gtfs_tables_c into gtfs_table;
		exit when not found;
		gtfs_table_new_name = concat(gtfs_table, '_', to_char(now(), 'YYYYMMDDhh24miss'));


		raise notice 'EXEC: Create table gtfs_backup.% (LIKE gtfs.% including all)', gtfs_table_new_name, gtfs_table;
		log_file := concat(log_file, format('EXEC: Create table gtfs_backup.%s (LIKE gtfs.%s including all)', gtfs_table_new_name, gtfs_table), E'\n');
     	execute format('CREATE TABLE gtfs_backup.%s (LIKE gtfs.%s including all)', gtfs_table_new_name, gtfs_table);
     
     
		raise notice 'EXEC: TRUNCATE gtfs.%', gtfs_table;
		log_file := concat(log_file, format('EXEC: TRUNCATE gtfs.%s', gtfs_table), E'\n');
		execute format('TRUNCATE gtfs.%s', gtfs_table);

	end loop;
	


	return log_file;
end

$function$
;


CREATE TABLE gtfs.files (
    version text,
    date date,
    link text,
    file bytea NULL,
    consumed boolean default false,
    primary key (version, date)
)
;

alter table gtfs.files owner to postgres;