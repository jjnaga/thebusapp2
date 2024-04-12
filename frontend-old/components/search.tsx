'use client';
import moment from 'moment';

import { useState, useEffect } from 'react';
import { useMapContext } from './DataProvider';
import { XMLParser } from 'fast-xml-parser';
import { IncomingBusData, RawIncomingBusData } from '@/lib/types';
import { fetchBusStopData } from '@/lib/functions';
import Card from './Card';
import IncomingBuses from './IncomingBuses';
import { Schedule } from './Schedule';

export default function Search() {
  const { route, setRoute } = useMapContext();
  const { selectedBusStop, setSelectedBusStop } = useMapContext();
  const { selectedBus, setSelectedBus } = useMapContext();
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
      console.log(selectedBusStop);
      if (selectedBusStop.stopID !== -1) {
        const busData = await fetchBusStopData(selectedBusStop.stopID);
        setSelectedBusStop({ ...selectedBusStop, buses: busData, lastUpdated: moment() });
        console.log(selectedBusStop);
      }
    };

    updateSelectedBusStop();
    // @ts-ignore
  }, [selectedBusStop.stopID]);

  return (
    <div className="min-w-xl border border-sky-500 p-3 overflow-scroll">
      <form className="relative overflow-visible" onSubmit={searchRoute}>
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
        <div className="flex flex-row p-3">
          <p>{`Stop ID: ${selectedBusStop?.stopID}`}</p>
          <p className="ml-auto">{`Vehicle Number: ${selectedBus?.vehicle}`}</p>
        </div>
      </form>
      <Schedule incomingBuses={selectedBusStop.buses} />
    </div>
  );
}
