import { useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css'; // loads with this lazy chunk, not with the first paint
import { observedTrails } from '../lib/socket';
import type { FlightTrails } from '../lib/trails';
import type { PlaneBasic, PlaneDetailed } from '../types/flight';
import { fitToPlanes, useAircraftMarkers } from '../hooks/map/useAircraftMarkers';
import { useHoverTooltip } from '../hooks/map/useHoverTooltip';
import { useKeepSelectionVisible } from '../hooks/map/useKeepSelectionVisible';
import { useMapInstance } from '../hooks/map/useMapInstance';
import { useObservedTrail } from '../hooks/map/useObservedTrail';
import { useSelectedRoute } from '../hooks/map/useSelectedRoute';

type Props = {
  planes: PlaneBasic[];
  trails: FlightTrails;
  selectedId: string | null;
  details: PlaneDetailed | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
};

/**
 * MapLibre owns the map DOM; React passes data in and the map is never remounted.
 * Each concern lives in its own hook; they share the animated marker positions.
 */
export function FlightMap({ planes, trails, selectedId, details, onSelect, onDeselect,
  hoveredId, onHover }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, error, retry } = useMapInstance(containerRef, onDeselect);
  const { markers, frames } = useAircraftMarkers(map, planes, selectedId, onSelect, onHover);
  // Trail before route, so the dotted guide draws on top of the solid trail.
  useObservedTrail(map, markers, frames, observedTrails, selectedId, trails);
  useSelectedRoute(map, markers, frames, planes, selectedId, details);
  useKeepSelectionVisible(map, markers, selectedId);
  useHoverTooltip(map, markers, frames, planes, hoveredId);

  return (
    <>
      <p id="map-keyboard-help" className="sr-only">
        Tab to an aircraft. Use arrow keys to choose another, Home or End for the first or last.
        Enter or Space opens its details. Escape dismisses the tooltip.
      </p>
      <div ref={containerRef} className="map-canvas" aria-label="Interactive aircraft map" />
      <button type="button" className="map-toolbar__fit" onClick={() => map && fitToPlanes(map, planes)}
        disabled={!map || planes.length === 0}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>
        Show all
      </button>
      {error && (
        <div className="map-error" role="status">
          <span>Map tiles could not load. Check your internet connection.</span>
          <button type="button" onClick={retry}>Retry map</button>
        </div>
      )}
    </>
  );
}
