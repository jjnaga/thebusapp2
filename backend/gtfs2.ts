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

require('log-timestamp')(function () {
  return `[${moment().tz(TIMEZONE).format()}] `;
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toArrayBuffer(buffer: any) {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
}

// Variables
const jsonURL =
  'https://storage.googleapis.com/storage/v1/b/mdb-latest/o/us-hawaii-thebus-gtfs-10.zip';
const url = 'https://transitfeeds.com/p/thebus-honolulu/57/latest/download';

const executePSQLShell = async (fileName: String) => {
  await exec(
    `psql postgresql://postgres:postgres@localhost:5432/postgres -q -f ${fileName}`,
    // @ts-ignore
    (err, stdout, stderr) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`Done psql on: ${fileName}`);
        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
      }
    }
  );
};

// multithreaded = false is slower and blocks the UI thread if the files
// inside are compressed, but it can be faster if they are not.
const getFiles = async (
  arrayBuffer: ArrayBuffer
): Promise<Unzipped | FlateError> => {
  const zipBuffer = new Uint8Array(arrayBuffer);
  return new Promise((resolve, reject) =>
    unzip(zipBuffer, (err, unzipped) => {
      err ? reject(err) : resolve(unzipped);
    })
  );
};

const generateSQL = async (data: Array<object>, tableName: String) => {
  // Key-value: key is the column name and value is either 0 for Number, or > 0 to define it as a string with
  // the value indicating the longest string length.
  const headers: Map<String, Number> = new Map<string, Number>();
  let sqlValues: any[] = [];

  const headerStrings = () => {
    if (debug) console.log('headerString: Start');
    let string = '';
    headers.forEach((value, key) => {
      string += `${key}\t${
        value === 0 ? `NUMERIC NULL` : `VARCHAR(${value}) NULL`
      }`;
      // at this point, prob should have just used array instead of map.
      if (Array.from(headers.keys()).indexOf(key) + 1 !== headers.size) {
        string += ',';
      }
    });
    if (debug) console.log('headerStrings: End');
    return string;
  };

  const insertStrings = () => {
    if (debug) console.log('insertString Start');
    let insertStrings = '';

    let insertHeaders = '';
    headers.forEach((value, key) => {
      insertHeaders += key;
      if (Array.from(headers.keys()).indexOf(key) + 1 !== headers.size) {
        insertHeaders += ', ';
      }
    });

    sqlValues.forEach((row, index) => {
      let string = dedent`
        INSERT INTO gtfs.${tableName} (
          ${insertHeaders}
        ) VALUES (`;
      row.forEach((value: String | number, index: number) => {
        // there has to be a better way to overload a value if I'm already verifying
        // headers.get(Array.from(headers.keys())[index]) === 0
        //   ? `${value}`
        //   : `'${value ? value.replace() : 'NULL'}'`;
        if (typeof value === 'string') {
          string += `'${value ? value.replace(/'/g, "''") : 'NULL'}'`;
        } else {
          string += `${value}`;
        }
        if (row.length !== index + 1) {
          string += ', ';
        }
      });
      insertStrings += `${string});\n`;
    });
    if (debug) console.log('insertString End');
    return insertStrings;
  };

  return new Promise<any>((resolve, reject) => {
    console.log(`${tableName}: Starting SQL generation`);
    try {
      for (const [key, value] of Object.entries(data[0])) {
        headers.set(key, 0);
      }

      data.forEach((row, index) => {
        let sqlValue: any[] = [];

        let typeChanged: number = 0;

        Object.entries(row).forEach(([column, value], index) => {
          // Default header is assumed to be an integer, defined by 0. Check that value is a string, if it is a string
          // update the type. If we know the header is a string, update the value (longest string length) to the
          // rows length if it is longer.
          if (headers.get(column) === 0) {
            if (Number.isNaN(Number(value))) {
              headers.set(column, value.length);
              typeChanged = index;
            }
          } else {
            if (headers.get(column)! < value.length) {
              headers.set(column, value.length);
            }
          }
          headers.get(column) === 0
            ? sqlValue.push(Number(value))
            : sqlValue.push(value);
        });

        // if typeChanged, update all previous values that were Numbers to strings.
        if (typeChanged) {
          if (debug) console.log('type changed, index=', typeChanged);
          sqlValues = sqlValues.map((row, index) => {
            try {
              if (row[typeChanged])
                row[typeChanged] = row[typeChanged].toString();
              return row;
            } catch (err) {
              console.error(err);
              throw new Error();
            }
          });
        }
        sqlValues.push(sqlValue);
      });

      if (debug) console.log('Done with forEach()');

      // Generate SQL.
      let string = dedent`
      CREATE TABLE IF NOT EXISTS gtfs.${tableName}  (
        id\tSERIAL,
        ${headerStrings()}
      );
      COMMIT;

      ${insertStrings()}
    `;

      fs.writeFile(`./backend/gtfs_${tableName}.sql`, string, (err: Error) => {
        if (err)
          throw new Error(`Unable to make ${tableName}.sql: ` + err.message);
        console.log(`gtfs_${tableName}.sql created.`);
        resolve(0);
      });
    } catch (err) {
      reject(err);
    }
  });
};

