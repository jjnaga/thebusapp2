// @ts-ignore
import('log-timestamp');
import { ActiveBus, VehicleData, getandInsertBusType, processVehicleDataType } from './types.js';
import util from 'util';
import moment from 'moment';
import { apiCountForToday, getAllActiveBuses } from './sql.js';
import updateArrivals from './arrivals.js';
import { getClient, query } from './db.js';
import { processVehicle } from './vehicles.js';
import { runGTFS } from './gtfs.js';
import { QueryResult } from 'pg';
import pgp from 'pg-promise';
import PQueue from 'p-queue';

/** Variables */
// in seconds
const debug = true;
const BUS_UPDATE_DEFAULT_UPDATE_INTERVAL = 15;
const IN_USE_UPDATE_INTERVAL = 10;
const BUS_UPDATE_FUTURE_UPDATE_NOT_FOUND = 60 * 15;
const TIME_UNTIL_NEXT_ACTIVE_BUSSES_CHECK = 2000;
// this is set by TheBus
const MAX_API_COUNTS_PER_DAY = 250000;
const ARRIVALS_TIMEOUT_INTERVAL_MINUTES = 20;
const MAX_VEHICLE_DATA_RECORDS = 10;

const queue = new PQueue({ concurrency: 12 });
const vehiclesProcessing: Promise<processVehicleDataType>[] = [];

let vehiclesData = new Map<string, VehicleData>();

const locks = {
  arrivalsRunning: false,
  gtfsRunning: false,
  limitCheckRunning: false,
  limitReachedAPI: false,
};

let gtfsTimeout: any, arrivalsTimeout: any, vehiclesTimeout: any;

