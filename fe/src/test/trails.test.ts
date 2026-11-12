import { expect, it } from 'vitest';
import { TRAIL_GAP_MS, TRAIL_MAX_JUMP_KM, appendTrails, loadTrails, saveTrails, trailLines, trailSegments, type FlightTrails } from '../lib/trails';

const plane = { id: 'plane-1', latitude: 45, longitude: -90, altitude: 10000, color: '#285e64' };

it('preserves an observed loop, deduplicates stationary updates, and bounds retained points', () => {
  let trails: FlightTrails = new Map();
  const loop = [[45, -90], [46, -90], [46, -89], [45, -89], [45, -90]] as const;
  loop.forEach(([latitude, longitude], index) => {
    trails = appendTrails(trails, [{ ...plane, latitude, longitude }], 1000, index * 1000);
  });
  expect(trails.get(plane.id)?.map(point => [point.latitude, point.longitude])).toEqual(loop);
  const previous = trails;
  trails = appendTrails(trails, [plane], 1000, 5000);
  expect(trails.get(plane.id)).toHaveLength(5);
  expect(previous.get(plane.id)?.slice(-1)[0]?.receivedAt).toBe(4000);
  expect(trails.get(plane.id)?.slice(-1)[0]?.receivedAt).toBe(5000);
  trails = appendTrails(trails, [{ ...plane, latitude: 47 }], 3, 6000);
  expect(trails.get(plane.id)?.map(point => point.latitude)).toEqual([45, 45, 47]);
  expect(trailSegments(trails.get(plane.id) ?? [])).toHaveLength(1);
});

it('bridges short interruptions, and breaks only for a minute-long gap or the date line', () => {
  let trails = appendTrails(new Map(), [plane], 1000, 0);
  trails = appendTrails(trails, [{ ...plane, latitude: 46 }], 1000, 1000);
  // A reconnect or reload a few seconds later continues the same line.
  trails = appendTrails(trails, [{ ...plane, latitude: 47 }], 1000, 8000);
  expect(trailSegments(trails.get(plane.id) ?? []).map(segment => segment.length)).toEqual([3]);
  // A gap just under a minute still bridges; a full minute starts a new segment.
  trails = appendTrails(trails, [{ ...plane, latitude: 48 }], 1000, 8000 + TRAIL_GAP_MS - 1);
  expect(trails.get(plane.id)?.slice(-1)[0]?.breakBefore).toBe(false);
  trails = appendTrails(trails, [{ ...plane, latitude: 49 }], 1000, 8000 + 2 * TRAIL_GAP_MS);
  expect(trails.get(plane.id)?.slice(-1)[0]?.breakBefore).toBe(true);
  // Crossing the date line always breaks, so no line spans the map.
  trails = appendTrails(trails, [{ ...plane, latitude: 49, longitude: 179 }], 1000, 8000 + 2 * TRAIL_GAP_MS + 1000);
  trails = appendTrails(trails, [{ ...plane, latitude: 49, longitude: -179 }], 1000, 8000 + 2 * TRAIL_GAP_MS + 2000);
  expect(trails.get(plane.id)?.slice(-1)[0]?.breakBefore).toBe(true);
});

it('refreshes stationary receipt times, removes missing aircraft, and handles arbitrary IDs', () => {
  let trails = appendTrails(new Map(), [{ ...plane, id: '__proto__' }, plane], 2, 0);
  trails = appendTrails(trails, [plane], 2, 9000);
  expect(trails.has('__proto__')).toBe(false);
  trails = appendTrails(trails, [{ ...plane, latitude: 46 }], 2, 18000);
  expect(trailSegments(trails.get(plane.id) ?? [])).toHaveLength(1);
  expect(appendTrails(trails, [], 2, 19000).size).toBe(0);
  expect(appendTrails(new Map(), [plane], 2, 20000).get(plane.id)).toHaveLength(1);
});

