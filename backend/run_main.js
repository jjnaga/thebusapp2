const decompress = require('decompress');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const csv = require('csvtojson');
const { Pool, Client } = require('pg');

require('console-stamp')(console, {
  format: ':date(yyyy/mm/dd HH:MM:ss.lZ) :label',
});

console.log('Hello World!');

function isNumeric(str) {
  if (typeof str != 'string') return false; // we only process strings!
  return (
    !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str))
  ); // ...and ensure strings of whitespace fail
}

function loadFileAsSQL(fileName, fileDataAsString) {
  return new Promise(async (resolve) => {
    console.log(`loadFileAsSQL(${fileName}): Converting into SQL`);
    const regex = /(\w+).txt$/;
    const tableName = fileName.match(regex)[1];

    const jsonArray = await csv().fromString(fileDataAsString);
    const columns = Object.keys(jsonArray[0]);
    const dataTypes = [];
    let valuesSQL = '';

    columns.forEach((column, index) => {
      let dataType;
      let stringMaxLength = 1;

      let stringDetected = false;
      let decimalDetected = false;
      jsonArray.forEach((data) => {
        row = data[column];

        if (isNumeric(row) && stringDetected == false) {
          if (!decimalDetected) {
            if (parseFloat(row) % 1 > 0) {
              dataType = 'DECIMAL';
              decimalDetected = true;
            } else {
              dataType = 'INTEGER';
            }
          }
        } else {
          stringDetected = true;
          dataType = 'STRING';

          if (row.length > stringMaxLength) {
            stringMaxLength = row.length;
          }
        }
      });

      // I know... this can be optimized
      jsonArray.forEach((data, index) => {
        valuesSQL += '(';

        columns.forEach((column, index) => {
          switch (dataTypes[index]) {
            case 'STRING':
              valuesSQL += `${data[column]}`;
              if (j) break;
            case 'DECIMAL':
              valuesSQL += `${parseFloat(data[column])}`;
              break;
            case 'INTEGER':
              valuesSQL += `${parseInt(data[column])}`;
              break;
          }
        });

        valuesSQL += ')';

        if (jsonArray.length != index + 1) {
          valuesSQL += ',\n';
        } else {
          valuesSQL += ',\n';
        }
      });

      if (dataType != 'SRING') {
        dataTypes.push(dataType);
      } else {
        dataTypes.push(`VARCHAR(${stringMaxLength})`);
      }
    });

    let SQL = `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;

    columns.forEach((column, index) => {
      // this is prob an oof
      if (index + 1 == columns.length) {
        SQL += `\t${column}\t${dataTypes[index]}\n`;
      } else {
        SQL += `\t${column}\t${dataTypes[index]},\n`;
      }
    });

    SQL += `);\n`;

    SQL += `INSERT INTO ${tableName} VALUES\n`;
    SQL += valuesSQL;

    console.log(`loadFileAsSQL(${fileName}): Complete`);
    console.log(SQL);
    resolve({ tableName, data: SQL });
  });
}

async function downloadGTFSFile(fileName, url) {
  try {
    console.log(`downloadGTFSFile(): Downloading ${url}`);

    const { stdout, stderr } = await exec(
      `wget ${url} --output-document ${fileName} --no-check-certificate`
    );

    // console.log('stdout:', stdout);
    // console.log('stderr:', stderr);
  } catch (e) {
    console.error(e); // should contain code (exit code) and signal (that caused the termination).
  }
}

async function decompressAsync(fileName, path) {
  return new Promise((resolve) => {
    decompress(fileName, path).then((files) => {
      resolve(files);
    });
  });
}

async function unzip(fileName, directory) {
  try {
    console.log(`unzipGTFSFile(): Unzipping ${fileName} into ${directory}`);

    // Check if directory exists first.
    fs.access(`${directory}`, async function (error) {
      if (error) {
        const { mkdirOut, mkdirErr } = await exec(`mkdir gtfs_files`);
        console.log(`Created directory ${directory}`);
      } else {
        console.log(`${directory} exists`);
      }
    });

    let files = await decompressAsync(fileName, directory);
    return files;
  } catch (e) {
    console.error(e);
  }
}

async function deleteGTFS(fileName) {
  try {
    console.log(`Deleting ${fileName}.`);
    let { stdout, stderr } = await exec(`rm -f ${fileName}`);

    console.log(`Deleting directory gtfs_files`);
    let { rmStdout, rmStderr } = await exec(`rm -rf ./gtfs_files`);
  } catch (e) {
    console.error(e); // should contain code (exit code) and signal (that caused the termination).
  }
}

async function decompressAsync(fileName, path) {
  return new Promise((resolve) => {
    decompress(fileName, path).then((files) => {
      resolve(files);
    });
  });
}

async function unzipGTFSFile(fileName) {
  try {
    console.log(`Making 'gtfs_files' directory for zipped file`);
    const { mkdirOut, mkdirErr } = await exec(`mkdir gtfs_files`);

    let files = await decompressAsync(fileName, './gtfs_files');
    return files;
  } catch (e) {
    console.error(e);
  }
}

function query(pool, query) {
  return new Promise((resolve, reject) => {
    pool.query(query, (err, res) => {
      if (err) reject(err);
      resolve(res);
    });
  });
}

const main = async () => {
  const now = Date.now();
  const fileName = `gtfs_${now}.zip`;
  let SQL = '';
  const pool = new Pool({
    user: 'root',
    password: 'root',
    host: '172.20.0.11',
    database: 'the_bus',
    port: 5432,
  });

  // Delete ZIP GTFS content in case process didn't finish last time.
  await deleteGTFS(fileName);

  // Download ZIP GTFS file.
  await downloadGTFSFile(
    fileName,
    'https://transitfeeds.com/p/thebus-honolulu/57/latest/download'
  );
  console.log('Latest GTFS ZIP File Downloaded');

  // Unzip GTFS zip into 'gtfs_files' directory
  let files = await unzipGTFSFile(fileName);
  console.log(`ZIP File uncompressed.`);

  // For each file in directory gtfs_files, load content into postgres DB via SQL files.
  const sqlArray = [];

  for (const file of files) {
    sqlArray.push(loadFileAsSQL(file.path, file.data.toString('utf8')));
  }

  await Promise.all(sqlArray)
    .then(async (results) => {
      results.forEach(async (obj) => {
        // Archive table.
        console.log(`Archiving ${obj.tableName} if exists`);
        await query(
          pool,
          `ALTER TABLE IF EXISTS ${obj.tableName} rename to "${Date.now()}_${
            obj.tableName
          }"`
        ).catch((e) => {
          console.error(e);
        });

        console.log(`Creating ${tableName} and inserting data.`);
        await query(pool, obj.data).catch((e) => {
          console.error(e);
        });
      });
    })
    .catch((e) => {
      console.error(e);
    });

  console.log('Table Scripts complete');
  console.log(SQL);

  // Delete ZIP GTFS content.
  await deleteGTFS(fileName);
  console.log(`${fileName} deleted.`);

  console.log('end script');
};

main();
// const pool = new Pool({
//   user: 'root',
//   password: 'root',
//   host: '172.20.0.11',
//   database: 'the_bus',
//   port: 5432,
// });
