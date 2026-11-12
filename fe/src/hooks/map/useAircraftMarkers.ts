import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { useLatest } from '../useLatest';
import { bearing, fitPadding, wrapDelta, wrapLongitude } from '../../lib/geography';
import type { Coordinates, PlaneBasic } from '../../types/flight';
import { createAircraftButton } from '../../lib/map/dom';

const MOVE_DURATION_MS = 950;
const FRAME_INTERVAL_MS = 33; // ~30fps is plenty for 20 slowly moving aircraft.
const NAV_KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End', 'Escape'];

export type TrackedMarker = {
  marker: maplibregl.Marker;
  from: Coordinates;
  to: Coordinates;
  /** Where the marker is drawn right now, mid-animation. Route, trail and tooltip follow this. */
  shown: Coordinates;
  changedAt: number;
};
export type Markers = Map<string, TrackedMarker>;
/** Callbacks run once per animation frame, after markers move. */
export type FrameListeners = Set<() => void>;

/**
 * One DOM button per plane, animated between the 1-second feed updates.
 * Other map hooks read `markers` and subscribe to `frames` to stay attached to the moving aircraft.
 */
export function useAircraftMarkers(map: maplibregl.Map | null, planes: PlaneBasic[], selectedId: string | null,
  onSelect: (id: string) => void, onHover: (id: string | null) => void) {
  const markersRef = useRef<Markers>(new Map());
  const framesRef = useRef<FrameListeners>(new Set());
  const initialFitRef = useRef(false);
  const onSelectRef = useLatest(onSelect);
  const onHoverRef = useLatest(onHover);

  // A new (or retried) map starts with no markers and fits the fleet again.
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      initialFitRef.current = false;
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const markers = markersRef.current;
    const currentIds = new Set(planes.map(({ id }) => id));
    for (const plane of planes) {
      const nextPosition: Coordinates = [plane.longitude, plane.latitude];
      const existing = markers.get(plane.id);
      if (existing) {
        // Animate FROM what is on screen, rather than snapping to the last target.
        existing.from = [...existing.shown];
        existing.to = nextPosition;
        existing.changedAt = performance.now();
        if (Math.abs(existing.from[0] - nextPosition[0]) + Math.abs(existing.from[1] - nextPosition[1]) > 0.000001) {
          existing.marker.setRotation(bearing(existing.from, nextPosition));
        }
        existing.marker.getElement().style.setProperty('--plane-color', plane.color);
        continue;
      }
      const element = createAircraftButton(plane, () => onSelectRef.current(plane.id),
        (hovered) => onHoverRef.current(hovered ? plane.id : null));
      element.tabIndex = markers.size === 0 ? 0 : -1;
      addKeyboardNavigation(map, markers, plane.id, element, () => onHoverRef.current(null));
      const marker = new maplibregl.Marker({ element, anchor: 'center', rotationAlignment: 'map' })
        .setLngLat(nextPosition)
        .addTo(map);
      markers.set(plane.id, { marker, from: nextPosition, to: nextPosition, shown: nextPosition, changedAt: performance.now() });
    }

    // A plane removed by the server should not linger as a stale marker.
    for (const [id, tracked] of markers) {
      if (!currentIds.has(id)) {
        tracked.marker.remove();
        markers.delete(id);
      }
    }
    // One check after reconciliation keeps a single roving tab stop, even if the old one was removed.
    if (markers.size > 0 && ![...markers.values()].some(({ marker }) => marker.getElement().tabIndex === 0)) {
      const first = markers.values().next().value;
      if (first) first.marker.getElement().tabIndex = 0;
    }

    if (!initialFitRef.current && planes.length > 0) {
      initialFitRef.current = true;
      fitToPlanes(map, planes);
    }
  }, [map, planes, onSelectRef, onHoverRef]);

  // Selection highlighting does not wait for the next WebSocket update.
  useEffect(() => {
    for (const [id, tracked] of markersRef.current) {
      const button = tracked.marker.getElement();
      const selected = id === selectedId;
      button.classList.toggle('aircraft-marker--selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }, [selectedId, planes, map]);

  // One requestAnimationFrame loop moves every marker, then notifies the frame listeners.
  useEffect(() => {
    if (!map) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let lastFrame = 0;
    const animate = (now: number) => {
      if (now - lastFrame >= FRAME_INTERVAL_MS) {
        for (const tracked of markersRef.current.values()) {
          if (tracked.shown[0] === tracked.to[0] && tracked.shown[1] === tracked.to[1]) continue;
          const progress = reduceMotion ? 1 : Math.min((now - tracked.changedAt) / MOVE_DURATION_MS, 1);
          // Move the short way around the globe, the same way the rotation was computed.
          tracked.shown = progress === 1 ? [...tracked.to] : [
            wrapLongitude(tracked.from[0] + wrapDelta(tracked.from[0], tracked.to[0]) * progress),
            tracked.from[1] + (tracked.to[1] - tracked.from[1]) * progress,
          ];
          tracked.marker.setLngLat(tracked.shown);
        }
        framesRef.current.forEach((listener) => listener());
        lastFrame = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [map]);

  return { markers: markersRef.current, frames: framesRef.current };
}

/** Roving tab stop: Tab enters the group once, arrows/Home/End move between planes. */
function addKeyboardNavigation(map: maplibregl.Map, markers: Markers, id: string, element: HTMLButtonElement,
  dismissTooltip: () => void) {
  element.addEventListener('focus', () => {
    for (const tracked of markers.values()) {
      tracked.marker.getElement().tabIndex = tracked.marker.getElement() === element ? 0 : -1;
    }
    const shown = markers.get(id)?.shown;
    if (!shown) return;
    const point = map.project(shown);
    const canvas = map.getCanvas();
    if (point.x < 24 || point.y < 24 || point.x > canvas.clientWidth - 24 || point.y > canvas.clientHeight - 24) {
      map.panTo(shown, { duration: 0 });
    }
  });
  element.addEventListener('keydown', (event) => {
    if (!NAV_KEYS.includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') {
      dismissTooltip();
      return;
    }
    event.stopPropagation();
    const buttons = Array.from(markers.values(), (tracked) => tracked.marker.getElement());
    const index = buttons.indexOf(element);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus({ preventScroll: true });
  });
}

export function fitToPlanes(map: maplibregl.Map, planes: PlaneBasic[]) {
  if (!planes.length) return;
  const bounds = new maplibregl.LngLatBounds();
  planes.forEach((plane) => bounds.extend([plane.longitude, plane.latitude]));
  const canvas = map.getCanvas();
  map.fitBounds(bounds, {
    padding: fitPadding(canvas.clientWidth, canvas.clientHeight),
    maxZoom: 5.5,
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750,
  });
}
