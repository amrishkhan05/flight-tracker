import { validateFrontendEnv } from './env';

/**
 * Same-origin hostname makes the default usable from another computer on a LAN.
 * A deployed HTTPS site would need a WSS proxy, configured in .env.
 */
const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
const defaultBase = `${scheme}://${window.location.hostname || 'localhost'}:4000`;

const config = validateFrontendEnv(import.meta.env);

export const socketBase = (config.wsBase ?? defaultBase).replace(/\/$/, '');
export const autoReconnect = config.autoReconnect;
export const observedTrails = config.observedTrails;
export const trailMaxPoints = config.trailMaxPoints;
