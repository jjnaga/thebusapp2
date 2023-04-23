// @ts-ignore
import('log-timestamp');
import Pool from 'pg-pool';
import { Client, PoolClient, QueryResult } from 'pg';
import { Arrivals, TripInfo, TripInfoTransaction } from './types';
import pLimit from 'p-limit';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import moment from 'moment-timezone';

const pool: Pool<Client> = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'postgres',
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const insertArrivals = async (json: Arrivals) => {
  if ('arrival' in json === false) return 0;

  let numUpdates = 0;

  const sql = `
  insert into api.trips_info (
    trip_id,
	  vehicle_name)
  values (
    $1,
    $2) 
  on conflict (trip_id) 
  do update
  set
    vehicle_name = EXCLUDED.vehicle_name,
    vehicle_last_updated = current_timestamp
  where
    trips_info.vehicle_name <> EXCLUDED.vehicle_name
  RETURNING *`;

  const promises: Array<Promise<TripInfoTransaction | null>> = [];

  for (const arr of json.arrival) {
    promises.push(
      new Promise<TripInfoTransaction | null>((resolve) => {
        pool.query(sql, [arr.trip, arr.vehicle]).then((res) => {
          if (json.stop === 983 && res.rows.length > 0) {
            console.log(arr);
          }

          res.rows.length > 0
            ? resolve({ command: res.command, data: res.rows[0] })
            : resolve(null);
        });
      })
    );
  }

  let results = await Promise.all(promises);
  for (const res of results) {
    if (res === null) continue;
    numUpdates++;

    console.log(
      `[${res.command}] Trip ID ${res.data.trip_id}: Bus ${
        res.command === 'INSERT' ? 'Inserted' : 'Updated'
      } - ${res.data.vehicle_name}`
    );
  }
  return numUpdates;
};

const getBusArrivalsJSON = (
  stopID: string
): Promise<{ stopID: string; numUpdates: number }> => {
  const url = `http://api.thebus.org/arrivals/?key=6A9D054D-9D15-458F-95E2-38A2DC10FB85&stop=${stopID}`;
  const parser = new XMLParser();

  return fetch(url)
    .then((res) => res.text())
    .then((xml) => parser.parse(xml))
    .then(async (json) => {
      let updateCount = await insertArrivals(json.stopTimes);
      return { stopID: stopID, numUpdates: updateCount };
    });
};

const getAllStops = (): Promise<any[]> => {
  return pool.query(`SELECT stop_id from gtfs.last_stops`).then((res) => {
    return res.rows;
  });
};

const main = async () => {
  console.log('Starting');
  const limit = pLimit(10);
  const stops = await getAllStops();

  const promises = [];

  for (let stop of stops) {
    promises.push(limit(() => getBusArrivalsJSON(stop.stop_id)));
  }

  const stopResults = await Promise.all(promises);
  for (let stop of stopResults) {
    console.log(
      `Stop ${stop.stopID.padStart(4, ' ')}: ${stop.numUpdates} ${
        stop.numUpdates === 1 ? 'update' : 'updates'
      }`
    );
  }

  pool.end();
  console.log('Done');
};

main();
