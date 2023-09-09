'use client';

import { useState, useEffect } from 'react';
import { useMapContext } from './MapProvider';
import Test from './Test';

export default function Search() {
  const { route, setRoute } = useMapContext();

  // onEffect(() => {});
  async function searchRoute(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      const response = await fetch('/api/routes/');
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {}, []);

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
      </form>
    </div>
  );
}
