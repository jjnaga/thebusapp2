import { getBusesData } from '@/lib/functions';
import Map from '../components/Map';
import React, { useEffect, Fragment, useState } from 'react';
import { useMutation, useSubscription, gql } from '@apollo/client';
import { Metadata } from 'next';

/**
 * Default metadata.
 *
 * @see https://beta.nextjs.org/docs/api-reference/metadata
 */
export const metadata: Metadata = {
  title: 'The Bus',
  description: 'The Bus App',
};

// What does these two lines do?
export const runtime = 'edge';
export const revalidate = 60;

export default async function Home() {
  const busData = await getBusesData();

  if (!busData) {
    return 'Loading Data';
  }

  return <Map busData={busData} />;
}
