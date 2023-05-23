// @ts-ignore
import('log-timestamp');
import { query } from './db.js';
import { VehicleAPI, VehicleInfo, getandInsertBusType, upsertBusStatus } from './types.js';
import { XMLParser } from 'fast-xml-parser';
import pgp from 'pg-promise';
import moment from 'moment-timezone';
import * as dotenv from 'dotenv';
import { updateAPICount, upsertBusInfoSQL } from './sql.js';

dotenv.config();

// Upsert vehicle API data into DB.
const upsertBus = (bus: VehicleInfo, debug?: boolean): Promise<upsertBusStatus> => {
  //@ts-ignore
  let data = Object.keys(bus).map((key) => bus[key]);

  if (debug) {
    console.log('DEBUG ON for upsertBus()');
    const query = pgp.as.format(upsertBusInfoSQL, data);
    console.log(query);
  }

  return query(upsertBusInfoSQL, data).then((res) => {
    const status: upsertBusStatus = {
      upsertStatus: res.rowCount > 0 ? true : false,
      vehicleNumber: bus.number,
    };

    return status;
  });
};

// Query API. Parse data, upsert into DB, and return data so it can be stored in hash table.
const getandInsertBus = (busNumber: string): Promise<getandInsertBusType> => {
  const url = `http://api.thebus.org/vehicle/?key=${process.env.API_KEY}&num=${busNumber}`;
  const parser = new XMLParser();

  return new Promise((resolve) => {
    updateAPICount();
    fetch(url)
      .then((res) => res.text())
      .then((xml) => parser.parse(xml))
      .then(async (json) => {
        let data: VehicleAPI = json.vehicles;

        // JSON may just return errorMessage, no vehicle{}. Error looks like: Could not find vehicle "###"
        if (data.hasOwnProperty('errorMessage')) {
          resolve({ busNumber, errorMessage: data.errorMessage, upsertStatus: false });
          return;
        }

        if (data.vehicle !== undefined) {
          /**
           * If array, there are multiple trips for a vehicle. There are three possibilities:
           *  1. either one of the trips is old and invalid data. This can be verified by null_trip or an old
           *     timestamp,
           *  2. one bus is going to be making two different trips sequentially.
           *  3. there are multiple rows per vehicle, all null_trip. However, one is still active. It's sending data,
           *     there just is no scheduled trip planned.
           */
          if (!Array.isArray(data.vehicle)) {
            data.vehicle = [data.vehicle];
          } else {
            // console.log(`DEBUG: multiple vehicles found: ${busNumber}`);

            // Filter out errenous trips. Identifier is tripID is 'null_trip', instead of a number.
            data.vehicle = data.vehicle.filter((item) => typeof item.trip === 'number');

            // Check if filter filtered out everything. If so, return an error.
            if (data.vehicle.length === 0) {
              resolve({ busNumber, errorMessage: 'No active trips scheduled', upsertStatus: false });
              return;
            }
          }

          let promiseUpserts: Promise<upsertBusStatus>[] = [];
          for (let i = 0; i < data.vehicle.length; i++) {
            data.vehicle[i].last_message = moment(data.timestamp, 'MM/DD/YYYY hh:mm:ss A').toDate();
            promiseUpserts.push(upsertBus(data.vehicle[i]));
          }

          let upsertStatus = await Promise.all(promiseUpserts);
          if (upsertStatus.some((ele) => ele.upsertStatus === false)) {
            resolve({ busNumber, errorMessage: 'Upsert Failed', upsertStatus: false });
            return;
          } else {
            resolve({ busNumber, upsertStatus: true, vehicle: data.vehicle });
            return;
          }
        } else {
          resolve({ busNumber, errorMessage: 'JSON is undefined', upsertStatus: false });
          return;
        }
      });
  });
};

export { getandInsertBus };
