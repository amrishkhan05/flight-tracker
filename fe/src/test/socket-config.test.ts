import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('validates the observed-trail flag and bounded integer point limit', async () => {
  vi.stubGlobal('window', { location: { protocol: 'http:', hostname: 'localhost' } });
  vi.stubEnv('VITE_AUTO_RECONNECT', 'false');
  vi.stubEnv('VITE_OBSERVED_TRAILS', undefined);
  vi.stubEnv('VITE_TRAIL_MAX_POINTS', undefined);
  const defaults = await import('../lib/socket');
  expect(defaults.observedTrails).toBe(false);
  expect(defaults.trailMaxPoints).toBe(1000);
  for (const flag of ['true', 'false']) {
    vi.stubEnv('VITE_OBSERVED_TRAILS', flag);
    vi.resetModules();
    expect((await import('../lib/socket')).observedTrails).toBe(flag === 'true');
  }
  vi.stubEnv('VITE_OBSERVED_TRAILS', 'yes');
  vi.resetModules();
  await expect(import('../lib/socket')).rejects.toThrow('VITE_OBSERVED_TRAILS must be true or false');
  vi.stubEnv('VITE_OBSERVED_TRAILS', 'false');
  for (const points of ['2', '1000', '10000']) {
    vi.stubEnv('VITE_TRAIL_MAX_POINTS', points);
    vi.resetModules();
    expect((await import('../lib/socket')).trailMaxPoints).toBe(Number(points));
  }
  for (const points of ['', '0', '1', '-2', '2.5', '1e3', '10001', 'Infinity', 'NaN']) {
    vi.stubEnv('VITE_TRAIL_MAX_POINTS', points);
    vi.resetModules();
    await expect(import('../lib/socket')).rejects.toThrow('VITE_TRAIL_MAX_POINTS must be an integer between 2 and 10000');
  }
});

it('defaults to automatic reconnect and accepts only explicit boolean flags', async () => {
  vi.stubGlobal('window', { location: { protocol: 'http:', hostname: 'localhost' } });
  for (const flag of [undefined, 'true', 'false']) {
    vi.stubEnv('VITE_AUTO_RECONNECT', flag);
    vi.resetModules();
    expect((await import('../lib/socket')).autoReconnect).toBe(flag !== 'false');
  }
  vi.stubEnv('VITE_AUTO_RECONNECT', 'yes');
  vi.resetModules();
  await expect(import('../lib/socket')).rejects.toThrow('VITE_AUTO_RECONNECT must be true or false');
});
