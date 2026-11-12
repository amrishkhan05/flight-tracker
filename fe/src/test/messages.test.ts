import { describe, expect, it } from 'vitest';
import { parseBasicMessage, parseDetailsMessage } from '../lib/messages';
import type { PlaneDetailed } from '../types/flight';

const plane = { id: 'plane-1', longitude: -75, latitude: 45, altitude: 9000, color: '#ffffff' };

describe('WebSocket messages', () => {
  it('accepts a valid basic broadcast', () => {
    expect(parseBasicMessage(JSON.stringify({ type: 'planes', data: [plane] }))).toEqual([plane]);
  });

  it('rejects invalid JSON and out-of-range coordinates', () => {
    expect(parseBasicMessage('{')).toBeNull();
    expect(parseBasicMessage(JSON.stringify({ type: 'planes', data: [{ ...plane, latitude: 999 }] }))).toBeNull();
  });

  it('rejects a whole snapshot with a malformed row or duplicate aircraft ID', () => {
    const other = { ...plane, id: 'plane-2' };
    expect(parseBasicMessage(JSON.stringify({ type: 'planes', data: [plane, other] }))).toEqual([plane, other]);
    expect(parseBasicMessage(JSON.stringify({ type: 'planes', data: [plane, { ...other, id: 'plane-1' }] }))).toBeNull();
    expect(parseBasicMessage(JSON.stringify({ type: 'planes', data: [plane, { ...other, altitude: 'high' }] }))).toBeNull();
  });

  it('accepts a valid empty snapshot as an empty fleet', () => {
    expect(parseBasicMessage(JSON.stringify({ type: 'planes', data: [] }))).toEqual([]);
  });

  it('accepts a complete subscribed flight and rejects incomplete details', () => {
    const detail: PlaneDetailed = {
      ...plane,
      model: 'Boeing 737', airline: 'Airline Name', flightNumber: 'AA123', registration: 'N12345',
      speed: 283, heading: 180, verticalSpeed: 0,
      origin: { airport: 'JFK', city: 'New York' },
      destination: { airport: 'LAX', city: 'Los Angeles' },
      flightDuration: 125, estimatedArrival: 1794500000000,
      numberOfPassengers: 180, maxPassengers: 200, status: 'cruising',
    };
    expect(parseDetailsMessage(JSON.stringify({ type: 'plane-details', data: detail })))
      .toEqual({ type: 'plane-details', data: detail });
    expect(parseDetailsMessage(JSON.stringify({ type: 'plane-details', data: { ...detail, heading: null } })))
      .toBeNull();
    for (const status of [['cruising'], { status: 'cruising' }, 1, null]) {
      expect(parseDetailsMessage(JSON.stringify({ type: 'plane-details', data: { ...detail, status } })))
        .toBeNull();
    }
    expect(parseDetailsMessage(JSON.stringify({
      type: 'plane-details', data: { ...detail, estimatedArrival: 1e20 },
    }))).toBeNull();
  });

  it('recognizes backend error messages', () => {
    expect(parseDetailsMessage('{"type":"error","message":"Plane not found"}'))
      .toEqual({ type: 'error', message: 'Plane not found' });
  });

  it('rejects non-text socket payloads before JSON parsing', () => {
    for (const raw of [null, 42, { type: 'planes', data: [plane] }, new Uint8Array([123])]) {
      expect(parseBasicMessage(raw)).toBeNull();
      expect(parseDetailsMessage(raw)).toBeNull();
    }
  });
});
