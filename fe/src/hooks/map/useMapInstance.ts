import { useEffect, useState, type RefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useLatest } from '../useLatest';

// MapLibre 6 builds its worker URL at runtime, so Vite cannot see it: dev pre-bundling 404s it and the
// production build omits it ("Worker failed to load", map never draws). `?url` makes Vite serve and emit it.
maplibregl.setWorkerUrl(workerUrl);

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Owns the MapLibre instance. `map` is null until the style has loaded, so every other map hook
 * can simply wait for a non-null map. Retry recreates the map from scratch.
 */
export function useMapInstance(containerRef: RefObject<HTMLDivElement | null>, onBackgroundClick: () => void) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onBackgroundClickRef = useLatest(onBackgroundClick);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setError(false);
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container,
        style: MAP_STYLE,
        center: [-52, 44],
        zoom: 2.4,
        // Low enough that a 320px canvas can fit aircraft on opposite sides of the world.
        minZoom: 0,
        maxZoom: 13,
        attributionControl: false,
      });
    } catch {
      setError(true);
      return;
    }

    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(container);
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    // Only a style failure breaks the map. Tile errors after that are normal and must not show the banner
    // (isStyleLoaded() stays false while tiles are still loading, so it cannot tell the two apart).
    let styleLoaded = false;
    instance.on('style.load', () => {
      styleLoaded = true;
      setError(false);
      setMap(instance);
    });
    instance.on('error', () => {
      if (!styleLoaded) setError(true);
    });
    // Clicking empty map (not a marker or popup) unselects the plane, like closing the panel.
    instance.on('click', (event) => {
      if (event.originalEvent.target === instance.getCanvas()) onBackgroundClickRef.current();
    });

    return () => {
      resizeObserver.disconnect();
      setMap(null);
      instance.remove(); // React StrictMode can mount and clean up effects twice.
    };
  }, [attempt, containerRef, onBackgroundClickRef]);

  return { map, error, retry: () => setAttempt((value) => value + 1) };
}
