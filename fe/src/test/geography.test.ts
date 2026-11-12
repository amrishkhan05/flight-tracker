import { describe, expect, it } from 'vitest';
import { bearing, greatCircle } from '../lib/geography';

const JFK = [-73.7781, 40.6413] as const;
const LHR = [-0.4543, 51.47] as const;

describe('geography helpers', () => {
  it('rotates aircraft toward east, south and west correctly', () => {
    expect(bearing([0, 0], [1, 0])).toBeCloseTo(90);
    expect(bearing([0, 0], [0, -1])).toBeCloseTo(180);
    expect(bearing([0, 0], [-1, 0])).toBeCloseTo(270);
  });

  it('matches projected diagonal movement at high latitude', () => {
    expect(bearing([0, 60], [0.01, 60.01])).toBeCloseTo(26.56, 1);
    expect(bearing([0.01, 60.01], [0, 60])).toBeCloseTo(206.56, 1);
  });

  it('uses the shortest direction across the date line', () => {
    expect(bearing([179.99, 45], [-179.99, 45])).toBeCloseTo(90);
    expect(bearing([-179.99, 45], [179.99, 45])).toBeCloseTo(270);
  });

  it('keeps the route endpoints at the aircraft and the destination', () => {
    const points = greatCircle([...JFK], [...LHR]);
    expect(points).toHaveLength(65);
    expect(points[0]).toEqual(JFK);
    expect(points[points.length - 1]).toEqual(LHR);
    expect(points.every(point => point.every(Number.isFinite))).toBe(true);
  });

  it('handles coincident positions without NaN', () => {
    expect(greatCircle([10, 15], [10, 15])).toEqual([[10, 15], [10, 15]]);
  });

  it('keeps nearly coincident positions finite and preserves their endpoints', () => {
    const from: [number, number] = [10, 15];
    const to: [number, number] = [10.00000001, 15.00000001];
    expect(greatCircle(from, to)).toEqual([from, to]);
  });
});
