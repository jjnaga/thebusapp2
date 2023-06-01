//@ts-ignore
// @ts-ignore
import('log-timestamp');
import { BusInfo, getandInsertBusType } from './types.js';
import moment from 'moment';
import { getAllActiveBuses } from './sql.js';
import updateArrivals from './arrivals.js';
import pool from './db.js';
import { getandInsertBusesData } from './vehicles.js';
import { runGTFS } from './gtfs.js';

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
  let startTime = moment();
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

  if (locks.arrivalsChecked === false) {
    locks.arrivalsChecked = true;
  }

  let endTime = moment();
  let runtime = endTime.diff(startTime) / 1000;
  console.log(`[main] Next arrivals update in ${timeoutMinutes} minutes.`);
  setTimeout(arrivals, timeoutMinutes * (1000 * 60));
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

  setTimeout(gtfs, timeoutMinutes * (1000 * 60));
};

const vehicles = async () => {
  let startTime = moment();
  let upsertCount = 0;

  console.log('[main] Updating active busses.');

  // Make sure that when GTFS is loading, nothing else is running.
  // Wait on arrivals to finish before getting bus info, otherwise there would be no active busses.
  while (locks.gtfsRunning === true && locks.arrivalsChecked === false) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Get active buses that need to be updated.
  // Note: Query is in the thousandths of a second, it's fast.
  let activeBuses: string[] = await getAllActiveBuses(BUS_UPDATE_DEFAULT_UPDATE_INTERVAL);
  console.log(`[main] ${activeBuses.length} active buses need to be updated`);

  // Cycle through each bus, query API, and update DB.
  if (activeBuses.length > 0) {
    let data: getandInsertBusType[] = await getandInsertBusesData(activeBuses);
  }

  let endTime = moment();
  let runtime = endTime.diff(startTime) / 1000;
  //console.log(`[vehicles] ${upsertCount} upserts. Transaction Time: ${runtime} seconds.`);
  console.log(`[main] Updating active buses done. Transaction Time: ${runtime} seconds.`);
  setTimeout(vehicles, TIME_UNTIL_NEXT_ACTIVE_BUSSES_CHECK);
};

const main = async () => {
  console.log('Starting main.ts');
  // DEBUG: Monitor pg_stat_activity

  locks.gtfsRunning = true;

  gtfs();

  while (locks.gtfsRunning === true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  arrivals();

  // Wait on arrivals to finish before getting bus info, otherwise there would be no active busses.
  while (locks.arrivalsChecked === false) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  vehicles();
};

main();
