'use client';
import { Suspense } from 'react';
import { useReadQuery, useBackgroundQuery } from '@apollo/experimental-nextjs-app-support/ssr';
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
  const [queryRef] = useBackgroundQuery(query);

  return (
    <Suspense fallback={<>Loading....</>}>
      <Map queryRef={queryRef} />
    </Suspense>
  );
};

const Map = ({ queryRef }) => {
  const { data } = useReadQuery(queryRef);
  // const [showResults, setShowResults] = useState(false);

  // const [mutate, { loading: mutationLoading }] = useMutation(AnswerPollDocument);

  return <MapInner data={data} />;
};
