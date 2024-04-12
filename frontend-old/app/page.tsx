'use client';
// import { Route } from "../types";

import Search from '@/components/Search';
import { MapWrapper } from './map-wrapper';
import { loadErrorMessages, loadDevMessages } from '@apollo/client/dev';

if (process.env.NODE_ENV !== 'production') {
  // Adds messages only in a dev environment
  loadDevMessages();
  loadErrorMessages();
}

export default async function Home() {
  return (
    <div className="flex-1 flex justify-center overflow-scroll">
      <Search />
      <MapWrapper />
    </div>
  );
}
