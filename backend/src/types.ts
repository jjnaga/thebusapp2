import { Moment } from 'moment';
import * as pg from 'pg';
const { Pool, Client } = pg;

export type TripInfoTransaction = {
  command: String;
  data: TripInfo;
};

export type TripInfo = {
  trip_id: String;
  vehicle_number: String;
  previous_vehicle_number: String;
  vehicle_last_updated: String;
};

export type Arrival = {
  id: number;
  trip: number;
  route: string;
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

export type BusesData = {};

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
  last_message: Moment;
  route_short_name: string;
  headsign: string;
};

export type upsertBusStatus = {
  upsertStatus: boolean;
  vehicleNumber: string;
};

export type VehicleData = {
  // I dont trust TheBus to not have a vehcle number that has letters.
  vehicleNumber: string;
  isBeingUpdated: boolean;
  updateFrequency: number;
  vehicleInfo: VehicleInfo[];
};

export type getandInsertBusType = {
  vehicleNumber: string;
  newUpdateFrequency: number;
  vehicle?: any;
};

export type _ = {};

export type ActiveBus = {
  vehicleNumber: string;
  lastMessage: Moment;
  updateFrequency: number;
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

export type UpsertBusStatus = {
  updated: boolean;
  vehicleInfo: VehicleInfo;
};

export type UpsertVehicleInfoData = {
  number: string;
  driver: number;
  latitude: number;
  longitude: number;
  adherence: number;
  lastMessage: string;
  route: string;
};

export type processVehicleDataType = {
  vehicleNumber: string;
  vehicleInfo?: VehicleInfo;
  error?: any | unknown;
};
