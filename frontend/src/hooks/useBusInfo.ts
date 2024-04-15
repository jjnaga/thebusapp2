import { MultipleBusInfo } from '@/utils/types';
import useSWR from 'swr';

const REFRESH_INTERVAL = 60000;
const BUSES_URL = '/api/buses';

const fetcher = async (url: string): Promise<MultipleBusInfo> => {
  console.log('useBusInfo: fetching data', new Date().toISOString());
  // TODO: No error checking? none of that? does SWR take care of that for us.
  const response = await fetch(url);
  const json = response.json();
};

const useBuses = () => {
  const { data, isLoading, error } = useSWR(BUSES_URL, fetcher, {
    refreshInterval: REFRESH_INTERVAL
  });

  return {
    data,
    isLoading,
    error
  };
};

export default useBuses;
