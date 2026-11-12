import { useEffect, useState } from 'react';
import { parseDetailsMessage } from '../lib/messages';
import { autoReconnect, socketBase } from '../lib/socket';
import { SILENCE_TIMEOUT_MS } from '../lib/liveness';
import type { PlaneDetailed, SubscribeMessage } from '../types/flight';

/** The details connection only exists while a plane is selected. */
export function usePlaneDetails(planeId: string | null) {
  const [details, setDetails] = useState<PlaneDetailed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [disconnected, setDisconnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // The renderer checks details.id too, so old data never flashes on a switch.
    setDetails(null);
    setError(null);
    setDisconnected(false);
    setConnecting(Boolean(planeId));
    if (!planeId) return;
    const subscription: SubscribeMessage = { type: 'subscribe', planeId };

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
      lost(1006);
    }

    function lost(code: number) {
      window.clearTimeout(silenceTimer);
      setConnecting(false);
      setDetails(null);
      if (code === 1008) {
        setError('This aircraft is no longer available.');
        return; // Do not keep subscribing to an invalid plane ID.
      }
      setError(autoReconnect ? 'Flight details disconnected. Reconnecting…' : 'Flight details disconnected.');
      setDisconnected(true);
      if (!autoReconnect) return;
      retryTimer = window.setTimeout(connect, Math.min(1000 * 2 ** attempts, 8000));
      attempts += 1;
    }

    function connect() {
      socket = new WebSocket(`${socketBase}/ws/planes/details`);
      socket.onopen = () => {
        setConnecting(false);
        setDisconnected(false);
        attempts = 0;
        armSilenceTimer();
        socket?.send(JSON.stringify(subscription));
      };
      socket.onmessage = (event: MessageEvent<unknown>) => {
        const message = parseDetailsMessage(event.data);
        if (!message) {
          console.warn('Invalid flight details message received.');
          setDetails(null);
          setError('Invalid flight details received.');
          return;
        }
        armSilenceTimer();
        if (message.type === 'error') {
          // A stream error means the cached route no longer reflects the feed.
          setDetails(null);
          setError(message.message);
          return;
        }
        if (message.type === 'plane-details' && message.data.id === planeId) {
          setDetails(message.data);
          setError(null);
          setDisconnected(false);
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = (event: CloseEvent) => {
        if (stopped) return;
        lost(event.code);
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
  }, [planeId, attempt]);

  return { details: details?.id === planeId ? details : null, error, disconnected,
    reconnecting: attempt > 0 && connecting,
    reconnect: () => {
      setConnecting(true);
      setAttempt(value => value + 1);
    } };
}
