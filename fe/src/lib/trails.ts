import type { Coordinates, PlaneBasic } from '../types/flight';

export interface TrailPoint {
  latitude: number;
  longitude: number;
  altitude: number; // metres, used to colour the trail
  receivedAt: number;
  breakBefore: boolean;
}

export type FlightTrails = Map<string, TrailPoint[]>;

/**
 * Short interruptions (a reconnect, a bad message, a page reload) are bridged: over a few seconds a
 * plane flies almost straight, so joining the points is accurate and keeps the trail one clean line.
 * Only a gap this long starts a new segment, drawn with a dotted "no data" connector.
 */
export const TRAIL_GAP_MS = 60_000;

/**
 * No plane flies further than this per minute: the simulator's planes cover about 2 km/s, under
 * 120 km a minute. A bigger jump means the plane was replaced (the backend restarted and placed it
 * somewhere new), so the trail breaks and no connector is drawn across the jump.
 */
// shortcut: a restarted plane lands within 300 km of its old spot about 2% of the time and then joins with a
// short false line; upgrade to a speed limit per elapsed second if the backend ever sends a flight/session ID.
export const TRAIL_MAX_JUMP_KM = 300;

/** Flat-earth distance; accurate enough to tell a flight from a teleport. */
const roughKm = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) =>
  Math.hypot((b.latitude - a.latitude) * 111, (b.longitude - a.longitude) * 111 * Math.cos(a.latitude * Math.PI / 180));

export function appendTrails(
  previous: FlightTrails, planes: PlaneBasic[], maxPoints: number, receivedAt: number,
  gapAfterMs = TRAIL_GAP_MS,
): FlightTrails {
  const next: FlightTrails = new Map<string, TrailPoint[]>();
  for (const plane of planes) {
    const points = previous.get(plane.id) ?? [];
    const last = points[points.length - 1];
    // Break only for a long outage, the world-map seam, or a jump no plane could fly; never for a short interruption.
    const breakBefore = !last || receivedAt - last.receivedAt >= gapAfterMs
      || Math.abs(plane.longitude - last.longitude) > 180 || roughKm(last, plane) > TRAIL_MAX_JUMP_KM;
    if (last && !breakBefore && last.latitude === plane.latitude && last.longitude === plane.longitude) {
      next.set(plane.id, [...points.slice(0, -1), { ...last, receivedAt }]);
    } else {
      next.set(plane.id, [...points.slice(-(maxPoints - 1)), {
        latitude: plane.latitude, longitude: plane.longitude, altitude: plane.altitude, receivedAt, breakBefore,
      }]);
    }
  }
  return next;
}

export function trailSegments(points: TrailPoint[]): TrailPoint[][] {
  const segments: TrailPoint[][] = [];
  for (const point of points) {
    if (point.breakBefore || segments.length === 0) segments.push([]);
    segments[segments.length - 1]?.push(point);
  }
  return segments.filter(segment => segment.length >= 2);
}

const toCoordinates = (point: TrailPoint): Coordinates => [point.longitude, point.latitude];

/**
 * What the map draws for one trail:
 * - `flown`: one short line per pair of recorded points, with their average altitude, so each piece
 *   can be shaded by altitude;
 * - `gaps`: a straight connector across each long break (see TRAIL_GAP_MS), drawn faintly dotted
 *   so the trail looks continuous but is clearly marked "no data here". Only where a plane could
 *   have flown the gap (TRAIL_MAX_JUMP_KM per minute), and never across the date line.
 */
export function trailLines(points: TrailPoint[]) {
  const segments = trailSegments(points);
  const flown: { from: Coordinates; to: Coordinates; altitude: number }[] = [];
  const gaps: [Coordinates, Coordinates][] = [];
  segments.forEach((segment, index) => {
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1]!;
      const b = segment[i]!;
      flown.push({ from: toCoordinates(a), to: toCoordinates(b), altitude: (a.altitude + b.altitude) / 2 });
    }
    const previous = segments[index - 1];
    const end = previous?.[previous.length - 1];
    const start = segment[0];
    if (end && start && Math.abs(start.longitude - end.longitude) <= 180
      && roughKm(end, start) <= TRAIL_MAX_JUMP_KM * Math.max(1, (start.receivedAt - end.receivedAt) / 60_000)) {
      gaps.push([toCoordinates(end), toCoordinates(start)]);
    }
  });
  return { flown, gaps };
}

const STORAGE_KEY = 'flight-radar:trails';

/** Keeps trails across a reload of this tab. Storage can be full or blocked; trails are a nice-to-have. */
export function saveTrails(trails: FlightTrails, storage: Storage = window.sessionStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...trails]));
  } catch {
    // shortcut: a full or blocked storage just means the next reload starts trails from empty.
  }
}

const isTrailPoint = (value: unknown): value is TrailPoint => {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Record<string, unknown>;
  return Number.isFinite(point.latitude) && Math.abs(point.latitude as number) <= 90
    && Number.isFinite(point.altitude)
    && Number.isFinite(point.longitude) && Math.abs(point.longitude as number) <= 180
    && Number.isFinite(point.receivedAt) && typeof point.breakBefore === 'boolean';
};

/** Stored data is untrusted (older versions, manual edits), so anything malformed is dropped. */
export function loadTrails(maxPoints: number, storage: Storage = window.sessionStorage): FlightTrails {
  const trails: FlightTrails = new Map();
  try {
    const stored: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(stored)) return trails;
    for (const entry of stored) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) continue;
      const points = (entry[1] as unknown[]).filter(isTrailPoint).slice(-maxPoints);
      if (points.length > 0) trails.set(entry[0], points);
    }
  } catch {
    // Unreadable storage: start empty.
  }
  return trails;
}
