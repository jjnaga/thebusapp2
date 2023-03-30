/**
 * 1. Get all busses where average_update is less than SYSDATE - average_update < last_update
 *
 * 2. For every bus_needs_update, poll thebus API /bus{bus_needs_update<-bus.id}
 *
 */
const { Pool, Client } = require('pg');
const { getAllActiveBusses, updateBusMutation } = require('./sql');
import type { Bus, BusUpdateStatus } from './types';

const getBusDate = (bus: Bus) => {};

//ts-ignore
const updateBus = (bus: Bus): Promise<BusUpdateStatus> => {
  let vehicle_data = `https://thebus.com/api/daijobu_soon/vehicle_data/${bus.id}`;

  return new Promise(async (resolve) => {
    console.log('starting fetch');
    let newBus = fetch(vehicle_data)
      .then((res) => res.json())
      .then((data) => {
        console.log('fetch resolved');
        return {
          id: bus.id,
          last_updated: new Date(),
          bus_needs_update: false,
        };
      });

    console.log('starting bus update');
    Pool.query(updateBusMutation).then((res) => {
      // res needs to return a true that bus was updated.
      let busUpdated = false;
      console.log('query returned');
      if ((res.rows[0] = busUpdated)) {
        let status: BusUpdateStatus = {
          id: bus.id,
          updated: true,
        };
        resolve(status);
      } else {
        resolve(false);
      }
    });
  });
};

const query = async (client, query): Promise<Array<Bus>> => {
  try {
    // const res = await client.query('SELECT * FROM users WHERE id = $1', [1);
    const res = await client.query(getAllActiveBusses);
    return res.rows;
  } catch (err) {
    console.log(err.stack);
  } finally {
    client.release();
  }
};

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 1. Get all busses that need an update.
const main = async () => {
  let client = await pool.connect();
  let getAllActiveBussesPromise = query(client, getAllActiveBusses);

  // 1a. Send Update mutations with the latest data from theBus API.
  let activeBusses = await getAllActiveBussesPromise;
  console.log('activeBussess: ', activeBusses);

  let promises: Array<Promise<BusUpdateStatus>> = [];
  activeBusses.forEach((bus) => {
    console.log('in for each');
    promises.push(updateBus(bus));

    Promise.all(promises).then((res) => {
      console.log(res);
      // figure out how to check that all updates return GOOD, and rerun on the updates that are BAD
      //if (res.anyFalse()) {
      //   allFalseBusses.forEach(bus => {
      //     updateBadBus();
      //   })
      // }
    });
  });
};

main();
