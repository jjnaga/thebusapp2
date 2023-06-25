// @ts-ignore
import('log-timestamp');
import axios, { isCancel, AxiosError, AxiosResponse } from 'axios';
import { query, getClient, queryWithPermanentClient, poolDebug } from './db.js';
import { Arrivals, GetArrivalsJSONReturn, TripInfoTransaction } from './types.js';
import pLimit from 'p-limit';
import { XMLParser } from 'fast-xml-parser';
import { setTripsInfoActiveToFalse, updateAPICount, upsertTripsInfoSQL } from './sql.js';
import moment from 'moment';
import pgp from 'pg-promise';
import * as dotenv from 'dotenv';
import { PoolClient } from 'pg';

const tripsTracker = new Map();
dotenv.config();

const insertArrivals = async (json: Arrivals): Promise<number> => {
  let numUpdates = 0;
  const promises: Array<Promise<TripInfoTransaction | null>> = [];

  for (const arr of json.arrival) {
    promises.push(
      new Promise<TripInfoTransaction | null>(async (resolve) => {
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
        // console.log(
        //   `[Arrivals] Pool Waiting/Idle/Total Count: ${pool.waitingCount}/${pool.idleCount}/${pool.totalCount}`
        // );
        let client: PoolClient;
        try {
          client = await getClient();
        } catch (err) {
          poolDebug();
          throw new Error(`Getting Client, insertArrivals: ${err}`);
        }

        client.query(upsertTripsInfoSQL(), [arr.trip, arr.canceled, arr.vehicle, arr.route], (err, res) => {
          client.release();
          if (err) {
            throw new Error(`[Arrivals] Error when querying cilent: ` + err);
          }
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
      `[arrivals] Stop ${String(json.stop).padStart(4, ' ')}: Trip ${
        res.data.trip_id
      } -  ${`Vehicle: ${res.data.vehicle_number}`}`
    );
  }
  return numUpdates;
};

// Get latest arrivals for a stop and send to insertArrivals() for insertion.
const getBusArrivalsJSON = (stopID: string): Promise<GetArrivalsJSONReturn> => {
  const url = `http://api.thebus.org/arrivals/?key=${process.env.API_KEY}&stop=${stopID}`;
  const parser = new XMLParser();

  queryWithPermanentClient(updateAPICount(), [], `arrivals - ${stopID}`);
  return axios
    .get(url, { responseType: 'text' })
    .then((res: AxiosResponse) => parser.parse(res.data))
    .then(async (json: any) => {
      // Skip insertArrivals() if there are no incoming busses for a stop.
      if ('arrival' in json.stopTimes === false) {
        return { stopID: stopID, numUpdates: 0 };
      } else {
        // If only one arrival for bus stop.
        if (!Array.isArray(json.stopTimes.arrival)) {
          json.stopTimes.arrival = [json.stopTimes.arrival];
        }

        // Update columns which may be numbers to strings.
        json.stopTimes.arrival.forEach((ele: any) => {
          ele.route = String(ele.route);
          ele.vehicle = String(ele.vehicle);
        });

        let updateCount = await insertArrivals(json.stopTimes);
        return { stopID: stopID, numUpdates: updateCount };
      }
    });
};

/**
 * Get bus stops to query.
 *
 * View 'first_and_last_stops_of_routes' returns distinct first and last stops of all routes.
 */
const getAllStops = (): Promise<any[]> => {
  return query(`SELECT stop_id from gtfs.first_and_last_stops_of_routes`, []).then((res) => {
    return res.rows;
  });
};

/**
 *  Initiate arrivals update. Get all stops, and send each stop to getBusArrivalsJSON() to retrieve active busses
 *  from each stop. Insert active busses into databases for querying and insertion.
 *
 *  Return: true on completion so main.ts can know all active busses are ready to be retrieved.
 */
const updateArrivals = (): Promise<boolean> =>
  new Promise(async (resolve) => {
    console.log('[arrivals] Inactivating all trips.');
    let client: PoolClient;
    try {
      client = await getClient();
    } catch (err) {
      poolDebug();
      throw new Error('UpdateArrivals - Error getting client: ' + err);
    }

    await client
      .query(setTripsInfoActiveToFalse(), [])
      .then((res) => {
        client.release();
        console.log(`[arrivals] All trips (${res.rowCount}) inactivated.`);
      })
      .catch((err) => {
        throw new Error('setTripsInfoActiveToFalse: ' + err);
      });

    console.log('[arrivals] Checking Arrivals API for assigned vehicles.');
    const limit = pLimit(18);
    let totalUpdates = 0;
    const stops = await getAllStops();

    const promises: Promise<GetArrivalsJSONReturn>[] = [];

    for (let stop of stops) {
      promises.push(limit(() => getBusArrivalsJSON(stop.stop_id)));
    }

    const stopResults = await Promise.all(promises);
    for (let stop of stopResults) {
      totalUpdates += stop.numUpdates;
      // if (stop.numUpdates > 0) {
      //   console.log(
      //     `[arrivals] Stop ${stop.stopID.padStart(4, ' ')}: ${stop.numUpdates} ${
      //       stop.numUpdates === 1 ? 'update' : 'updates'
      //     }`
      //   );
      // }
    }
    console.log(`[arrivals] Total Active Vehicles: ${totalUpdates}.`);

    resolve(true);
  });

export default updateArrivals;
