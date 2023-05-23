'use client';
import { useLoadScript, GoogleMap, MarkerF, LoadScript } from '@react-google-maps/api';
import Map from '../components/Map';

// const API_ENDPOINT = 'localhost:3000';

// export async function getVehicles() {
//   try {
//     let data = await fetch('http://localhost:3000/api/vehicles');
//     return data.json();
//   } catch (err) {
//     console.error(err);
//   }
// }

export default async function Home() {
  return <Map />;
}
