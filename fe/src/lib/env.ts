/** Shared by the runtime config (socket.ts) and the build config (vite.config.ts). */
export interface FrontendEnv {
  VITE_WS_BASE_URL?: string;
  VITE_AUTO_RECONNECT?: string;
  VITE_OBSERVED_TRAILS?: string;
  VITE_TRAIL_MAX_POINTS?: string;
}

export function validateFrontendEnv(env: FrontendEnv) {
  const base = env.VITE_WS_BASE_URL?.trim() ?? '';
  if (base && !/^wss?:\/\/[^\s/]+/.test(base)) {
    throw new Error(`VITE_WS_BASE_URL must start with ws:// or wss:// and include a host (received "${base}").`);
  }

  const reconnect = env.VITE_AUTO_RECONNECT?.trim() ?? 'true';
  if (reconnect !== 'true' && reconnect !== 'false') {
    throw new Error(`VITE_AUTO_RECONNECT must be true or false (received "${reconnect}").`);
  }

  const trails = env.VITE_OBSERVED_TRAILS?.trim() ?? 'false';
  if (trails !== 'true' && trails !== 'false') {
    throw new Error(`VITE_OBSERVED_TRAILS must be true or false (received "${trails}").`);
  }

  const points = env.VITE_TRAIL_MAX_POINTS?.trim() ?? '1000';
  const trailMaxPoints = Number(points);
  if (!/^\d+$/.test(points) || !Number.isSafeInteger(trailMaxPoints) || trailMaxPoints < 2 || trailMaxPoints > 10000) {
    throw new Error(`VITE_TRAIL_MAX_POINTS must be an integer between 2 and 10000 (received "${points}").`);
  }

  return {
    wsBase: base || undefined,
    autoReconnect: reconnect === 'true',
    observedTrails: trails === 'true',
    trailMaxPoints,
  };
}
