import { useEffect, useRef } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { wrapDelta } from '../../lib/geography';
import { trailLines, type FlightTrails } from '../../lib/trails';
import type { Coordinates } from '../../types/flight';
import { ALTITUDE_COLOR, EMPTY, altitudeCollection, lineCollection, lineSource, samePoint } from '../../lib/map/layers';
import type { FrameListeners, Markers } from './useAircraftMarkers';

const TRAIL_PAINT = { 'line-color': ALTITUDE_COLOR, 'line-width': 3 };
// Faint and dotted: "we had no data here", not a flown path.
const GAP_PAINT = { 'line-color': '#8a9aa3', 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [1, 2] };

type Tip = { id: string; anchor: Coordinates; tip: Coordinates; altitude: number };

/**
 * The selected plane's recorded path, coloured by altitude, with dotted connectors across gaps.
 * A separate two-point "tip" joins the newest recorded point to the animated marker, so animation
 * never resubmits the whole history.
 */
export function useObservedTrail(map: MapLibreMap | null, markers: Markers, frames: FrameListeners,
  enabled: boolean, selectedId: string | null, trails: FlightTrails) {
  const tipRef = useRef<Tip | null>(null);

  useEffect(() => {
    if (!map || !enabled) return;
    // Added in drawing order: gaps under the trail.
    lineSource(map, 'observed-trail-gaps', GAP_PAINT);
    lineSource(map, 'observed-trail', TRAIL_PAINT);
    const tipSource = lineSource(map, 'observed-trail-tip', TRAIL_PAINT);
    const follow = () => {
      const tip = tipRef.current;
      const shown = tip && markers.get(tip.id)?.shown;
      if (tip && shown) updateTip(tipSource, tip, shown);
    };
    frames.add(follow);
    return () => {
      frames.delete(follow);
      tipRef.current = null;
    };
  }, [map, enabled, markers, frames]);

  useEffect(() => {
    if (!map || !enabled) return;
    const gapSource = lineSource(map, 'observed-trail-gaps', GAP_PAINT);
    const source = lineSource(map, 'observed-trail', TRAIL_PAINT);
    const tipSource = lineSource(map, 'observed-trail-tip', TRAIL_PAINT);
    const points = selectedId ? trails.get(selectedId) ?? [] : [];
    const { flown, gaps } = trailLines(points);
    void source.setData(altitudeCollection(flown));
    void gapSource.setData(lineCollection(gaps));

    // The live tip extends from the newest recorded point only when that point is part of the drawn trail.
    const newest = points[points.length - 1];
    if (selectedId && newest && !newest.breakBefore) {
      const anchor: Coordinates = [newest.longitude, newest.latitude];
      const tip: Tip = { id: selectedId, anchor, tip: anchor, altitude: newest.altitude };
      tipRef.current = tip;
      void tipSource.setData(altitudeCollection([{ from: anchor, to: anchor, altitude: tip.altitude }]));
      const shown = markers.get(selectedId)?.shown;
      if (shown) updateTip(tipSource, tip, shown);
    } else {
      tipRef.current = null;
      void tipSource.setData(EMPTY);
    }
  }, [map, enabled, markers, selectedId, trails]);
}

/** Unwrapped across the date line so the tip never spans the world. */
function updateTip(source: GeoJSONSource, tip: Tip, shown: Coordinates) {
  const next: Coordinates = [tip.anchor[0] + wrapDelta(tip.anchor[0], shown[0]), shown[1]];
  if (samePoint(next, tip.tip)) return;
  tip.tip = next;
  void source.setData(altitudeCollection([{ from: tip.anchor, to: next, altitude: tip.altitude }]));
}
