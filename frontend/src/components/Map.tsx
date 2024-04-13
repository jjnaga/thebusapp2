'use client';

import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 21.3469,
  lng: -157.9007
};

const Map = () => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
  });

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

  return isLoaded ? (
    <div id="google-map" className="h-full w-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
      />
    </div>
  ) : (
    <>Not Loaded</>
  );
};

export default memo(Map);
