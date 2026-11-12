import { expect, it } from 'vitest';
import { validateFrontendEnv } from '../lib/env';

it('uses defaults when no frontend settings are provided', () => {
  expect(validateFrontendEnv({})).toEqual({
    wsBase: undefined,
    autoReconnect: true,
    observedTrails: false,
    trailMaxPoints: 1000,
  });
});

it('names the variable that fails validation', () => {
  expect(() => validateFrontendEnv({ VITE_AUTO_RECONNECT: 'yes' })).toThrow('VITE_AUTO_RECONNECT');
  expect(() => validateFrontendEnv({ VITE_OBSERVED_TRAILS: 'on' })).toThrow('VITE_OBSERVED_TRAILS');
  expect(() => validateFrontendEnv({ VITE_TRAIL_MAX_POINTS: '1' })).toThrow('VITE_TRAIL_MAX_POINTS');
  expect(() => validateFrontendEnv({ VITE_WS_BASE_URL: 'http://localhost:4000' })).toThrow('VITE_WS_BASE_URL');
});

it('accepts an explicit websocket endpoint override', () => {
  expect(validateFrontendEnv({ VITE_WS_BASE_URL: ' wss://feed.example.com:4000 ' }).wsBase)
    .toBe('wss://feed.example.com:4000');
});
