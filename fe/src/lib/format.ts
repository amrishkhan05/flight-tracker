import type { AltitudeUnit, PlaneDetailed } from '../types/flight';

export const toFeet = (metres: number) => `${Math.round(metres * 3.28084).toLocaleString('en-US')} ft`;
export const toKnots = (metresPerSecond: number) => `${Math.round(metresPerSecond * 1.94384)} kt`;
export const toVerticalFeet = (metresPerSecond: number) => {
  const feetPerMinute = Math.round(metresPerSecond * 196.85) || 0; // `|| 0` turns -0 into 0
  return `${feetPerMinute > 0 ? '+' : ''}${feetPerMinute.toLocaleString('en-US')} ft/min`;
};
export const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const formatAltitude = (metres: number, unit: AltitudeUnit) =>
  unit === 'ft' ? toFeet(metres) : `${Math.round(metres).toLocaleString('en-US')} m`;
export const statusLabel = (status: PlaneDetailed['status']) => status === 'enroute' ? 'En route' : status;
