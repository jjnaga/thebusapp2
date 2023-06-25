// @ts-ignore
import('log-timestamp');
import axios, { AxiosResponse } from 'axios';
import { getClient, poolDebug, query, queryWithPermanentClient } from './db.js';
import {
  ActiveBus,
  UpsertVehicleInfoData,
  VehicleAPI,
  VehicleInfo,
  getandInsertBusType,
  processVehicleDataType,
  upsertBusStatus,
} from './types.js';
import { XMLParser } from 'fast-xml-parser';
import pLimit from 'p-limit';
import * as dotenv from 'dotenv';
import { updateAPICount, upsertBusInfoSQL } from './sql.js';
import { PoolClient } from 'pg';
import pgp from 'pg-promise';
import moment, { Moment } from 'moment';

dotenv.config();

// If there's issues with a bus, set the updateFrequency to a time in the future so it doesn't continuously
// attempt to poll.
const BUS_UPDATE_DEFAULT_ERROR_SECONDS = 60 * 5;
const BUS_UPDATE_NO_NEW_DATA = 60 * 1;
const AXIOS_REATTEMPT_AMOUNT = 3;
const IF_HICCUP_WAIT_N_SECONDS = 5;

// Upsert vehicle API data into DB.
const upsertVehicle = (vehicleInfo: VehicleInfo): Promise<{ error?: unknown; success: boolean }> => {
  return new Promise(async (resolve) => {
    let {
      number,
      driver,
      latitude,
      longitude,
      adherence,
      last_message: lastMessage,
      route_short_name: route,
    } = vehicleInfo;
    let sqlUpsertData: UpsertVehicleInfoData = {
      number,
      driver,
      latitude,
      longitude,
      adherence,
      lastMessage: lastMessage.toISOString(),
      route,
    };

    let sql = upsertBusInfoSQL(sqlUpsertData);

    let client: PoolClient;
    try {
      client = await getClient();
      client.query(sql).then((res) => {
        client.release();
        resolve({ success: true });
      });
    } catch (error) {
      poolDebug();
      // console.log(`[vehicles] upsertVehicle error: ${error}`);
      resolve({ success: false, error });
    }
  });
};

