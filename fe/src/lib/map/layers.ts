import type { FeatureCollection, LineString, MultiLineString } from 'geojson';
import type { GeoJSONSource, LineLayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { greatCircle, splitAtDateLine } from '../geography';
import type { Coordinates } from '../../types/flight';

type FlightLines = FeatureCollection<LineString, Record<string, never>>;
type AltitudeLines = FeatureCollection<LineString, { altitude: number }>;
type RouteLines = FeatureCollection<MultiLineString, Record<string, never>>;

export const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export const samePoint = (a: Coordinates, b: Coordinates) => a[0] === b[0] && a[1] === b[1];

/**
 * Adds a GeoJSON line layer once per map (StrictMode runs effects twice) and returns its source.
 * Layers draw in the order they are first added.
 */
export function lineSource(map: MapLibreMap, id: string, paint: LineLayerSpecification['paint']): GeoJSONSource {
  if (!map.getSource(id)) {
    map.addSource(id, { type: 'geojson', data: EMPTY });
    map.addLayer({ id: `${id}-line`, source: id, type: 'line', paint, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  }
  return map.getSource(id) as GeoJSONSource;
}

export function routeCollection(origin: Coordinates, destination: Coordinates): RouteLines {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates: splitAtDateLine(greatCircle(origin, destination)) },
    }],
  };
}

export function lineCollection(lines: Coordinates[][]): FlightLines {
  return {
    type: 'FeatureCollection',
    features: lines.map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })),
  };
}

export function altitudeCollection(lines: { from: Coordinates; to: Coordinates; altitude: number }[]): AltitudeLines {
  return {
    type: 'FeatureCollection',
    features: lines.map(({ from, to, altitude }) => ({
      type: 'Feature', properties: { altitude }, geometry: { type: 'LineString', coordinates: [from, to] },
    })),
  };
}

/**
 * Trail shade by altitude: one hue, lighter = lower, darker = higher, blended evenly (in Lab colour
 * space, so no band looks brighter than another). A single-hue scale reads without a legend and
 * changes gradually; a multi-hue scale looked like a rainbow. The ends match the simulator's cruise
 * band (6-15 km, 20,000-50,000 ft); anything outside is clamped to the nearest end.
 * The legend in styles.css (.altitude-scale) uses the same two colours.
 */
export const ALTITUDE_LOW = { metres: 6000, color: '#7cc4dd' };
export const ALTITUDE_HIGH = { metres: 15000, color: '#1c2f6e' };
export const ALTITUDE_COLOR = [
  'interpolate-lab', ['linear'], ['get', 'altitude'],
  ALTITUDE_LOW.metres, ALTITUDE_LOW.color, ALTITUDE_HIGH.metres, ALTITUDE_HIGH.color,
] as unknown as string; // a MapLibre expression; the cast satisfies the paint property's string type
