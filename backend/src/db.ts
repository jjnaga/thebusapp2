import pg from 'pg';

let config = {
  host: 'localhost',
  user: 'postgres',
  password: 'postgrespassword',
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,

  max: 200,
  min: 20,
};

const pool = new pg.Pool(config);
console.log('New Pool made');

const permanentClient = pool.connect();
console.log('Permanent Client created.');

export const poolDebug = () => {
  console.log('Pool Waiting Count' + pool.waitingCount);
  console.log('Pool Idle Count' + pool.idleCount);
  console.log('Pool Total Count' + pool.totalCount);
};

export const query = async (text: string, params: any[]) => {
  // const start = Date.now();
  const res = await pool.query(text, params);
  // const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};

export const queryWithPermanentClient = async (text: string, params: any[], user?: string) => {
  // if (user) console.log(`UpdateAPI: from ${user}`);
  const res = await pool.query(text, params);
  return res;
};

export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;
  // set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
    //@ts-ignore
    console.error(`The last executed query on this client was: ${client.lastQuery}`);
  }, 5000);

  // @ts-ignore
  client.query = (...args) => {
    // console.log(args);
    // @ts-ignore
    client.lastQuery = args;
    // @ts-ignore
    return query.apply(client, args);
  };

  client.release = () => {
    // clear our timeout
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };
  return client;
};
