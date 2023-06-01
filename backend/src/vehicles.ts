// @ts-ignore
import('log-timestamp');
import axios, { AxiosResponse } from 'axios';
import pool from './db.js';
import { VehicleAPI, VehicleInfo, getandInsertBusType, upsertBusStatus } from './types.js';
import { XMLParser } from 'fast-xml-parser';
import pLimit from 'p-limit';
import momentTimezone from 'moment-timezone';
import moment from 'moment';
import * as dotenv from 'dotenv';
import { updateAPICount, upsertBusInfoSQL } from './sql.js';
import { PoolClient } from 'pg';

dotenv.config();

const UPDATE_FREQUENCY_BASED_ON_ROUTE = {};
const BUS_UPDATE_DEFAULT_UPDATE_INTERVAL = 180;

// Upsert vehicle API data into DB.
const upsertBuses = (buses: getandInsertBusType[], debug?: boolean): Promise<getandInsertBusType[]> => {
  return new Promise((resolve) => {
    let insertData: string[] = [];
    let count = 0;

    for (const [index, bus] of buses.entries()) {
      let sql = '';
      if (bus.hasOwnProperty('vehicle')) {
        count++;
        bus.vehicle.next_update = moment()
          .add(BUS_UPDATE_DEFAULT_UPDATE_INTERVAL + (Math.random() * 30 + 1), 'seconds')
          .toISOString();
        let row: string[] = [];
        for (let [key, value] of Object.entries(bus.vehicle)) {
          switch (key) {
            // unneeded columns
            case 'trip':
              break;
            case 'headsign':
              break;
            // Date() to timestamp
            case 'last_message':
              row.push(new Date(String(value)).toISOString());
              break;
            default:
              row.push(String(value));
              break;
          }
        }
        // wrap each column in quotes, and wrap each line in parenthesis
        sql = row
          .map((ele) => `'${ele}'`)
          .join(',')
          .replace(/^/, '(')
          .replace(/$/, ')');
        // append comma for all rows except the last.
      } else {
        // If error, set next update to 15 minutes ahead.
        sql = `('${bus.busNumber}', NULL, NULL, NULL, NULL, NULL, NULL, '${moment()
          .add(15, 'minutes')
          .toISOString()}')`;
        console.log(`[vehicles] ${bus.errorMessage}`);
      }
      if (index < buses.length - 1) sql += ',';
      insertData.push(sql);
    }

    let dataString = insertData.join('\n');

    let sql = upsertBusInfoSQL(dataString);

    pool.connect((err, client, done) => {
      if (err) {
        done();
        console.error(`[Vehicles] Unable to get a client from pool.`);
      }

      client.query(sql).then((res) => {
        done();
        console.log(`[Vehicles] ${count} buses updated.`);
        // @ts-ignore
        resolve(res);
      });
    });
  });
};

// Query API. Parse data, upsert into D(erB, and return data so it can be stored in hash table.
const getandInsertBusesData = (busNumbers: string[]): Promise<getandInsertBusType[]> => {
  const parser = new XMLParser();
  const limit = pLimit(12);

  return new Promise(async (resolve) => {
    let axiosPromises: Promise<any>[] = [];
    for (let busNumber of busNumbers) {
      const url = `http://api.thebus.org/vehicle/?key=${process.env.API_KEY}&num=${busNumber}`;

      // updateAPICount();
      axiosPromises.push(
        limit(
          () =>
            new Promise((resolve) => {
              axios.get(url, { responseType: 'text' }).then((res: AxiosResponse) => {
                let json = parser.parse(res.data);
                let data: VehicleAPI = json.vehicles;

                // JSON may just return errorMessage, no vehicle{}. Error looks like: Could not find vehicle "###"
                if (data.hasOwnProperty('errorMessage')) {
                  resolve({ busNumber, errorMessage: data.errorMessage, upsertStatus: false });
                }

                if (data.vehicle !== undefined) {
                  /**
                   * If array, there are multiple trips for a vehicle. There are three possibilities:
                   *  1. either one of the trips is old and invalid data. This can be verified by null_trip or an old
                   *     timestamp,
                   *  2. one bus is going to be making two different trips sequentially.
                   *  3. there are multiple rows per vehicle, all null_trip. However, one is still active. It's sending data, there just is no scheduled trip planned.
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

                  // Querying vehicle APi may result in multiple bus data. There is a variety of reasons - there could
                  // be multiple trips planned per bus. Or one of the data sets is errenous, or just older. Get
                  // the most recent last_message. If there is only one data set, return that set.
                  let mostRecentBusData: VehicleInfo;
                  if (data.vehicle.length > 1) {
                    console.log(`Multiple vehicle data returned for ${busNumber}`);
                    for (let i = 0; i < data.vehicle.length; i++) {
                      console.log(
                        `${busNumber}: ${moment(
                          data.vehicle[i].last_message,
                          'MM/DD/YYYY hh:mm:ss A'
                        ).toLocaleString()}`
                      );
                    }
                    mostRecentBusData = data.vehicle.reduce((a, b) =>
                      moment(a.last_message, 'MM/DD/YYYY hh:mm:ss A').isBefore(
                        moment(b.last_message, 'MM/DD/YYYY hh:mm:ss A')
                      )
                        ? b
                        : a
                    );
                  } else {
                    mostRecentBusData = data.vehicle[0];
                  }

                  resolve({ busNumber, upsertStatus: false, vehicle: mostRecentBusData });
                } else {
                  resolve({ busNumber, errorMessage: 'JSON is undefined', upsertStatus: false });
                  return;
                }
              });
            })
        )
      );
    }
    const results: getandInsertBusType[] = await Promise.all(axiosPromises);

    let upsertResults = await upsertBuses(results);

    resolve(upsertResults);
  });
};

export { getandInsertBusesData };
