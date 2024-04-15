'use client';

import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
// import { useSuspenseQuery } from '@apollo/client';
// import { GET_ALL_VEHICLE_INFO_QUERY } from '@/graphql/queries/apiVehicleInfo';
import BusMarker from './BusMarker';
import useBuses from '@/hooks/useBusInfo';
import { SingleBusInfo } from '@/utils/types';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 21.3469,
  lng: -157.9007
};

const Map = () => {
  const { data, isLoading, error } = useBuses();

  const { mapsIsLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
  });

  // const { data } = useSuspenseQuery(GET_ALL_VEHICLE_INFO_QUERY);

  const [map, setMap] = useState(null);
  const [location, setLocation] = useState({ lat: null, lng: null });

  const onLoad = useCallback((map) => {
    // const bounds = new window.google.maps.LatLngBounds(center);
    // map.fitBounds(bounds);
    // setMap(map);
  }, []);

  const onUnmount = useCallback((map) => {
    setMap(null);
  }, []);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        // TODO: We sure this is how?
        (error) => {
          GeolocationPositionError;
          console.error(error);
          toast.error(JSON.parse(`${error.code} - ${error.message}`));
        }
      );
    }
  }, []);

  return mapsIsLoaded ? (
    <div id="google-map" className="h-full w-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* {data &&
          data.status === 'success' &&
          data.map((singleBusInfo: SingleBusInfo) => {
            const {} = singleBusInfo;
            return <BusMarker key={={center} />;
          })} */}
      </GoogleMap>
    </div>
  ) : (
    <>Not Loaded</>
  );
};

export default memo(Map);
