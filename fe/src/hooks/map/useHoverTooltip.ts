import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { PlaneBasic } from '../../types/flight';
import { TOOLTIP_ID, tooltipContent } from '../../lib/map/dom';
import type { FrameListeners, Markers } from './useAircraftMarkers';

/**
 * Small card with the plane's ID above the hovered or focused plane; it follows the marker while it
 * animates. It uses only the live feed, so hovering opens no extra connections.
 */
export function useHoverTooltip(map: maplibregl.Map | null, markers: Markers, frames: FrameListeners,
  planes: PlaneBasic[], id: string | null) {
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const followIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map) return;
    const follow = () => {
      const shown = followIdRef.current && markers.get(followIdRef.current)?.shown;
      if (shown) popupRef.current?.setLngLat(shown);
    };
    frames.add(follow);
    return () => {
      frames.delete(follow);
      popupRef.current?.remove();
      popupRef.current = null;
    };
  }, [map, markers, frames]);

  useEffect(() => {
    const tracked = id ? markers.get(id) : undefined;
    followIdRef.current = tracked ? id : null;
    if (!map || !id || !tracked) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }
    const color = planes.find((plane) => plane.id === id)?.color ?? '#285e64';
    const button = tracked.marker.getElement();
    button.setAttribute('aria-describedby', `map-keyboard-help ${TOOLTIP_ID}`);
    popupRef.current ??= new maplibregl.Popup({
      className: 'flight-tooltip', closeButton: false, closeOnClick: false,
      anchor: 'bottom', offset: 24, maxWidth: '240px',
    });
    popupRef.current.setLngLat(tracked.shown)
      .setDOMContent(tooltipContent(id, color));
    // Add once; later updates only swap the content, so the card never blinks.
    if (!popupRef.current.isOpen()) popupRef.current.addTo(map);
    return () => button.setAttribute('aria-describedby', 'map-keyboard-help');
  }, [map, markers, planes, id]);
}
