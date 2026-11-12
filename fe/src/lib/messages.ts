import type { Airport, PlaneBasic, PlaneDetailed } from '../types/flight';

/** JSON from a socket is untrusted until checked; do not cast it blindly. */
export function parseBasicMessage(raw: unknown): PlaneBasic[] | null {
  if (typeof raw !== 'string') return null;
  try {
    const message: unknown = JSON.parse(raw);
    if (!isRecord(message) || message.type !== 'planes' || !Array.isArray(message.data)) return null;

    // A snapshot is applied all-or-nothing: one bad row rejects the whole broadcast.
    const rows: unknown[] = message.data;
    if (!rows.every(isPlaneBasic)) return null;
    const ids = new Set<string>();
    for (const row of rows) {
      if (ids.has(row.id)) return null;
      ids.add(row.id);
    }
    return rows;
  } catch {
    return null;
  }
}

export function parseDetailsMessage(raw: unknown):
  | { type: 'plane-details'; data: PlaneDetailed }
  | { type: 'error'; message: string }
  | null {
  if (typeof raw !== 'string') return null;
  try {
    const message: unknown = JSON.parse(raw);
    if (!isRecord(message)) return null;

    if (message.type === 'error' && typeof message.message === 'string') {
      return { type: 'error', message: message.message };
    }

    if (message.type === 'plane-details' && isPlaneDetailed(message.data)) {
      return { type: 'plane-details', data: message.data };
    }
  } catch {
    // Ignore malformed messages without crashing the screen.
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPlaneBasic(value: unknown): value is PlaneBasic {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    isNumber(value.latitude) && Math.abs(value.latitude) <= 90 &&
    isNumber(value.longitude) && Math.abs(value.longitude) <= 180 &&
    isNumber(value.altitude) &&
    typeof value.color === 'string';
}

function isPlaneDetailed(value: unknown): value is PlaneDetailed {
  return isRecord(value) &&
    typeof value.model === 'string' &&
    typeof value.airline === 'string' &&
    typeof value.flightNumber === 'string' &&
    typeof value.registration === 'string' &&
    isNumber(value.speed) && isNumber(value.heading) &&
    isNumber(value.verticalSpeed) &&
    isAirport(value.origin) && isAirport(value.destination) &&
    isNumber(value.flightDuration) && isNumber(value.estimatedArrival) &&
    !Number.isNaN(new Date(value.estimatedArrival).getTime()) &&
    isNumber(value.numberOfPassengers) && isNumber(value.maxPassengers) &&
    typeof value.status === 'string' &&
    ['departed', 'enroute', 'cruising', 'landing'].includes(value.status) &&
    isPlaneBasic(value);
}

function isAirport(value: unknown): value is Airport {
  return isRecord(value) && typeof value.airport === 'string' && typeof value.city === 'string';
}
