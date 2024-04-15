import { TypedDocumentNode, gql } from '@apollo/client';

export const GET_ALL_VEHICLE_INFO_QUERY: TypedDocumentNode<GetVehicleInfoGQLData> = gql`
  query GetVehicleInfo {
    api_vehicle_info {
      adherence
      driver
      last_message
      latitude
      longitude
      number
      route
      updated_on
    }
  }
`;
