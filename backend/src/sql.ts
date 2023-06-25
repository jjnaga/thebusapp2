import { UpsertVehicleInfoData, gtfsFilesUpsertData } from './types.js';
import { queryWithPermanentClient } from './db.js';

export const setTripsInfoActiveToFalse = (): string => {
  let sql = `UPDATE api.trips_info
             SET active = false`;
  return sql;
};

export const upsertTripsInfoSQL = (): string => {
  let sql = `insert into api.trips_info (
    trip_id,
    canceled, 
    vehicle_number, 
    route,
    active)
  values (
    $1,
    $2::boolean,
    $3,
    $4,
    true) 
  on conflict (trip_id) 
  do update
  set
    vehicle_number = EXCLUDED.vehicle_number,
    vehicle_last_updated = current_timestamp,
    active = true
  RETURNING *`;
  return sql;
};

export const upsertBusInfoSQL = (values: UpsertVehicleInfoData) => {
  let sql = `INSERT INTO 
                 api.vehicle_info (
                     number, 
                     driver, 
                     latitude, 
                     longitude, 
                     adherence, 
                     last_message, 
                     route
                 )
  VALUES (
    '${values.number}', 
    ${values.driver},
    ${values.latitude},
    ${values.longitude},
    ${values.adherence},
    '${values.lastMessage}',
    '${values.route}')
  ON CONFLICT (number) DO
  UPDATE
  SET driver = EXCLUDED.driver,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      adherence = EXCLUDED.adherence,
      last_message = EXCLUDED.last_message,
      updated_on = current_timestamp,
      route = EXCLUDED.route
  `;
  return sql;
};

export const apiCountForToday = (): string => {
  let sql = `select coalesce((
              select
                "hits"
              from
                api.api_hits_count ahc
              where
                "date" = current_date), 0) "api_count";
                `;
  return sql;
};

export const getAllActiveBuses = (): string => {
  let sql = `select distinct ti.vehicle_number
              from
                api.trips_info ti
              where
                active = true
                and ti.route = '3'
              `;
  return sql;
};

export const updateAPICount = () => {
  let sql = `insert into api.api_hits_count 
      values (date(timezone('HST', now())), 1)
      on conflict("date") DO
      update 
      set hits = api.api_hits_count.hits + 1`;
  return sql;
};

export const copyGTFSTableFromFile = (fileName: string, tableColumns: string) => {
  let sql = `COPY gtfs.${fileName}_staging (
    ${tableColumns}           
  )
  from '/docker-entrypoint-initdb.d/${fileName}_staging.csv' 
  with (format csv, delimiter ',')`;
  return sql;
};

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
