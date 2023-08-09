'use client';
import { Suspense } from 'react';
import { useQuery, useSuspenseQuery } from '@apollo/experimental-nextjs-app-support/ssr';
import { gql, useMutation } from '@apollo/client';
import { QueryReference } from '@apollo/client/react/cache/QueryReference';
import { useState, useCallback } from 'react';
import { Map as MapInner } from '@/components/map';

const query = gql`
  query vehicle_info_query {
    api_vehicle_info {
      adherence
      driver
      latitude
      longitude
      number
      route
      last_message
      updated_on
    }
  }
`;

export const MapWrapper = () => {
  let { data } = useSuspenseQuery(query);
  // let data = '';

  return (
    <Suspense fallback={<>Loading....</>}>
      <Map data={data} />
    </Suspense>
  );
};

// @ts-ignore
const Map = ({ data }) => {
  // const { data } = useReadQuery(queryRef);
  // const [showResults, setShowResults] = useState(false);

  // const [mutate, { loading: mutationLoading }] = useMutation(AnswerPollDocument);

  return <MapInner data={data} />;
};
