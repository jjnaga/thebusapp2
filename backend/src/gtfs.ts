import { unzip, Unzipped, FlateError } from 'fflate';
import fs from 'fs';
import { copyGTFSTableFromFile, copyStagingTabletoTable, gtfsFilesUpsert, tableColumnInformation } from './sql.js';
import { gtfsFilesUpsertData, gtfsUnzipPromisesType } from './types.js';
import * as cheerio from 'cheerio';
import pool from './db.js';

// multithreaded = false is slower and blocks the UI thread if the files
// inside are compressed, but it can be faster if they are not.
const getFiles = async (arrayBuffer: ArrayBuffer): Promise<Unzipped | FlateError> => {
  const zipBuffer = new Uint8Array(arrayBuffer);
  return new Promise((resolve, reject) =>
    unzip(zipBuffer, (err, unzipped) => {
      err ? reject(err) : resolve(unzipped);
    })
  );
};

let links: any = [];

/**
 * Check GTFS website for any changes and update gtfs.files if needed
 */
const checkGTFSWebsiteForUpdates = async () => {
  const gtfsURL = 'https://transitfeeds.com/p/thebus-honolulu/57';
  const baseURL = 'https://transitfeeds.com';

  const gtfsData: gtfsFilesUpsertData[] = [];
  console.log('Checking transitfeeds.com for GTFS data.');
  const response = await fetch(gtfsURL);
  const body = await response.text();
  const $ = cheerio.load(body);

  // Amount of GTFS files to load. Latest and latest-1 is enough, latest may be in the future and latest-1 would
  // be the current data.
  const GET_FIRST_N = 2;

  // Retrieve data into gtfsFilesUpsertData{}
  for (let i = 0; i < GET_FIRST_N; i++) {
    let gtfs = {} as gtfsFilesUpsertData;

    gtfs.date = $(`.table > tbody > tr:nth-child(${i + 1}) > td:nth-child(1)`)
      .text()
      .trim();

    gtfs.version = $(`.table > tbody > tr:nth-child(${i + 1}) > td:nth-child(2)`)
      .text()
      .trim();

    gtfs.link =
      baseURL +
      $(`.table > tbody > tr:nth-child(${i + 1}) > td:nth-child(5) > a`)
        .filter(function () {
          return $(this).text().trim() === 'Download';
        })
        .attr('href');
    gtfs.file = '';

    gtfsData.push(gtfs);
  }

  // Run upsert into gtfs.files
  let gtfsPromises: Promise<any>[] = [];
  for (let gtfs of gtfsData) {
    gtfsPromises.push(
      new Promise(async (resolve) => {
        let sql = gtfsFilesUpsert(gtfs);
        const lastGTFSUpdate = await pool
          .query(sql)
          .then(resolve)
          .catch((err) => {
            throw new Error('DB ERROR - Unable to upsert gtfs.files: ' + err);
          });
      })
    );
  }
  await Promise.all(gtfsPromises);
};

