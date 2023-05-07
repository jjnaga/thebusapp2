import { query } from './db.js';

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
  return query(`SELECT vehicle_name from thebus.active_busses`).then((res) => {
    return res.rows;
  });
};
