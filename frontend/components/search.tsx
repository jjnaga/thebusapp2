'use client';

import { useState, useEffect } from 'react';
import { useMapContext } from './MapProvider';
import { XMLParser } from 'fast-xml-parser';
import { IncomingBusData, RawIncomingBusData } from '@/lib/types';
import { fetchBusStopData } from '@/lib/functions';
import Card from './Card';
import IncomingBuses from './IncomingBuses';

export default function Search() {
  const { route, setRoute } = useMapContext();
  const { selectedBusStop, setSelectedBusStop } = useMapContext();
  const parser = new XMLParser();

  // onEffect(() => {});
  async function searchRoute(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      const response = await fetch('/api/routes/');
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    const updateSelectedBusStop = async () => {
      // -1 is the default value. Don't run if set to -1, as it is the initial load.
      if (selectedBusStop.stopID !== -1) {
        const busData = await fetchBusStopData(selectedBusStop.stopID);
        setSelectedBusStop({ ...selectedBusStop, buses: busData });
      }
    };

    updateSelectedBusStop();
    // @ts-ignore
  }, [selectedBusStop.stopID]);

  useEffect(() => {
    console.log(selectedBusStop);
  }, [selectedBusStop]);

  return (
    <div className="container max-w-xl border border-sky-500 p-3">
      <form className="relative" onSubmit={searchRoute}>
        <i className="absolute fa fa-search text-gray-400 top-5 left-4"></i>
        <label className="sr-only" htmlFor="route">
          Search Routes
        </label>
        <input
          onChange={(event) => setRoute(event.target.value)}
          placeholder="Search Routes"
          className="bg-white h-14 w-full px-12 rounded-lg focus:outline-none hover:cursor-pointer text-black"
          type="text"
          value={route}
        />
        <button className="absolute top-4 right-5 text-black" type="submit">
          Search
        </button>
        <p>{selectedBusStop?.stopID}</p>
      </form>
      {selectedBusStop.buses && <IncomingBuses buses={selectedBusStop.buses} />}
    </div>
  );
}
