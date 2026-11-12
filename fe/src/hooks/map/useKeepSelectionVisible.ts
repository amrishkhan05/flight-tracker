import { useEffect } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Markers } from './useAircraftMarkers';

/**
 * On narrow screens the details card covers part of the map (see styles.css, max-width 900px).
 * If the newly selected plane sits under the card, pan it into the uncovered part. Wide screens
 * show the panel beside the map, so the camera is left alone there.
 */
export function useKeepSelectionVisible(map: MapLibreMap | null, markers: Markers, selectedId: string | null) {
  useEffect(() => {
    const shown = selectedId ? markers.get(selectedId)?.shown : undefined;
    const panel = document.getElementById('flight-details');
    if (!map || !shown || !panel || !window.matchMedia('(max-width: 900px)').matches) return;
    const canvas = map.getCanvas().getBoundingClientRect();
    // Use the card's final position because the slide-in transform temporarily moves it down.
    const parent = panel.offsetParent?.getBoundingClientRect() ?? { top: 0, left: 0 };
    const card = {
      top: parent.top + panel.offsetTop,
      left: parent.left + panel.offsetLeft,
      right: parent.left + panel.offsetLeft + panel.offsetWidth,
    };
    const point = map.project(shown);
    const x = canvas.left + point.x;
    const y = canvas.top + point.y;
    const margin = 32;
    const covered = y > card.top - margin && x > card.left - margin && x < card.right + margin;
    if (!covered) return;
    // Centre the plane in the strip above the card.
    const target = (card.top - canvas.top) / 2;
    map.panBy([0, point.y - target], {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400,
    });
  }, [map, markers, selectedId]);
}
