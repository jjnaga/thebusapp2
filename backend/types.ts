export type Bus = {
  id: Number;
  name: String;
  last_updated: Date;
  bus_needs_update: Boolean;
};

export type BusUpdateStatus = {
  id: Number;
  updated: Boolean;
};

export type TripInfoTransaction = {
  command: String;
  data: TripInfo;
};

export type TripInfo = {
  trip_id: String;
  vehicle_name: String;
  vehicle_last_updated: String;
};

export type LastUpdate = {
  gtfs_last_update: String;
};

export type TableName = {
  table_name: String;
};

type Arrival = {
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