// Query API. Parse data, upsert into D(erB, and return data so it can be stored in hash table.
const processVehicle = (
  vehicleNumber: string,
  lastUpdatedTimestamp: Moment | null
): Promise<processVehicleDataType> => {
  return new Promise(async (resolve) => {
    const parser = new XMLParser();

    queryWithPermanentClient(updateAPICount(), [], `vehicles - ${vehicleNumber}`);
    let newData = false;
    let vehicle: VehicleInfo;
    // The only time this is used, is via the path where this gets updated accorindgly.
    let newUpdateFrequency: number = BUS_UPDATE_DEFAULT_ERROR_SECONDS;

    // Loop until lastMessage from DB and lastMessage from API are different (new bus update).
    const url = `http://api.thebus.org/vehicle/?key=${process.env.API_KEY}&num=${vehicleNumber}`;
    let attempts = 0;
    do {
      let res: AxiosResponse;
      try {
        attempts++;
        res = await axios.get(url, { timeout: 5000, responseType: 'text' });
      } catch (err) {
        console.error(
          `[vehicles] Error on fetch for  ${vehicleNumber}: ${err}. Waiting ${IF_HICCUP_WAIT_N_SECONDS} seconds`
        );
        await new Promise((resolve) => {
          setTimeout(resolve, IF_HICCUP_WAIT_N_SECONDS * 1000);
        });
        continue;
      }

      let json = parser.parse(res.data);
      let data: VehicleAPI = json.vehicles;
      let vehicles: VehicleInfo[];

      // JSON may just return errorMessage, no vehicle{}. Error looks like: Could not find vehicle "###"
      if (data.hasOwnProperty('errorMessage')) {
        let error = `[vehicles] Error on ${vehicleNumber}: ${data.errorMessage}`;
        console.log(error);
        resolve({ vehicleNumber, error });
        break;
      }

      if (data.vehicle == undefined) {
        console.log(`[vehicles] Error on ${vehicleNumber}: JSON is undefined.`);

        newUpdateFrequency = BUS_UPDATE_DEFAULT_ERROR_SECONDS;
        break;
      } else {
        /**
         * If array, there are multiple trips for a vehicle. There are three possibilities:
         *  1. either one of the trips is old and invalid data. This can be verified by null_trip or an old
         *     timestamp,
         *  2. one bus is going to be making two different trips sequentially.
         *  3. there are multiple rows per vehicle, all null_trip. However, one is still active. It's sending
         *     data, there just is no scheduled trip planned.
         */
        if (!Array.isArray(data.vehicle)) {
          vehicles = [data.vehicle];
        } else {
          vehicles = data.vehicle;
        }
      }

      // Filter out errenous trips. Identifier is tripID is 'null_trip', instead of a number.
      vehicles = vehicles.filter((item) => typeof item.trip === 'number');

      // Check if filter filtered out everything. If so, return an error, there is no valid data.
      if (vehicles.length === 0) {
        let error = `[vehicles] Error on ${vehicleNumber}: No valid data.`;
        console.log(error);

        resolve({ vehicleNumber, error });
        break;
      }

      // Querying vehicle API may result in multiple bus data. There are a variety of reasons - there could
      // be multiple trips planned per bus. Or one of the data sets is erroneous, or just older data. Get
      // the most recent last_message. If there is only one data set, return that set.
      let mostRecentBusData: VehicleInfo;
      if (vehicles.length > 1) {
        mostRecentBusData = vehicles.reduce((a, b) =>
          moment(a.last_message, 'MM/DD/YYYY hh:mm:ss A').isBefore(moment(b.last_message, 'MM/DD/YYYY hh:mm:ss A'))
            ? b
            : a
        );
      } else {
        mostRecentBusData = vehicles[0];
      }

      // Update last_message from string to Moment
      mostRecentBusData.last_message = moment(mostRecentBusData.last_message, 'MM/DD/YYYY hh:mm:ss A');

      if (lastUpdatedTimestamp !== null) {
        // API data has not been refreshed yet.
        if (mostRecentBusData.last_message.isBefore(lastUpdatedTimestamp)) {
          console.log(
            `[vehicles] Same data for ${vehicleNumber}. LastUpdated=${lastUpdatedTimestamp} Timestamp=${mostRecentBusData.last_message.toISOString()}.  Attempt #${attempts}`
          );
          await new Promise((resolve) => {
            setTimeout(resolve, IF_HICCUP_WAIT_N_SECONDS * 1000);
          });
          continue;
        }
      }
      // If this point is reached, API returned new data.
      newData = true;
      console.log(
        `[vehicles] ${vehicleNumber} updated. Timestamp=${mostRecentBusData.last_message.toISOString()} Attempts: ${attempts}`
      );

      // Get the average of the current updateFrequency and the actual time between updates.
      // The idea is over time, it'll average down to the buses actual update frequency. The '1' is
      // padding/buffer.
      vehicle = mostRecentBusData;
      break;
    } while (!newData && attempts < AXIOS_REATTEMPT_AMOUNT);

    if (attempts >= AXIOS_REATTEMPT_AMOUNT) {
      let error = `[vehicles] Error on ${vehicleNumber}: API error. ${attempts} attempts to get new data.`;
      console.log(error);
      resolve({ vehicleNumber, error });
      // upsertBuses checks for an object.vehicle, without vehicle it presumes an error.
    } else {
      if (vehicle! !== undefined) {
        let upsertResults = await upsertVehicle(vehicle);

        if (upsertResults.success === true) {
          resolve({ vehicleNumber, vehicleInfo: vehicle });
        } else {
          resolve({ vehicleNumber, error: upsertResults.error });
        }
      }
    }
  });
};

export { processVehicle };