const insertDataToDB = async (fileArray: Unzipped | FlateError) => {
  if (fileArray.code) {
    console.error(fileArray);
  }

  let promises: Array<Promise<number>> = [];
  for (const [key, value] of Object.entries(fileArray)) {
    let tableName = key.substring(0, key.indexOf('.'));
    let fileData = new TextDecoder().decode(value);

    await csv()
      .fromString(fileData)
      .then((res: Array<object>) => {
        promises.push(generateSQL(res, tableName));
      });
  }

  await Promise.all(promises).then(() => console.log('All SQL Generated.'));
};

const databaseQuery = (pool: Pool<Client>, query: string): Promise<any[]> => {
  return new Promise(async (resolve, reject) => {
    let client = await pool.connect();
    console.log('client made');
    await client
      .query(query)
      .then((res: QueryResult) => {
        console.log('query done');
        client.release();
        resolve(res.rows);
      })
      .catch((e: Error) => console.error(e));
  });
};

const getJSON = async () => {
  return fetch(jsonURL)
    .then((res) => res.json())
    .then((json) => {
      return json;
    });
};

const backupGTFSTables = async (pool: Pool<Client>) => {
  let gtfsTables: TableName[] = await databaseQuery(
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
    let res = await databaseQuery(
      pool,
      `ALTER TABLE gtfs.${tableName} RENAME TO ${tableName}_${timestamp}`
    );
  });
};

const main = async () => {
  const pool: Pool<Client> = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'postgres',
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Get timestamp of latest update
  let gtfsJSON = await getJSON();

  // Check DB for the last update to GTFS
  let client = await pool.connect();
  let lastUpdateQuery = await databaseQuery(
    pool,
    'SELECT gtfs_last_update FROM config where id = 1'
  );

  let lastDBUpdate = new Date(lastUpdateQuery[0]['gtfs_last_update']);
  let lastTheBusGTFSUpdate = new Date(gtfsJSON['updated']);

  console.log(`Last Bus Update: ${lastTheBusGTFSUpdate.toISOString()}`);
  console.log(`Last DB Update: ${lastDBUpdate.toISOString()}`);

  if (lastDBUpdate < lastTheBusGTFSUpdate) {
    console.log('TheBus GTFS File newer than last update. Updating DB.');

    console.log('Backing up all gtfs_* tables');
    await backupGTFSTables(pool);

    // Fetch ZIP File and unzip into unzipped
    // File manually there for now.
    await fetch(url)
      .then((res) => res.arrayBuffer())
      .then(async (buffer: ArrayBuffer) => {
        // This can't be how we do async/await...
        // TODO: Do we just stack async and await like this?
        // FIX: Create a Promise and resolve it at the end I think, so no need to async/await everything... unless
        // you do
        await getFiles(buffer).then(async (data) => {
          await insertDataToDB(data);
        });
      });
  } else {
    console.log(
      'DB GTFS data newer or the same as last TheBus GTFS Update. Ending'
    );
  }
  console.log('Running psql');
  let files = await glob('./backend/gtfs*.sql');

  files.forEach(async (file: string) => {
    await executePSQLShell(file);
    await delay(5000);
  });

  let updateLastQuery = await databaseQuery(
    pool,
    `UPDATE config SET gtfs_last_update = ${lastTheBusGTFSUpdate.toISOString()} CURRENT_TIMESTAMP where id = 1`
  );
  console.log(updateLastQuery);

  console.log('Main Done');
  pool.end();
};

main();
