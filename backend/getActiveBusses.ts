// @ts-ignore
import('log-timestamp');
import Pool from 'pg-pool';
import { query, end } from './db.js';
import { Client, PoolClient, QueryResult } from 'pg';
import { Arrival, Arrivals, TripInfo, TripInfoTransaction } from './types';
import pLimit from 'p-limit';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import moment from 'moment-timezone';

const tripsTracker = new Map();

const insertArrivals = async (json: Arrivals): Promise<number> => {
  let numUpdates = 0;
  const promises: Array<Promise<TripInfoTransaction | null>> = [];

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
    previous_vehicle_name = trips_info.vehicle_name,
    vehicle_last_updated = current_timestamp
  where trips_info.vehicle_name <> EXCLUDED.vehicle_name
  RETURNING *`;

  for (const arr of json.arrival) {
    promises.push(
      new Promise<TripInfoTransaction | null>((resolve) => {
        // Trip still doesn't have a vehicle set if ???. Skip.
        if (arr.vehicle === '???') {
          resolve(null);
          return;
        }

        if (
          tripsTracker.get(arr.trip) === undefined ||
          tripsTracker.get(arr.trip) !== arr.vehicle
        ) {
          tripsTracker.set(arr.trip, arr.vehicle);
          query(sql, [arr.trip, arr.vehicle]).then((res) => {
            res.rows.length > 0
              ? resolve({ command: res.command, data: res.rows[0] })
              : resolve(null);
          });
        } else {
          resolve(null);
        }
      })
    );
  }

  let results = await Promise.all(promises);
  for (const res of results) {
    if (res === null) continue;
    numUpdates++;

    console.log(
      `[Trip ID ${res.data.trip_id}] ${
        res.data.previous_vehicle_name === null
          ? `Vehicle chosen: ${res.data.vehicle_name}`
          : `Vehicle updated: From ${res.data.previous_vehicle_name} to ${res.data.vehicle_name}`
      }`
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
      // Skip insertArrivals() if there are no incoming busses for a stop.
      if ('arrival' in json.stopTimes === false) {
        return { stopID: stopID, numUpdates: 0 };
      } else {
        let updateCount = await insertArrivals(json.stopTimes);
        return { stopID: stopID, numUpdates: updateCount };
      }
    });
};

const getAllStops = (): Promise<any[]> => {
  return query(`SELECT stop_id from gtfs.last_stops`).then((res) => {
    return res.rows;
  });
};

const main = async () => {
  console.log('Starting');
  const limit = pLimit(10);
  let totalUpdates = 0;
  const stops = await getAllStops();

  const promises = [];

  for (let stop of stops) {
    //if (stop.stopID !== '983') continue;
    promises.push(limit(() => getBusArrivalsJSON(stop.stop_id)));
  }

  const stopResults = await Promise.all(promises);
  for (let stop of stopResults) {
    totalUpdates += stop.numUpdates;
    if (stop.numUpdates > 0) {
      console.log(
        `Stop ${stop.stopID.padStart(4, ' ')}: ${stop.numUpdates} ${
          stop.numUpdates === 1 ? 'update' : 'updates'
        }`
      );
    }
  }

  console.log(`Total Inserts/Updates: ${totalUpdates}`);

  end();
  console.log('Done');
};

main();
