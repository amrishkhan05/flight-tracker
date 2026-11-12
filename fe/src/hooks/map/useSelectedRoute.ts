import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { lookupAirport } from '../../data/airports';
import type { Coordinates, PlaneBasic, PlaneDetailed } from '../../types/flight';
import { createDestinationPin } from '../../lib/map/dom';
import { EMPTY, lineSource, routeCollection, samePoint } from '../../lib/map/layers';
import type { FrameListeners, Markers } from './useAircraftMarkers';

type Route = { id: string; origin: Coordinates; destination: Coordinates };

/** Dotted great-circle guide from the selected plane to its destination, plus a labelled pin. */
export function useSelectedRoute(map: maplibregl.Map | null, markers: Markers, frames: FrameListeners,
  planes: PlaneBasic[], selectedId: string | null, details: PlaneDetailed | null) {
  const routeRef = useRef<Route | null>(null);
  const pinRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    const source = lineSource(map, 'selected-route', {
      'line-color': '#e0475b', 'line-width': 2.5, 'line-opacity': 0.9, 'line-dasharray': [1, 2.5],
    });
    // Draw from the displayed position every frame so the guide never leads the aircraft.
    const follow = () => {
      const route = routeRef.current;
      const shown = route && markers.get(route.id)?.shown;
      if (!route || !shown || samePoint(route.origin, shown)) return;
      route.origin = [...shown];
      void source.setData(routeCollection(route.origin, route.destination));
    };
    frames.add(follow);
    return () => {
      frames.delete(follow);
      routeRef.current = null;
      pinRef.current?.remove();
      pinRef.current = null;
    };
  }, [map, markers, frames]);

  useEffect(() => {
    if (!map) return;
    const source = lineSource(map, 'selected-route', {});
    const plane = planes.find(({ id }) => id === selectedId);
    const code = details?.id === selectedId ? details.destination.airport : null;
    const destination = code ? lookupAirport(code) : undefined;

    if (!plane || !code || !destination) {
      if (routeRef.current) {
        routeRef.current = null;
        void source.setData(EMPTY);
      }
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }

    const position = markers.get(plane.id)?.shown ?? [plane.longitude, plane.latitude];
    const current = routeRef.current;
    // Feed refreshes re-run this effect; only a changed origin or destination is worth a worker submission.
    if (!current || current.id !== plane.id || !samePoint(current.destination, destination)
      || !samePoint(current.origin, position)) {
      routeRef.current = { id: plane.id, destination, origin: [...position] };
      void source.setData(routeCollection(position, destination));
    }
    pinRef.current ??= new maplibregl.Marker({ element: createDestinationPin(), anchor: 'bottom' });
    pinRef.current.getElement().textContent = code;
    pinRef.current.setLngLat(destination).addTo(map);
  }, [map, markers, planes, selectedId, details]);
}
