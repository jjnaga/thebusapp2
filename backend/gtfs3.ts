const debug = false;
const TIMEZONE = 'Pacific/Honolulu';

const csv = require('csvtojson');
const { exec } = require('child_process');

const Zip = require('adm-zip');
const fs = require('fs');
const dedent = require('dedent-js');
const utils = require('util'); // The thing that is useful, it has a bunch of useful functions
// If you aren't using a bundler, see the CDN instructions in the docs
import { unzipSync, unzip, Unzipped, FlateError } from 'fflate';
import { Client, PoolClient, QueryResult } from 'pg';
import * as Pool from 'pg-pool';
import { LastUpdate, TableName } from './types';
const fileToArrayBuffer = require('file-to-array-buffer');
const { glob } = require('glob');
var moment = require('moment-timezone');
require('log-timestamp')(async function () {
  await `[${moment().tz(TIMEZONE).format(moment.defaultFormat)}] `;
});

const selectSQL = (pool: Pool<Client>, query: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    let client = pool.connect().then((client) => {
      client
        .query(query)
        .then((res) => {
          client.release();
          resolve(res.rows);
        })
        .catch((err) => {
          client.release();
          console.error(err);
          reject();
        });
    });
  });
};

const getJSON = async (url: string) => {
  return fetch(url)
    .then((res) => res.json())
    .then((json) => {
      return json;
    });
};

const backupGTFSTables = async (pool: Pool<Client>) => {
  let gtfsTables: TableName[] = await selectSQL(
    pool,
    ` SELECT 
        table_name 
      FROM information_schema.tables 
      where table_schema = 'gtfs'
      and table_name ~ '^[^0-9]+$'`
  );

  let date = new Date();
  let timestamp =
    date.getFullYear() +
    ('0' + (date.getMonth() + 1)).slice(-2) +
    ('0' + date.getDate()).slice(-2) +
    ('0' + date.getHours()).slice(-2) +
    ('0' + date.getMinutes()).slice(-2) +
    ('0' + date.getSeconds()).slice(-2);
  gtfsTables.forEach(async (table) => {
    let tableName = table.table_name;
    console.log(`Backing up ${tableName}`);
    let res = await selectSQL(
      pool,
      `ALTER TABLE gtfs.${tableName} RENAME TO ${tableName}_${timestamp}`
    );
  });
};

// Variables

const main = async () => {
  console.log('Main Start');
  const jsonURL =
    'https://storage.googleapis.com/storage/v1/b/mdb-latest/o/us-hawaii-thebus-gtfs-10.zip';
  const url = 'https://transitfeeds.com/p/thebus-honolulu/57/latest/download';

  const pool: Pool<Client> = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'postgres',
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  let lastUpdateDB = await selectSQL(
    pool,
    'SELECT gtfs_last_update FROM config where id = 1'
  );

  let gtfsJSON = await getJSON(jsonURL);

  let lastDBUpdate = new Date(lastUpdateDB[0]['gtfs_last_update']);
  // @ts-ignore
  let lastTheBusGTFSUpdate = new Date(gtfsJSON['updated']);

  console.log(`Last Bus Update: ${lastTheBusGTFSUpdate.toISOString()}`);
  console.log(`Last DB Update: ${lastDBUpdate.toISOString()}`);

  if (lastDBUpdate < lastTheBusGTFSUpdate) {
    console.log('TheBus GTFS File newer than last update. Updating DB.');

    console.log('Backing up all gtfs_* tables');
    await backupGTFSTables(pool);

    // Fetch ZIP File and unzip into unzipped
    // File manually there for now.
    await fetch(url);
  } else {
    console.log(
      'DB GTFS data newer or the same as last TheBus GTFS Update. Ending'
    );
  }
  pool.end();
  console.log('Main done');
};

main();