it('saves trails and restores them after a reload, dropping malformed or excess points', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  } as Storage;
  let trails = appendTrails(new Map(), [plane], 1000, 0);
  trails = appendTrails(trails, [{ ...plane, latitude: 46 }], 1000, 1000);
  trails = appendTrails(trails, [{ ...plane, latitude: 47 }], 1000, 2000);
  saveTrails(trails, storage);
  expect(loadTrails(1000, storage)).toEqual(trails);
  expect(loadTrails(2, storage).get(plane.id)?.map(point => point.latitude)).toEqual([46, 47]);

  store.set('flight-radar:trails', JSON.stringify([['plane-1', [{ latitude: 'x' }]], ['plane-2', 5], 'junk']));
  expect(loadTrails(1000, storage).size).toBe(0);
  store.set('flight-radar:trails', '{not json');
  expect(loadTrails(1000, storage).size).toBe(0);
});

it('colours each flown piece by its average altitude and marks gaps with a connector, never across the date line', () => {
  let trails = appendTrails(new Map(), [{ ...plane, altitude: 6000 }], 1000, 0);
  trails = appendTrails(trails, [{ ...plane, latitude: 46, altitude: 8000 }], 1000, 1000);
  trails = appendTrails(trails, [{ ...plane, latitude: 47, altitude: 9000 }], 1000, 1000 + TRAIL_GAP_MS); // long outage
  trails = appendTrails(trails, [{ ...plane, latitude: 48, altitude: 9000 }], 1000, 2000 + TRAIL_GAP_MS);
  const { flown, gaps } = trailLines(trails.get(plane.id) ?? []);
  expect(flown.map((piece) => piece.altitude)).toEqual([7000, 9000]);
  expect(gaps).toEqual([[[-90, 46], [-90, 47]]]); // from the last point before the gap to the first after

  let wrapped = appendTrails(new Map(), [{ ...plane, longitude: 178 }], 1000, 0);
  wrapped = appendTrails(wrapped, [{ ...plane, longitude: 179 }], 1000, 1000);
  wrapped = appendTrails(wrapped, [{ ...plane, longitude: -179 }], 1000, 2000); // crosses the date line
  wrapped = appendTrails(wrapped, [{ ...plane, longitude: -178 }], 1000, 3000);
  expect(trailLines(wrapped.get(plane.id) ?? []).gaps).toEqual([]);
});

it('drops stored trails saved before altitude was recorded', () => {
  const storage = { getItem: () => JSON.stringify([['plane-1', [{ latitude: 1, longitude: 2, receivedAt: 0, breakBefore: true }]]]) } as unknown as Storage;
  expect(loadTrails(1000, storage).size).toBe(0);
});

it('breaks the trail when a backend restart puts the same plane ID somewhere new', () => {
  const start = { ...plane, latitude: 40, longitude: -100 };
  let trails = appendTrails(new Map(), [start], 1000, 0);
  // Normal flight: ~2 km in a second is joined.
  trails = appendTrails(trails, [{ ...start, latitude: 40.02 }], 1000, 1000);
  expect(trails.get(plane.id)?.slice(-1)[0]?.breakBefore).toBe(false);
  // Restart: the same ID reappears about 2,500 km away three seconds later.
  trails = appendTrails(trails, [{ ...start, latitude: 58, longitude: -80 }], 1000, 4000);
  expect(trails.get(plane.id)?.slice(-1)[0]?.breakBefore).toBe(true);
  trails = appendTrails(trails, [{ ...start, latitude: 58.02, longitude: -80 }], 1000, 5000); // flies on from there
  expect(trailLines(trails.get(plane.id) ?? []).flown).toHaveLength(2); // one piece each side, none across the jump
  expect(trailLines(trails.get(plane.id) ?? []).gaps).toEqual([]); // and no "no data" connector either
  expect(TRAIL_MAX_JUMP_KM).toBeGreaterThan(120); // still above a minute of simulated flight
});
