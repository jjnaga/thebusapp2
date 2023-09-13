import { Moment } from 'moment';

export type getVehicles = {
  status: string;
  vehicles?: Vehicle[];
};

export type Vehicle = {
  bus_number: string;
  trip: string;
  driver?: string;
  latitude?: number;
  longitude?: number;
  adherence?: number;
  last_message?: number;
  route: string;
  headsign: string;
};

export type Coordinates = {
  lat: number;
  lng: number;
};

export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export interface ClientMapContextProps {
  route: string;
  setRoute: (route: string) => void;
  coordinates: Coordinates;
  setCoordinates: (coordiantes: Coordiantes) => void;
  selectedBusStop: BusStop;
  setSelectedBusStop: (selectedBusStop: BusStop) => void;
}

export interface ReactChildren {
  children: React.ReactNode;
}

export type RawIncomingBusData = {
  id: any;
  trip: any;
  route: any;
  headsign: any;
  vehicle: any;
  direction: any;
  stopTime: any;
  date: any;
  estimated: any;
  longitude: any;
  latitude: any;
  shape: any;
  canceled: any;
};

export interface IncomingBusData {
  id: number;
  vehicle: number | null;
  routeNumber: number;
  routeName: string;
  arrivalTime: Moment;
  minutesToArrival: number;
}

export type BusStop = {
  lat: number;
  lng: number;
  stopID: number;
  buses: IncomingBusData[] | undefined;
};
