//@ts-ignore
// @ts-ignore
import('log-timestamp');
import { BusInfo, getandInsertBusType } from './types.js';
import moment from 'moment';
import { getAllActiveBusses } from './sql.js';
import updateArrivals from './arrivals.js';
import pool from './db.js';
import { getandInsertBus } from './vehicles.js';
import { gtfs } from './gtfs.js';

let activeBusses: { vehicle_name: string }[] = [];
let bussesDataHash: {
  [busName: string]: BusInfo;
} = {};

const locks = {
  arrivalsChecked: false,
  gtfsRunning: false,
};

/** Variables */
// in seconds
const BUS_UPDATE_DEFAULT_UPDATE_INTERVAL = 60;
const IN_USE_UPDATE_INTERVAL = 10;
const BUS_UPDATE_FUTURE_UPDATE_NOT_FOUND = 60 * 15;
const TIME_UNTIL_NEXT_ACTIVE_BUSSES_CHECK = 2000;

const arrivals = async () => {
  const timeoutMinutes = 15;

  // Make sure that when GTFS is loading, nothing else is running.
  while (locks.gtfsRunning === true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  locks.arrivalsChecked === false
    ? console.log('[main] Initializing arrivals.')
    : console.log('[main] Updating arrivals.');
  locks.arrivalsChecked = false;
  await updateArrivals();

  console.log('[main] getting active busses.');
  activeBusses = await getAllActiveBusses();
  console.log(`[main] ${activeBusses.length} active busses.`);

  if (locks.arrivalsChecked === false) {
    locks.arrivalsChecked = true;
  }

  console.log(`[main] Next arrivals update in ${timeoutMinutes} minutes.`);
  setTimeout(arrivals, timeoutMinutes * (1000 * 60));
};

const runGTFS = async () => {
  // Get time until 2AM HST
  let NEXT_TWO_AM_HST = moment().utc().startOf('day').add(12, 'hours');
  const now = moment().utc();
  if (moment(NEXT_TWO_AM_HST).isBefore(now)) NEXT_TWO_AM_HST = NEXT_TWO_AM_HST.add(1, 'days');
  const timeoutMinutes = Math.floor(moment.duration(NEXT_TWO_AM_HST.diff(now)).asMinutes());

  console.log('[main] GTFS Start.');
  locks.gtfsRunning = true;
  await gtfs();
  console.log('[main] GTFS Done');
  locks.gtfsRunning = false;

  console.log(`[main] Next GTFS check in ${timeoutMinutes} minutes.`);

  setTimeout(runGTFS, timeoutMinutes * (1000 * 60));
};

const updateBusses = async () => {
  let upsertCount = 0;

  console.log('[vehicles] Updating active busses.');

  // Make sure that when GTFS is loading, nothing else is running.
  // Wait on arrivals to finish before getting bus info, otherwise there would be no active busses.
  while (locks.gtfsRunning === true && locks.arrivalsChecked === false) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const promises: Promise<getandInsertBusType>[] = [];

  // Loop through active busses and getandInsertBus() each into a promise.
  for (let activeBus of activeBusses) {
    // If vehicleName not in hash, it's brand new just run it.
    if (!bussesDataHash.hasOwnProperty(activeBus.vehicle_name)) {
      promises.push(getandInsertBus(activeBus.vehicle_name));
      continue;
    } else {
      if (new Date(bussesDataHash[activeBus.vehicle_name]!.lastUpdated.getTime()) <= new Date()) {
        promises.push(getandInsertBus(activeBus.vehicle_name));
      }
    }
  }

  let data = await Promise.all(promises);
  for (let result of data) {
    // Unable to upsert. errorMessage gives reason, if it's 'Could not find', set the next update to a longer interval.
    if (result.upsertStatus === false) {
      console.log(`[vehicles] ${result.busNumber} - ${result.errorMessage}`);

      // If it cannot find the vehicle, input it into the hash with a nextUpdate in the future so it's not being
      // queried every time.
      if (result.errorMessage?.includes('Could not find')) {
        bussesDataHash[result.busNumber] = {
          lastUpdated: new Date(moment().add(BUS_UPDATE_FUTURE_UPDATE_NOT_FOUND, 'seconds').toDate()),
        };
      }

      if (result.errorMessage === 'No active trips scheduled') {
        bussesDataHash[result.busNumber] = {
          lastUpdated: new Date(moment().add(BUS_UPDATE_FUTURE_UPDATE_NOT_FOUND, 'seconds').toDate()),
        };
      }
      continue;
    }

    // Get the latest heartbeat of the vehicle.
    let lastUpdated = moment(result.vehicle![0].last_message, 'MM/DD/YYYY hh:mm:ss A').toDate();
    result.vehicle!.forEach((res) => {
      let heartbeat = moment(res.last_message, 'MM/DD/YYYY hh:mm:ss A').toDate();
      if (heartbeat > lastUpdated) lastUpdated = heartbeat;
    });

    // If bus is in use, set next update to IN_USE_UPDATE_INTERVAL instead of BUS_UPDATE_DEFAULT_UPDATE_INTERVAL.
    // testing
    // This is where we would implement inUse - if someone is actually looking at this bus, set the update interval
    // to 10 seconds instead of the default.
    // if (result.inUse === true) {
    bussesDataHash[result.busNumber] = {
      vehicleInfo: result.vehicle!,
      lastUpdated: moment(lastUpdated).add(BUS_UPDATE_DEFAULT_UPDATE_INTERVAL, 'seconds').toDate(),
    };

    upsertCount++;
  }

  console.log(`[vehicles] ${upsertCount} upserts.`);
  setTimeout(updateBusses, TIME_UNTIL_NEXT_ACTIVE_BUSSES_CHECK);
};

const main = async () => {
  console.log('Starting main.ts');

  locks.gtfsRunning = true;

  runGTFS();

  while (locks.gtfsRunning === true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  arrivals();

  // Wait on arrivals to finish before getting bus info, otherwise there would be no active busses.
  while (locks.arrivalsChecked === false) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  updateBusses();
};

main();
