import * as pg from 'pg';
const { Pool, Client } = pg;

export type TripInfoTransaction = {
  command: String;
  data: TripInfo;
};

export type TripInfo = {
  trip_id: String;
  vehicle_name: String;
  previous_vehicle_name: String;
  vehicle_last_updated: String;
};

export type Arrival = {
  id: number;
  trip: number;
  route: number;
  headsign: string;
  vehicle: string;
  direction: string;
  stopTime: string;
  date: string;
  estimated: number;
  longitude: number;
  latitude: number;
  shape: number;
  canceled: number;
};

export type Arrivals = {
  stop: number;
  timestamp: string;
  arrival: Array<Arrival>;
};

export type GetArrivalsJSONReturn = { stopID: string; numUpdates: number };

export type VehicleAPI = {
  timestamp: Date;
  errorMessage?: string;
  vehicle?: VehicleInfo[];
};

export type VehicleInfo = {
  number: string;
  trip: number | string;
  driver: number;
  latitude: number;
  longitude: number;
  adherence: number;
  last_message: Date | null;
  route_short_name: string;
  headsign: string;
};

export type upsertBusStatus = {
  upsertStatus: boolean;
  vehicleNumber: string;
};

export type BusInfo = {
  vehicleInfo?: VehicleInfo[];
  lastUpdated: Date;
  updateFrequency?: number;
  inUse?: boolean;
};

export type getandInsertBusType = {
  busNumber: string;
  upsertStatus: boolean;
  errorMessage?: string;
  vehicle?: VehicleInfo[];
};

export type DataBaseQuery = (sql: string, params?: Array<any>, func?: string) => Promise<pg.QueryResult<any>>;

export type gtfsFilesUpsertData = {
  version: string;
  date: string;
  link: string | undefined | URL;
  file: string | undefined | Buffer;
};

export type gtfsUnzipPromisesType = {
  version: string;
  date: string;
  status: string;
  data?: { [fileName: string]: string };
};
