'use client';
import { GoogleMap, MarkerF, RectangleF, InfoWindowF } from '@react-google-maps/api';
import { Bounds, BusStop, Vehicle } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useMapContext } from './DataProvider';
import { useSuspenseQuery } from '@apollo/experimental-nextjs-app-support/ssr';
import { gql, useLazyQuery } from '@apollo/client';
export const dynamic = 'force-dynamic';

const query = gql`
  query get_nearby_stops_query($north: numeric!, $south: numeric!, $east: numeric!, $west: numeric!) {
    gtfs_stops(where: { stop_lat: { _gt: $south, _lt: $north }, stop_lon: { _gt: $west, _lt: $east } }) {
      lat: stop_lat
      lng: stop_lon
      stopID: stop_id
    }
  }
`;

// Google Maps
export const Map = () => {
  // TODO: this needs to spit out errors.
  const [getData, { loading, data }] = useLazyQuery(query);

  const DEFAULT_RECTANGLE_OFFSET = 0.005;
  const [selectedElement, setSelectedElement] = useState(null);
  // @ts-ignore
  const [activeMarker, setActiveMarker] = useState(null);
  const [showInfoWindow, setInfoWindowFlag] = useState(true);
  // let vehicleData = props.data.api_vehicle_info;
  const [center, setCenter] = useState({
    lat: 21.315590993778137,
    lng: -157.99298091611027,
  });

  const [bounds, setBounds] = useState<Bounds>();
  const [marker, setMarker] = useState({});
  const { map, setMap } = useMapContext();
  const { coordinates, setCoordinates } = useMapContext();
  const { selectedBusStop, setSelectedBusStop } = useMapContext();
  const { selectedBus, setSelectedBus } = useMapContext();

  const containerStyle = {
    width: '100%',
    height: '100%',
  };

  useEffect(() => {
    const { lat, lng } = coordinates;

    const newBounds = {
      north: lat + DEFAULT_RECTANGLE_OFFSET,
      south: lat - DEFAULT_RECTANGLE_OFFSET,
      east: lng + DEFAULT_RECTANGLE_OFFSET,
      west: lng - DEFAULT_RECTANGLE_OFFSET,
    };

    setBounds(newBounds);
    if (map != undefined) {
      console.log('fitting bounds');
      map.fitBounds(newBounds);
    }
  }, [coordinates]);

  useEffect(() => {
    console.log(map);
  }, [map]);

  useEffect(() => {
    if (bounds !== undefined) {
      const { north, south, east, west } = bounds;
      getData({ variables: { north, south, east, west } });
    }
  }, [bounds]);

  useEffect(() => {
    if (selectedBus?.vehicle != undefined) {
      console.log('make the middle');
      const newCenter = {
        lat: (center.lat + selectedBus.latitude) / 2,
        lng: (center.lng + selectedBus.longitude) / 2,
      };

      map!.panTo(newCenter);

      const { lat, lng } = coordinates;

      selectedBusStop.lat;

      const newBounds = {
        north: Math.max(selectedBusStop.lat, selectedBus.latitude) + DEFAULT_RECTANGLE_OFFSET,
        south: Math.min(selectedBusStop.lat, selectedBus.latitude) - DEFAULT_RECTANGLE_OFFSET,
        east: Math.max(selectedBusStop.lng, selectedBus.longitude) + DEFAULT_RECTANGLE_OFFSET,
        west: Math.min(selectedBusStop.lng, selectedBus.longitude) - DEFAULT_RECTANGLE_OFFSET,
      };

      if (map != undefined) {
        map.fitBounds(newBounds);
      }
    }
  }, [selectedBus]);

  // Get Location of user
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
    });
  }, []);

  return (
    <GoogleMap mapContainerStyle={containerStyle} id="map" center={center} zoom={11} onLoad={(map) => setMap(map)}>
      <MarkerF key="person" position={center} />
      {data &&
        data.gtfs_stops.map((busStop: BusStop) => {
          const { lat, lng, stopID } = busStop;
          const latLng = { lat, lng };

          return (
            <MarkerF
              key={stopID}
              position={latLng}
              onClick={() => {
                setSelectedBusStop(busStop);
                map!.panTo(latLng);
              }}
            />
          );
        })}
      {/* Active Incoming Bus  */}
      {selectedBus?.vehicle != undefined && (
        <MarkerF position={{ lat: selectedBus.latitude, lng: selectedBus.longitude }}>
          {/* <InfoWindowF>
            <span>lmao</span>
          </InfoWindowF> */}
        </MarkerF>
      )}
      {bounds !== undefined && <RectangleF bounds={bounds!} />}
    </GoogleMap>
  );
};
