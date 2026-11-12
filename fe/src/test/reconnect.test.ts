import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePlanes } from '../hooks/usePlanes';
import { usePlaneDetails } from '../hooks/usePlaneDetails';

const harness = vi.hoisted(() => ({
  enabled: true,
  trails: false,
  effects: [] as (() => void | (() => void))[],
  setters: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock('../lib/socket', () => ({
  socketBase: 'ws://localhost:4000',
  get autoReconnect() { return harness.enabled; },
  get observedTrails() { return harness.trails; },
  trailMaxPoints: 3,
}));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const setter = vi.fn();
    harness.setters.push(setter);
    return [initial, setter];
  },
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
  useRef: (current: unknown) => ({ current }),
}));

class Socket {
  static instances: Socket[] = [];
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  send = vi.fn();
  constructor(readonly url: string) { Socket.instances.push(this); }
  close() { this.onclose?.({ code: 1006 }); }
}

let cleanup: (() => void) | void;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.stubGlobal('WebSocket', Socket);
  Socket.instances = [];
  harness.effects = [];
  harness.setters = [];
  harness.enabled = true;
  harness.trails = false;
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

for (const kind of ['feed', 'details'] as const) {
  for (const enabled of [true, false]) {
    it(`${kind}: ${enabled ? 'automatically retries' : 'waits for manual reconnect'}`, () => {
      harness.enabled = enabled;
      const result = kind === 'feed' ? usePlanes() : usePlaneDetails('plane-1');
      cleanup = harness.effects[0]?.();
      Socket.instances[0]?.close();
      vi.advanceTimersByTime(999);
      expect(Socket.instances).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(Socket.instances).toHaveLength(enabled ? 2 : 1);
      if (!enabled) {
        vi.advanceTimersByTime(30000);
        expect(Socket.instances).toHaveLength(1);
        result.reconnect();
        const attemptSetter = harness.setters[kind === 'feed' ? 3 : 2];
        expect(attemptSetter).toHaveBeenCalled();
      } else {
        Socket.instances[1]?.close();
        vi.advanceTimersByTime(1999);
        expect(Socket.instances).toHaveLength(2);
        vi.advanceTimersByTime(1);
        expect(Socket.instances).toHaveLength(3);
      }
      Socket.instances[Socket.instances.length - 1]?.close();
      cleanup?.();
      cleanup = undefined;
      vi.advanceTimersByTime(30000);
      expect(Socket.instances).toHaveLength(enabled ? 3 : 1);
    });
  }
}

it('does not automatically resubscribe after a details policy rejection', () => {
  usePlaneDetails('plane-1');
  cleanup = harness.effects[0]?.();
  Socket.instances[0]?.onclose?.({ code: 1008 });
  vi.advanceTimersByTime(30000);
  expect(Socket.instances).toHaveLength(1);
  expect(harness.setters[1]).toHaveBeenCalledWith('This aircraft is no longer available.');
});

it('resubscribes to the selected plane and resets retry delay when connected', () => {
  usePlaneDetails('plane-2');
  cleanup = harness.effects[0]?.();
  Socket.instances[0]?.close();
  vi.advanceTimersByTime(1000);
  Socket.instances[1]?.onopen?.();
  expect(Socket.instances[1]?.send).toHaveBeenCalledWith('{"type":"subscribe","planeId":"plane-2"}');
  Socket.instances[1]?.close();
  vi.advanceTimersByTime(1000);
  expect(Socket.instances).toHaveLength(3);
});

it('reports progress immediately when manually reconnecting the feed', () => {
  harness.enabled = false;
  const result = usePlanes();
  cleanup = harness.effects[0]?.();
  Socket.instances[0]?.close();
  result.reconnect();
  expect(harness.setters[1]).toHaveBeenLastCalledWith('reconnecting');
});

it('reports details connecting progress and clears it on success or failure', () => {
  harness.enabled = false;
  const result = usePlaneDetails('plane-1');
  cleanup = harness.effects[0]?.();
  Socket.instances[0]?.close();
  result.reconnect();
  expect(harness.setters[4]).toHaveBeenLastCalledWith(true);
  Socket.instances[0]?.onopen?.();
  expect(harness.setters[4]).toHaveBeenLastCalledWith(false);
  expect(harness.setters[3]).toHaveBeenLastCalledWith(false);
  Socket.instances[0]?.close();
  expect(harness.setters[4]).toHaveBeenLastCalledWith(false);
  expect(harness.setters[3]).toHaveBeenLastCalledWith(true);
});

it('caps repeated failed connection attempts at eight seconds', () => {
  usePlanes();
  cleanup = harness.effects[0]?.();
  for (const delay of [1000, 2000, 4000, 8000, 8000]) {
    const count = Socket.instances.length;
    Socket.instances[count - 1]?.close();
    vi.advanceTimersByTime(delay - 1);
    expect(Socket.instances).toHaveLength(count);
    vi.advanceTimersByTime(1);
    expect(Socket.instances).toHaveLength(count + 1);
  }
});

for (const enabled of [false, true]) {
  it(`feed ${enabled ? 'records' : 'does not record'} trails according to its environment flag`, () => {
    harness.trails = enabled;
    usePlanes();
    cleanup = harness.effects[0]?.();
    Socket.instances[0]?.onmessage?.(new MessageEvent<unknown>('message', {
      data: JSON.stringify({ type: 'planes', data: [{
        id: 'plane-1', latitude: 45, longitude: -90, altitude: 10000, color: '#285e64',
      }] }),
    }));
    expect(harness.setters[4]?.mock.calls.length).toBe(enabled ? 1 : 0);
  });
}