const gtfs = async () => {
  /*
   * Get table schemas and primary keys for upserts.
   */
  let tableSchemas = await pool
    .query(tableColumnInformation)
    .then((res) => res.rows)
    .then((data) => {
      // This is beautiful. Credit: Nina Scholz
      // https://stackoverflow.com/a/40774906
      return data.reduce((accumulator, current) => {
        accumulator[current.table_name] = accumulator[current.table_name] || [];
        accumulator[current.table_name].push(current);
        return accumulator;
      }, Object.create(null));
    })
    .catch((err) => {
      // console.error(err);
      throw new Error(err);
    });

  await checkGTFSWebsiteForUpdates();

  /*
   * Get gtfs files that need to be processed.
   */
  const gtfsFilesToLoad: gtfsFilesUpsertData[] = await pool
    .query(
      `select
      "version","date"::text,link,file,consumed
    from
    gtfs.files f
    where
    f.consumed = false`
    )
    .then((res) => res.rows)
    .catch((err) => {
      // console.error(err);
      throw new Error(err);
    });

  if (gtfsFilesToLoad.length === 0) {
    console.log(`[GTFS] GTFS up to date.`);
    return;
  }

  /**
   * Process each GTFS zip file
   */
  let gtfsUnzipPromises: Promise<gtfsUnzipPromisesType>[] = [];
  for (let gtfsFile of gtfsFilesToLoad) {
    console.log(`[GTFS] Processing new file: ${gtfsFile.version}`);
    gtfsUnzipPromises.push(
      new Promise(async (resolve) => {
        // Retrieve gtfs zip as buffer.
        let buffer = await fetch(gtfsFile.link as URL).then((res) => res.arrayBuffer());

        // Unzip file.
        let getFilesResults = await getFiles(buffer);
        let encodedFiles: Unzipped = {};
        let decodedFiles: any = {};

        // Is this the best way to explicitly pick a type from a union variable?
        if ('code' in getFilesResults) {
          console.error('FlateError on unzip, aborting: ' + getFilesResults.code);
          resolve({ version: gtfsFile.version, date: gtfsFile.date, status: 'failure' });
        } else {
          encodedFiles = getFilesResults;
        }

        for (let fileNameWithExtension of Object.keys(encodedFiles)) {
          const fileName = fileNameWithExtension.substring(0, fileNameWithExtension.indexOf('.'));
          // These tables are not needed
          if (fileName === 'feed_info' || fileName === 'agency' || fileName === 'fare_attributes') continue;

          // Decode file into utf-8, remove the header (first line), and remove any empty new lines.
          let fileAsString = new TextDecoder()
            .decode(encodedFiles[fileNameWithExtension])
            .replace(/^[^\n]*\n/, '')
            .replace(/^\s*\n/gm, '');

          decodedFiles[fileName] = fileAsString;
        }

        resolve({
          version: gtfsFile.version,
          date: gtfsFile.date,
          status: 'success',
          data: decodedFiles,
        });
      })
    );
  }

  let gtfsUnzipped: gtfsUnzipPromisesType[] = await Promise.all(gtfsUnzipPromises);
  gtfsUnzipped = gtfsUnzipped.sort((a, b) => a.date.localeCompare(b.date));

  for (let gtfs of gtfsUnzipped) {
    let combinedFiles = gtfs.data!;
    // For formatting, print MAX_SPACES N times, with N being the longest filename with two extra \s padding.
    const MAX_SPACES = Object.keys(combinedFiles).reduce((a, b) => (a.length > b.length ? a : b)).length + 2;

    /**
     * Loop through each file, create CSV file, and run COPY FROM FILE SQL.
     */
    let promises: Promise<{ fileName: string; status: string }>[] = [];
    for (const [fileName, csvString] of Object.entries(combinedFiles)) {
      promises.push(
        new Promise(async (resolve) => {
          // Create CSV file from csvString
          try {
            console.log(
              `[GTFS] ${gtfs.version} - ${fileName + ' '.repeat(MAX_SPACES - fileName.length)}Creating CSV for SQL COPY`
            );

            // Attempt to remove file first in case it previously exists.
            try {
              fs.unlinkSync(`./docker-entrypoint/${fileName}_staging.csv`);

              console.log(
                `[GTFS] ${gtfs.version} - ${fileName + ' '.repeat(MAX_SPACES - fileName.length)}Previous CSV deleted`
              );
            } catch (error) {
              // @ts-ignore
              if (error.code !== 'ENOENT') console.log(error);
            }
            await fs.promises.writeFile(`./docker-entrypoint/${fileName}_staging.csv`, csvString);
          } catch (err: any) {
            throw new Error(err);
          }

          // Get table columns for COPY SQL.
          let tableColumns = tableSchemas[fileName].reduce(
            (accumulator: any, current: any) => accumulator + `${current.column_name},`,
            ''
          );

          // Remove the last comma
          tableColumns = tableColumns.replace(/,\s*$/, '');

          // Truncate staging table in case there is any data.
          console.log(`[GTFS] ${gtfs.version} - ${fileName + ' '.repeat(MAX_SPACES - fileName.length)}Truncating`);
          await pool.query(`TRUNCATE gtfs.${fileName}_staging`).catch((err) => {
            throw new Error(`${fileName}: ` + err);
          });

          // Copy csv to staging table.
          console.log(
            `[GTFS] ${gtfs.version} - ${
              fileName + ' '.repeat(MAX_SPACES - fileName.length)
            }Running COPY FROM into staging table`
          );
          let copyResults = await pool
            .query(copyGTFSTableFromFile(fileName, tableColumns))
            .then((res) =>
              console.log(
                `[GTFS] ${gtfs.version} - ${fileName + ' '.repeat(MAX_SPACES - fileName.length)}${
                  res.rowCount
                } rows inserted into staging table`
              )
            )
            .catch((err) => {
              throw new Error(`${fileName}: ` + err);
            });

          try {
            fs.unlinkSync(`./docker-entrypoint/${fileName}_staging.csv`);

            console.log(`[GTFS] ${gtfs.version} - ${fileName + ' '.repeat(MAX_SPACES - fileName.length)}CSV deleted`);
          } catch (error) {
            console.log(error);
          }

          // Upsert from staging_table to table.
          console.log(
            `[GTFS] ${gtfs.version} - ${
              fileName + ' '.repeat(MAX_SPACES - fileName.length)
            }Upserting from staging table`
          );
          await pool
            .query(copyStagingTabletoTable(fileName, tableSchemas[fileName]))
            .then((res) =>
              console.log(
                `[GTFS] ${gtfs.version} - ${fileName + ' '.repeat(MAX_SPACES - fileName.length)}${
                  res.rowCount
                } rows upserted`
              )
            )
            .catch((err) => {
              throw new Error(`${fileName}: ` + err);
            });

          resolve({ fileName, status: 'success' });
        })
      );
    }

    let filesInsertStatus = await Promise.all(promises);

    console.log(`[GTFS] ${gtfs.version}:  Results`);
    for (let fileInsertStatus of filesInsertStatus) {
      console.log(`[GTFS] ${gtfs.version} - ${fileInsertStatus.fileName}:${MAX_SPACES}${fileInsertStatus.status}`);
    }

    for (let fileInsertStatus of filesInsertStatus as any) {
      if (fileInsertStatus.status !== 'success') {
        throw new Error(`${fileInsertStatus.fileName} - COPY FROM failed.`);
      }
    }

    // Set file in gtfs.files to consumed=true
    await pool
      .query(`UPDATE gtfs.files SET consumed = true WHERE version = '${gtfs.version}'`)
      .then((res) => {
        console.log(`[GTFS] ${gtfs.version} Updated row in gtfs.files, consumed = true`);
      })
      .catch((err) => {
        throw new Error(`${gtfs.version} DB ERROR:` + err);
      });
  }
};

export { gtfs };
