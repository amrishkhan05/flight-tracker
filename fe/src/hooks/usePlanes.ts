import { useEffect, useRef, useState } from 'react';
import { parseBasicMessage } from '../lib/messages';
import { SILENCE_TIMEOUT_MS } from '../lib/liveness';
import { autoReconnect, socketBase, observedTrails, trailMaxPoints } from '../lib/socket';
import { appendTrails, loadTrails, saveTrails, type FlightTrails, type TrailPoint } from '../lib/trails';
import type { ConnectionState, PlaneBasic } from '../types/flight';

export function usePlanes() {
  const [planes, setPlanes] = useState<PlaneBasic[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Restored trails resume after a reload: an update a few seconds later continues the same line (see TRAIL_GAP_MS).
  const [trails, setTrails] = useState<FlightTrails>(
    () => observedTrails ? loadTrails(trailMaxPoints) : new Map<string, TrailPoint[]>());
  const trailsRef = useRef(trails);
  trailsRef.current = trails;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let silenceTimer: number | undefined;
    let stopped = false;
    let attempts = 0;

    function armSilenceTimer() {
      window.clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(onSilence, SILENCE_TIMEOUT_MS);
    }

    function onSilence() {
      // An open socket that stops delivering frames may never fire onclose, so retire it here.
      const stale = socket;
      socket = null;
      if (stale) stale.onopen = stale.onmessage = stale.onerror = stale.onclose = null;
      stale?.close();
      lost();
    }

    function lost() {
      window.clearTimeout(silenceTimer);
      if (!autoReconnect) {
        setConnection('offline');
        return;
      }
      setConnection('reconnecting');
      const delay = Math.min(1000 * 2 ** attempts, 8000);
      attempts += 1;
      retryTimer = window.setTimeout(connect, delay);
    }

    function connect() {
      setConnection(attempt === 0 && attempts === 0 ? 'connecting' : 'reconnecting');
      socket = new WebSocket(`${socketBase}/ws/planes/basic`);

      socket.onopen = () => {
        attempts = 0;
        armSilenceTimer();
      };

      socket.onmessage = (event: MessageEvent<unknown>) => {
        const nextPlanes = parseBasicMessage(event.data);
        if (nextPlanes === null) {
          console.warn('Invalid flight feed message received; retaining last known positions.');
          return;
        }
        armSilenceTimer();
        // Live means a valid snapshot has arrived, not merely that the socket opened.
        setConnection('live');
        if (observedTrails) {
          const receivedAt = Date.now();
          setTrails(previous => appendTrails(previous, nextPlanes, trailMaxPoints, receivedAt));
        }
        setPlanes(nextPlanes);
        setLastUpdate(new Date());
      };

      socket.onerror = () => socket?.close(); // onclose handles the retry
      socket.onclose = () => {
        if (stopped) return;
        lost();
      };
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(silenceTimer);
      if (socket) socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket?.close();
    };
  }, [attempt]);

  useEffect(() => {
    if (!observedTrails) return;
    // Save once when the page goes away, not on every 1-second update.
    const save = () => saveTrails(trailsRef.current);
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, []);

  return { planes, trails, connection, lastUpdate, reconnect: () => {
    setConnection('reconnecting');
    setAttempt(value => value + 1);
  } };
}
