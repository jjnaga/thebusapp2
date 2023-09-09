'use client';
import {
  useLoadScript,
  GoogleMap,
  MarkerF,
  CircleF,
  LoadScript,
  TransitLayer,
  InfoWindow,
  RectangleF,
  Rectangle,
} from '@react-google-maps/api';
import { Bounds, BusStop, Vehicle } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useMapContext } from './MapProvider';
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
    lng: -157.85889586252094,
  });

  const [bounds, setBounds] = useState<Bounds>();
  const [marker, setMarker] = useState({});
  const { coordinates, setCoordinates } = useMapContext();

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
  }, [coordinates]);

  useEffect(() => {
    // TODO: this runs multiple times because of bounds, it must trigger multiple times.
    console.log('bounds updated');
    console.log(bounds);
    async function getStops() {
      if (bounds !== undefined) {
        const { north, south, east, west } = bounds;
        await getData({ variables: { north, south, east, west } });
        console.log('data found');
        console.log(data);
      }
      // Why do these comments ru
      console.log('starting graphql call');
      console.log('finishing graphql call');
      console.log(`loading: ${loading}`);
    }
    getStops();
  }, [bounds]);

  // When coordinates are updated, get the stops around coordinates.
  // useEffect(() => {
  //   async function getRoutes() {
  //     try {
  //       const response = await fetch('/api/routes/');
  //     } catch (err) {
  //       console.error(err);
  //     }
  //   }

  //   getRoutes();
  // }, [coordinates]);

  // Get Location of user
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      // console.log('Latitude is :', position.coords.latitude);
      // console.log('Longitude is :', position.coords.longitude);
      setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
    });
  }, []);

  return (
    // <GoogleMap mapContainerStyle={containerStyle} id="map" center={center} zoom={15.5}>
    <GoogleMap mapContainerStyle={containerStyle} id="map" center={center} zoom={15}>
      {/* <TransitLaer /> */}
      {/* {vehicleData.map((vehicle) => {
          const { bus_number: busNumber, latitude: lat, longitude: lng } = vehicle;
          let coordinates = {
            lat,
            lng,
          };
          return (
            <MarkerF
              key={busNumber}
              position={coordinates}
              onClick={(marker) => {
                // @ts-ignore
                setSelectedElement(marker);
                // setActiveMarker(marker);
              }}
            />
          );
        })} */}
      <MarkerF
        key="person"
        position={center}
        onClick={(marker) => {
          // @ts-ignore
          setSelectedElement(marker);
          // setActiveMarker(marker);
        }}
      />
      {data &&
        data.gtfs_stops.map((busStop: BusStop) => {
          const { lat, lng, stopID } = busStop;
          const latLng: google.maps.LatLngLiteral = { lat, lng };
          console.log('wtf');

          return <MarkerF key={stopID} position={latLng} />;
        })}
      {bounds !== undefined && <RectangleF bounds={bounds!} />}
    </GoogleMap>
  );
};

/* <InfoWindow
            // visible={showInfoWindow}
            // @ts-ignore
            marker={activeMarker}
            // options={}
            // onCloseClick={() => {
            //   // setSelectedElement(null);
            // }}
          >
            <div>
              <h1>Test Test</h1>
            </div>
          </InfoWindow> */
