'use client';

import { BusStop, ClientMapContextProps, IncomingBusData, ReactChildren, Vehicle } from '@/lib/types';
import { createContext, useContext, useState } from 'react';

// Create the context.
const MapContext = createContext({} as ClientMapContextProps);

export function useMapContext() {
  return useContext(MapContext);
}

export default function MapProvider({ children }: ReactChildren) {
  const [route, setRoute] = useState('3');
  const [coordinates, setCoordinates] = useState({
    lat: 21.315590993778137,
    lng: -157.85889586252094,
  });
  const [map, setMap] = useState<google.maps.Map>();

  const temporaryBusStop: BusStop = {
    stopID: -1,
    lat: 0,
    lng: 0,
    buses: undefined,
  };
  const [selectedBusStop, setSelectedBusStop] = useState(temporaryBusStop);
  const [selectedBus, setSelectedBus] = useState<IncomingBusData>();

  return (
    // TODO
    // @ts-ignore
    <MapContext.Provider
      value={{
        route,
        setRoute,
        coordinates,
        setCoordinates,
        selectedBusStop,
        setSelectedBusStop,
        map,
        setMap,
        selectedBus,
        setSelectedBus,
      }}
    >
      {children}
    </MapContext.Provider>
  );
}
