import { MercatorCoordinate } from 'maplibre-gl';
import type { Coordinates } from '../types/flight';

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const toDegrees = (radians: number) => radians * 180 / Math.PI;

/** Direction of travel on the Mercator map, clockwise from map north. */
export function bearing(from: Coordinates, to: Coordinates): number {
  const start = MercatorCoordinate.fromLngLat(from);
  const end = MercatorCoordinate.fromLngLat(to);
  const dx = ((end.x - start.x + 1.5) % 1) - 0.5;
  return (toDegrees(Math.atan2(dx, start.y - end.y)) + 360) % 360;
}

/**
 * Points on the shortest spherical arc between an aircraft and its destination.
 * A straight longitude/latitude interpolation is noticeably wrong on world maps.
 * This is a visual guide, NOT a filed route or the path already flown.
 */
export function greatCircle(from: Coordinates, to: Coordinates, steps = 64): Coordinates[] {
  const vector = ([longitude, latitude]: Coordinates): [number, number, number] => {
    const lat = toRadians(latitude);
    const lon = toRadians(longitude);
    return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  };

  const a = vector(from);
  const b = vector(to);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  // Identical positions can have a dot product slightly below 1 after rounding.
  if (dot > 1 - 1e-12) return [from, to];
  const angle = Math.acos(dot);

  const points: Coordinates[] = [from];
  for (let step = 1; step < steps; step++) {
    const progress = step / steps;
    const weightA = Math.sin((1 - progress) * angle) / Math.sin(angle);
    const weightB = Math.sin(progress * angle) / Math.sin(angle);
    const x = weightA * a[0] + weightB * b[0];
    const y = weightA * a[1] + weightB * b[1];
    const z = weightA * a[2] + weightB * b[2];
    points.push([toDegrees(Math.atan2(y, x)), toDegrees(Math.atan2(z, Math.hypot(x, y)))]);
  }

  points.push(to);
  return points;
}

/** Wraps a longitude into [-180, 180). */
export function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/** Signed longitude change along the shorter way around the globe. */
export function wrapDelta(from: number, to: number): number {
  return wrapLongitude(to - from);
}

/** Splits a line wherever consecutive points jump across the antimeridian, so nothing spans the world. */
export function splitAtDateLine(points: Coordinates[]): Coordinates[][] {
  const parts: Coordinates[][] = [];
  let current: Coordinates[] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (previous && Math.abs(point[0] - previous[0]) > 180) {
      parts.push(current);
      current = [];
    }
    current.push(point);
  });
  if (current.length) parts.push(current);
  return parts;
}

/**
 * Fit padding scales with the canvas, so a 320px phone can still fit the fleet.
 * Fixed 70px sides would leave less room than the aircraft span.
 */
export function fitPadding(width: number, height: number) {
  const horizontal = Math.min(70, Math.floor(width * 0.1));
  const vertical = Math.min(95, Math.floor(height * 0.15));
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}
