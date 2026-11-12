import type { Coordinates } from '../types/flight';

/**
 * A deliberately small, offline lookup: exactly the ten IATA airports used by
 * the simulator. Coordinates are approximate WGS84 airport reference points.
 * Source: OurAirports (public-domain data), https://ourairports.com/data/.
 */
export const AIRPORTS: Partial<Record<string, Coordinates>> = {
  JFK: [-73.7781, 40.6413],
  LAX: [-118.4085, 33.9416],
  ORD: [-87.9073, 41.9742],
  LHR: [-0.4543, 51.47],
  CDG: [2.5479, 49.0097],
  FRA: [8.5706, 50.0379],
  AMS: [4.7639, 52.3105],
  DXB: [55.3644, 25.2532],
  IST: [28.7519, 41.2753],
  MIA: [-80.2906, 25.7954],
};

/** Own entries only, so codes such as "constructor" or "__proto__" are unknown. */
export function lookupAirport(code: string): Coordinates | undefined {
  return Object.prototype.hasOwnProperty.call(AIRPORTS, code) ? AIRPORTS[code] : undefined;
}
