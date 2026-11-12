import { expect, it } from 'vitest';
import { formatAltitude, statusLabel, toVerticalFeet } from '../lib/format';

it('formats altitude the same way everywhere, in either unit', () => {
  expect(formatAltitude(10668.4, 'm')).toBe('10,668 m');
  expect(formatAltitude(10668, 'ft')).toBe('35,000 ft');
});

it('labels statuses and never shows minus zero for a tiny descent', () => {
  expect(statusLabel('enroute')).toBe('En route');
  expect(statusLabel('cruising')).toBe('cruising');
  expect(toVerticalFeet(-0.002)).toBe('0 ft/min');
  expect(toVerticalFeet(1)).toBe('+197 ft/min');
  expect(toVerticalFeet(-1)).toBe('-197 ft/min');
});