// arrivals.ts updates api.trips_info, which also determines which vehicles are active. Get all active vehicles,
// and update/remove from vehiclesData accordingly.
const arrivals = async () => {
  // Make sure that when GTFS is loading, nothing else is running.
  while (locks.gtfsRunning === true) {
    console.log('[main] Arrivals: GTFS is running. Waiting.');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Variables
  let startTime = moment();
  let busesAdded = 0;
  let busesRemoved = 0;
  // Variables

  locks.arrivalsRunning = true;

  await updateArrivals();

  // Get active buses previously set by updateArrivals();
  let activeBuses = new Map<string, true>();
  await query(getAllActiveBuses(), [])
    .then((res) => res.rows.map((row) => String(row.vehicle_number)))
    .then((vehicleNumbers) => {
      vehicleNumbers.forEach((vehicleNumber) => activeBuses.set(vehicleNumber, true));
    })
    .catch((err) => {
      throw new Error('getAllActiveBuses: ' + err);
    });

  for (const [vehicleNumber, _] of activeBuses.entries()) {
    // Initialize bus data if not set.
    if (!vehiclesData.has(vehicleNumber)) {
      let vehicleData: VehicleData = {
        vehicleNumber: vehicleNumber,
        isBeingUpdated: false,
        updateFrequency: BUS_UPDATE_DEFAULT_UPDATE_INTERVAL,
        vehicleInfo: [],
      };
      console.log(`[main] Arrivals: New Vehicle Added to vehiclesData: ${vehicleNumber}`);
      busesAdded++;
      vehiclesData.set(vehicleNumber, vehicleData);
    }
  }

  // Remove vehicle from vehiclesData if it is no longer active.
  for (const [vehicleNumber, _] of vehiclesData.entries()) {
    if (!activeBuses.has(vehicleNumber)) {
      console.log(`[main] Arrivals: Inactive vehicle removed from vehiclesData: ${vehicleNumber}`);
      busesRemoved++;
      vehiclesData.delete(vehicleNumber);
    }
  }

  console.log(`[main] Arrivals: Buses Added/Removed/Total: ${busesAdded}/${busesRemoved}/${vehiclesData.size}`);
  console.log(`[main] Arrivals: Next update in ${ARRIVALS_TIMEOUT_INTERVAL_MINUTES} minutes.`);
  console.log(`[main] Arrivals: Update duration: ${moment().diff(startTime) / 1000} seconds`);

  locks.arrivalsRunning = false;
  arrivalsTimeout = setTimeout(arrivals, ARRIVALS_TIMEOUT_INTERVAL_MINUTES * (1000 * 60));
};

const gtfs = async () => {
  // Get time until 2AM HST
  let NEXT_TWO_AM_HST = moment().utc().startOf('day').add(12, 'hours');
  const now = moment().utc();
  if (moment(NEXT_TWO_AM_HST).isBefore(now)) NEXT_TWO_AM_HST = NEXT_TWO_AM_HST.add(1, 'days');
  const timeoutMinutes = Math.floor(moment.duration(NEXT_TWO_AM_HST.diff(now)).asMinutes());

  console.log('[main] GTFS Start.');
  locks.gtfsRunning = true;
  await runGTFS();
  console.log('[main] GTFS Done');
  locks.gtfsRunning = false;

  console.log(`[main] Next GTFS check in ${timeoutMinutes} minutes.`);

  gtfsTimeout = setTimeout(gtfs, timeoutMinutes * (1000 * 60));
};

const vehicles = async () => {
  // Make sure that when GTFS is loading, nothing else is running.
  // Wait on arrivals to finish before getting bus info, otherwise there would be no active busses.
  while (locks.gtfsRunning === true && locks.arrivalsRunning === true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  let startTime = moment();
  let busesToUpdate: string[] = [];
  let vehiclesUpdated = 0;

  // Loop through vehiclesProcessing to determine if vehicles were done updating from previous run. Update vehiclesData
  // with results.
  console.log(`[main] Vehicles: Checking vehiclesProcessing: ${vehiclesProcessing.length}`);
  for (let i = 0; i < vehiclesProcessing.length; i++) {
    if (util.inspect(vehiclesProcessing[i]).includes('pending')) {
      console.log('pending');
    } else {
      await vehiclesProcessing[i].then((res) => {
        // vehicleData will always be defined - only buses in vehiclesData get sent to vehicles.ts
        // Note: If map.get() is an object, it returns a pointer to object.
        let vehicleData = vehiclesData.get(res.vehicleNumber)!;

        if (res.hasOwnProperty('vehicleInfo')) {
          vehicleData.vehicleInfo.push(res.vehicleInfo!);
        } else {
          console.log(`[main] Vehicles: ${res.vehicleNumber} - Error on updating: ${res.error}`);
        }

        console.log(`[main] Vehicles: ${res.vehicleNumber} - Done updating.`);
        vehicleData.isBeingUpdated = false;

        vehiclesProcessing.splice(i, 1);
      });
    }
  }

  // Cycle through buses and determine if any need API updates. For any buses that needs update (vehicleData.isBeingUpdated = false AND lastUpdated + updateInterval >= CURRENT_TIMESTAMP)
  for (const [vehicleNumber, vehicleData] of vehiclesData.entries()) {
    let updateInterval: number = 0;

    // If vehicle is locked, it is still being updated. Skip vehicle.
    if (vehicleData.isBeingUpdated) {
      if (debug) console.log(`[main] Vehicles: ${vehicleNumber} - Still Being Updated`);
      continue;
    }

    // If vehicle is new (no vehicleInfo[]), run updates.
    if (vehicleData.vehicleInfo.length === 0) {
      vehicleData.isBeingUpdated = true;
      if (debug) console.log(`[main] Vehicles: ${vehicleNumber} - Updating (Initial Run)`);
      vehiclesUpdated++;
      queue.add(() => vehiclesProcessing.push(processVehicle(vehicleData.vehicleNumber, null)));
      continue;
    }

    // Get the last update, and add the updateFrequency to it. Update only when this future timestamp has occured.
    let whenToUpdate = moment(vehicleData.vehicleInfo[vehicleData.vehicleInfo.length - 1].last_message).add(
      vehicleData.updateFrequency,
      'seconds'
    );
    let now = moment();

    console.log(`[main] Vehicles: ${vehicleNumber} - Update Frequency: ${vehicleData.updateFrequency}`);
    console.log(`[main] Vehicles: ${vehicleNumber} - Last Update: ${whenToUpdate.toISOString()}`);
    console.log(`[main] Vehicles: ${vehicleNumber} - Time until next update: ${whenToUpdate.diff(now, 'seconds')}`);

    if (now.isAfter(whenToUpdate)) {
      console.log(`[main] Vehicles: ${vehicleNumber} - Updating.`);
      vehicleData.isBeingUpdated = true;
      queue.add(() => vehiclesProcessing.push(processVehicle(vehicleData.vehicleNumber, whenToUpdate)));
      vehiclesUpdated++;

      // Truncate older timestamps, leave only the most recent MAX_VEHICLE_DATA_RECORDS.
      vehicleData.vehicleInfo.splice(0, vehicleData.vehicleInfo.length - MAX_VEHICLE_DATA_RECORDS);

      let busUpdateTimestamps = vehiclesData
        .get(vehicleNumber)!
        .vehicleInfo.map((vehicleInfo) => vehicleInfo.last_message);
      let average = 0;

      // Get the interval to update. If there is prior data, get the max interval between updates. If no data, use
      // the default.
      // Max Interval: The max interval will be the safest interval with the highest probability of an update. The other
      // number to use would be the average of intervals, but there will be a higher chance the API hasn't been updated
      // and API will have to be called multiple times.
      if (busUpdateTimestamps.length >= 2) {
        console.log(`[main] Vehicles: ${vehicleNumber} - Timestamps - ${busUpdateTimestamps}`);
        for (let i = 1; i < busUpdateTimestamps.length; i++) {
          let lastTimestamp = moment(busUpdateTimestamps[i - 1], 'MM/DD/YYYY hh:mm:ss A');
          let currentTimestamp = moment(busUpdateTimestamps[i], 'MM/DD/YYYY hh:mm:ss A');
          let differenceInSeconds = currentTimestamp.diff(lastTimestamp, 'seconds');
          if (debug)
            console.log(`[main] Vehicles: ${vehicleNumber} - Index #${i},  Difference = ${differenceInSeconds}`);
          updateInterval = Math.max(updateInterval, differenceInSeconds);
        }
        if (debug) console.log(`[main] Vehicles: ${vehicleNumber} - Max Update Interval is ${updateInterval}`);
      } else {
        if (debug)
          console.log(
            `[main] Vehicles: ${vehicleNumber} - Update Interval is Default. Need more data. # of Bus Datasets: ${busUpdateTimestamps.length}`
          );
        updateInterval = BUS_UPDATE_DEFAULT_UPDATE_INTERVAL;
      }

      vehicleData.updateFrequency = updateInterval;
    } else {
      console.log(`[main] Vehicles: ${vehicleNumber} - Not Updating.`);
    }
  }

  let runtime = moment().diff(startTime) / 1000;
  console.log(`[main] Vehicles: ${vehiclesUpdated} updates. Transaction Time: ${runtime} seconds.`);
  vehiclesTimeout = setTimeout(vehicles, TIME_UNTIL_NEXT_ACTIVE_BUSSES_CHECK);
};

const checkIfAPILimitReached = async () => {
  locks.limitCheckRunning = true;
  let res: QueryResult;
  let countAPI: number;
  try {
    res = await query(apiCountForToday(), []);
  } catch (err) {
    throw new Error('API Count Query: ' + err);
  }
  countAPI = res.rows[0]['api_count'];
  console.log(`[main] API hits: ${countAPI}`);

  // Play it safe, if it gets to 95%, end it.
  if (countAPI >= MAX_API_COUNTS_PER_DAY * 0.95) {
    locks.limitReachedAPI = true;
    console.log(`[main] API limit reached: ${countAPI}`);
    console.log(`Pausing until next day when API count resets.`);
    clearTimeout(gtfsTimeout);
    clearTimeout(arrivalsTimeout);
    clearTimeout(vehiclesTimeout);

    while (locks.limitReachedAPI) {
      let res: QueryResult;
      try {
        res = await query(apiCountForToday(), []);
        countAPI = res.rows[0]['api_count'];
      } catch (err) {
        throw new Error('API Count Query: ' + err);
      }
      if (countAPI !== 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 60));
        console.log(`[main] Paused.`);
      } else {
        locks.limitReachedAPI = false;
        console.log(`[main] API count reset. Resuming.`);
        main();
      }
    }
  } else {
    locks.limitCheckRunning = false;
    setTimeout(checkIfAPILimitReached, 1000 * 60);
  }
  // setTimeout(checkIfAPILimitReached, 1000 * 60 * 15);
};

const main = async () => {
  checkIfAPILimitReached();
  console.log('Starting main.ts');
  // DEBUG: Monitor pg_stat_activity

  while (locks.limitCheckRunning === true) {
    if (locks.limitReachedAPI === true) {
      console.log(`[main] Ending main() call`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  locks.gtfsRunning = true;
  gtfs();

  while (locks.gtfsRunning === true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  arrivals();

  // Wait on arrivals to finish before getting bus info, otherwise there would be no active busses.
  while (locks.arrivalsRunning === true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  vehicles();
};

main();
