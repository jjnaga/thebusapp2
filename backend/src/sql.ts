import { gtfsFilesUpsertData } from './types.js';
import pool from './db.js';

///@ts-ignore
export const upsertTripsInfoSQL = `
insert into api.trips_info (
  trip_id,
  canceled, 
  vehicle_name)
values (
  $1,
  $2::boolean,
  $3) 
on conflict (trip_id) 
do update
set
  vehicle_name = EXCLUDED.vehicle_name,
  previous_vehicle_name = trips_info.vehicle_name,
  vehicle_last_updated = current_timestamp
where trips_info.vehicle_name <> EXCLUDED.vehicle_name
RETURNING *`;

const bus_info = `
CREATE TABLE 
`;

///@ts-ignore
export const upsertBusInfoSQL = `
  INSERT INTO api.vehicle_info (bus_number, trip, driver, latitude, longitude, adherence, last_message, route, headsign)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
  ON CONFLICT (bus_number, trip) DO
  UPDATE
  SET trip = EXCLUDED.trip,
      driver = EXCLUDED.driver,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      adherence = EXCLUDED.adherence,
      last_message = EXCLUDED.last_message,
      route = EXCLUDED.route,
      headsign = EXCLUDED.headsign
  `;

export const getAllActiveBusses = (): Promise<any[]> => {
  return pool.query(`SELECT vehicle_name from thebus.active_busses`).then((res) => {
    return res.rows;
  });
};

export const updateAPICount = () => {
  pool.query(`
    insert into api.api_hits_count 
    values (date(timezone('HST', now())), 1)
    on conflict("date") DO
    update 
    set hits = api_hits_count.hits + 1;
  `);
};

export const copyGTFSTableFromFile = (fileName: string, tableColumns: string) => `
  COPY gtfs.${fileName}_staging (
    ${tableColumns}           
  )
  from '/docker-entrypoint-initdb.d/${fileName}_staging.csv' 
  with (format csv, delimiter ',')
`;

export const copyStagingTabletoTable = (fileName: string, tableSchema: any) => {
  let primaryKeys = tableSchema.reduce((accumulator: any, current: any) => {
    if (current.primary_key === true) accumulator += `${current.column_name},`;
    return accumulator;
  }, '');

  // Remove the last comma
  primaryKeys = primaryKeys.replace(/,\s*$/, '');

  // prettier-ignore
  let sql = 
  `INSERT INTO gtfs.${fileName}
  SELECT 
    *
  FROM gtfs.${fileName}_staging
  on conflict (${primaryKeys})
  DO UPDATE
  SET
    ${tableSchema
      .reduce((accumulator: any, current: any) => {
        if (current.primary_key === false)
          accumulator += `${current.column_name} = excluded.${current.column_name},\n`;
        return accumulator;
      }, '')
      .replace(/,\s*$/, '')}
  `;
  return sql;
};

export const tableColumnInformation = `

with table_columns as (
  select
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      c.ordinal_position
  from
      information_schema.columns c
  where
    c.table_schema = 'gtfs'
    and c.table_name ~ '^((?![0-9]).)*$'
    and c.table_name ~ '^((?!staging).)*$'
    and c.column_name <> 'id'
)
  select
    table_columns.*, 
    case
      when pk.attname is not null 
      then true
      else false
    end as primary_key
  from
    table_columns
  left join (
    select
      attname,
      conrelid
    from
      pg_constraint as con
    cross join lateral unnest(con.conkey) as cols(colnum)
      -- conkey is a list of the columns of the constraint; so we split it into rows so that we can join all column numbers onto their names in pg_attribute
    inner join pg_attribute as a on
      a.attrelid = con.conrelid
        and cols.colnum = a.attnum
      where
        con.contype = 'p'
  ) pk 
  on
    pk.conrelid = (table_columns.table_schema || '.' || table_columns.table_name)::REGCLASS
    and table_columns.column_name = pk.attname
  order by
      table_columns.table_name,
      table_columns.ordinal_position
  `;

export const gtfsFilesUpsert = (gtfsData: gtfsFilesUpsertData) => {
  // prettier-ignore
  let sql = 
    `insert into 
      gtfs.files (${Object.keys(gtfsData)})
    VALUES 
      (${Object.values(gtfsData).reduce((accumulator: any, current: any, index: number) => {
        if (index === 0) {
          accumulator += `to_date('${current}', 'DD Month YYYY'),`
          return accumulator;
        }

        accumulator += `'${current}',`;
        return accumulator;
      }, '')
      .replace(/,\s*$/, '')})
    ON CONFLICT DO NOTHING`;
  return sql;
};
