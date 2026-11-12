import { describe, expect, it } from 'vitest';
import { lookupAirport } from '../data/airports';
import { fitPadding, splitAtDateLine, wrapDelta } from '../lib/geography';

describe('date-line movement and guides', () => {
  it('moves longitude over the shorter wrapped distance in both directions', () => {
    expect(wrapDelta(170, -170)).toBe(20);
    expect(wrapDelta(-170, 170)).toBe(-20);
    expect(wrapDelta(10, 30)).toBe(20);
  });

  it('splits a guide at the antimeridian so no segment spans the world', () => {
    const parts = splitAtDateLine([[170, 0], [179, 0], [-179, 0], [-170, 0]]);
    expect(parts).toEqual([[[170, 0], [179, 0]], [[-179, 0], [-170, 0]]]);
  });

  it('keeps an unbroken guide as a single part', () => {
    expect(splitAtDateLine([[0, 0], [10, 5], [20, 10]])).toHaveLength(1);
  });
});

describe('narrow-screen fit', () => {
  it('fits longitudes -75 and 65 inside a 320 px canvas at the minimum zoom', () => {
    const padding = fitPadding(320, 480);
    const worldPixels = 512;
    const spanPixels = ((65 - -75) / 360) * worldPixels;
    expect(padding.left).toBeGreaterThan(0);
    expect(spanPixels + padding.left + padding.right).toBeLessThanOrEqual(320);
  });
});

describe('airport lookup', () => {
  it('returns coordinates for a known code', () => {
    expect(lookupAirport('JFK')).toBeDefined();
  });

  it('treats inherited object keys as unknown airports', () => {
    expect(lookupAirport('constructor')).toBeUndefined();
    expect(lookupAirport('__proto__')).toBeUndefined();
    expect(lookupAirport('toString')).toBeUndefined();
  });
});
