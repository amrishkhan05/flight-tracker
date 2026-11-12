/** These are the shapes documented by the provided backend. */
export type AltitudeUnit = 'm' | 'ft';
export type Airport = { airport: string; city: string };
export type SubscribeMessage = { type: 'subscribe'; planeId: string };

export type PlaneBasic = {
  id: string;
  latitude: number;
  longitude: number;
  altitude: number; // metres
  color: string;
};

export type PlaneDetailed = PlaneBasic & {
  model: string;
  airline: string;
  flightNumber: string;
  registration: string;
  speed: number; // metres / second
  heading: number; // degrees clockwise from north
  verticalSpeed: number; // metres / second
  origin: Airport;
  destination: Airport;
  flightDuration: number; // minutes
  estimatedArrival: number; // Unix time in milliseconds (verified in be/src/plane.ts)
  numberOfPassengers: number;
  maxPassengers: number;
  status: 'departed' | 'enroute' | 'cruising' | 'landing';
};

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';
export type Coordinates = [longitude: number, latitude: number];
