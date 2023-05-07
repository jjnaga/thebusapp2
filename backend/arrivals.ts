// @ts-ignore
import('log-timestamp');
import { query, end } from './db.js';
import { Arrivals, GetArrivalsJSONReturn, TripInfoTransaction } from './types.js';
import pLimit from 'p-limit';
import { XMLParser } from 'fast-xml-parser';
import { updateAPICount, upsertTripsInfoSQL } from './sql.js';

const tripsTracker = new Map();

const insertArrivals = async (json: Arrivals): Promise<number> => {
  let numUpdates = 0;
  const promises: Array<Promise<TripInfoTransaction | null>> = [];

  for (const arr of json.arrival) {
    promises.push(
      new Promise<TripInfoTransaction | null>((resolve) => {
        const hashValue = tripsTracker.get(arr.trip);

        // If hashValue is defined, and it's equal to vehicle, we already processed TripID => Vehicle. Skip.
        if (hashValue !== undefined && hashValue === arr.vehicle) {
          resolve(null);
          return;
        }

        // Trip still doesn't have a vehicle set if ???. Skip.
        if (arr.vehicle === '???') {
          resolve(null);
          return;
        }

        tripsTracker.set(arr.trip, arr.vehicle);
        query(upsertTripsInfoSQL, [arr.trip, arr.canceled, arr.vehicle]).then((res) => {
          res.rows.length > 0 ? resolve({ command: res.command, data: res.rows[0] }) : resolve(null);
        });
      })
    );
  }

  let results = await Promise.all(promises);
  for (const res of results) {
    if (res === null) continue;
    numUpdates++;

    console.log(
      `[arrivals] Trip ${res.data.trip_id} -  ${
        res.data.previous_vehicle_name === null
          ? `Vehicle chosen: ${res.data.vehicle_name}`
          : `Vehicle updated: From ${res.data.previous_vehicle_name} to ${res.data.vehicle_name}`
      }`
    );
  }
  return numUpdates;
};

// Get latest arrivals for a stop and send to insertArrivals() for insertion.
const getBusArrivalsJSON = (stopID: string): Promise<GetArrivalsJSONReturn> => {
  const url = `http://api.thebus.org/arrivals/?key=6A9D054D-9D15-458F-95E2-38A2DC10FB85&stop=${stopID}`;
  const parser = new XMLParser();

  updateAPICount();
  return fetch(url)
    .then((res) => res.text())
    .then((xml) => parser.parse(xml))
    .then(async (json) => {
      // Skip insertArrivals() if there are no incoming busses for a stop.
      if ('arrival' in json.stopTimes === false) {
        return { stopID: stopID, numUpdates: 0 };
      } else {
        // If only one arrival for bus stop.
        if (!Array.isArray(json.stopTimes.arrival)) {
          json.stopTimes.arrival = [json.stopTimes.arrival];
        }
        let updateCount = await insertArrivals(json.stopTimes);
        return { stopID: stopID, numUpdates: updateCount };
      }
    });
};

// Get bus stops to query.
const getAllStops = (): Promise<any[]> => {
  return query(`SELECT stop_id from gtfs.last_stops`).then((res) => {
    return res.rows;
  });
};

/**
 *  Initiate arrivals update. Get all stops, and send each stop to getBusArrivalsJSON() to retrieve active busses
 *  from each stop. Insert active busses into databases for querying and insertion.
 *
 *  Return: true on completion so main.ts can know all active busses are ready to be retrieved.
 */
const updateArrivals = (): Promise<boolean> => {
  let i = 0;
  while (i < 1000000) i++;

  // prettier-ignore
  return new Promise(async (resolve) => {
      console.log('[arrivals] Checking Arrivals API for new/updated assigned vehicles.');
      const limit = pLimit(10);
      let totalUpdates = 0;
      const stops = await getAllStops();

      const promises: Promise<GetArrivalsJSONReturn>[] = [];

      for (let stop of stops) {
        promises.push(limit(() => getBusArrivalsJSON(stop.stop_id)));
      }

      const stopResults = await Promise.all(promises);
      for (let stop of stopResults) {
        totalUpdates += stop.numUpdates;
        if (stop.numUpdates > 0) {
          console.log(
            `[arrivals] Stop ${stop.stopID.padStart(4, ' ')}: ${stop.numUpdates} ${
              stop.numUpdates === 1 ? 'update' : 'updates'
            }`
          );
        }
      }
      console.log(`[arrivals] Total Inserts/Updates: ${totalUpdates}`);

      resolve(true);
    })
};

export { updateArrivals };
