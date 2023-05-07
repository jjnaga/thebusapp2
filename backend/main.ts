//@ts-ignore
// @ts-ignore
import('log-timestamp');
import { BusInfo, getandInsertBusType } from './types.js';
import moment from 'moment-timezone';
import { getAllActiveBusses } from './sql.js';
import { updateArrivals } from './arrivals.js';
import { getandInsertBus } from './vehicles.js';

let activeBusses: { vehicle_name: string }[] = [];
let bussesDataHash: {
  [busName: string]: BusInfo;
} = {};

const locks = {
  arrivalsChecked: false,
};

const arrivals = async () => {
  const timeoutMinutes = 15;

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

const updateBusses = async () => {
  // in milliseconds
  const DEFAULT_UPDATE_INTERVAL = 60;
  const IN_USE_UPDATE_INTERVAL = 10;
  const NOT_FOUND_FUTURE_UPDATE = 60 * 15;
  // in milliseconds

  const timeOutMilliseconds = 2000;
  let upsertCount = 0;

  console.log('[vehicles] Updating active busses.');

  // Wait on arrivals to finish before getting bus info, otherwise there would be no active busses.
  while (locks.arrivalsChecked === false) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const promises: Promise<getandInsertBusType>[] = [];

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
    if (result.upsertStatus === false) {
      console.log(`[vehicles] ${result.busNumber} - ${result.errorMessage}`);

      // If it cannot find the vehicle, input it into the hash with a nextUpdate in the future so it's not being
      // queried every time.
      if (result.errorMessage?.includes('Could not find')) {
        bussesDataHash[result.busNumber] = {
          lastUpdated: new Date(moment().add(NOT_FOUND_FUTURE_UPDATE, 'seconds').toDate()),
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

    // If bus is in use, set next update to IN_USE_UPDATE_INTERVAL instead of DEFAULT_UPDATE_INTERVAL.
    // testing
    // if (result.inUse === true) {
    if (result.busNumber === '963') {
      bussesDataHash[result.busNumber] = {
        vehicleInfo: result.vehicle!,
        lastUpdated: moment(lastUpdated).add(IN_USE_UPDATE_INTERVAL, 'seconds').toDate(),
      };
    } else {
      bussesDataHash[result.busNumber] = {
        vehicleInfo: result.vehicle!,
        lastUpdated: moment(lastUpdated).add(DEFAULT_UPDATE_INTERVAL, 'seconds').toDate(),
      };
    }

    upsertCount++;
  }

  console.log(`[vehicles] ${upsertCount} upserts.`);
  // let timeStamp = moment()
  //   .add(timeOutMilliseconds / 1000, 'seconds')
  //   .format('LTS');
  // console.log(`Next Update: ${timeStamp}`);
  setTimeout(updateBusses, timeOutMilliseconds);
};

const main = async () => {
  console.log('Starting');
  arrivals();

  // Wait on arrivals to finish before getting bus info, otherwise there would be no active busses.
  while (locks.arrivalsChecked === false) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  updateBusses();
};

main();
