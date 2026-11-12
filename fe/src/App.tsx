/** @format */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { FlightDetails } from "./components/FlightDetails";
import { FlightHeader } from "./components/FlightHeader";
import { usePlaneDetails } from "./hooks/usePlaneDetails";
import { usePlanes } from "./hooks/usePlanes";
import type { AltitudeUnit } from "./types/flight";
import { autoReconnect, observedTrails } from "./lib/socket";

// Touch-only screens have no hover: a tap selects the plane and opens the sheet, so a tooltip would only
// cover neighbouring planes.
// shortcut: read once at load; plugging a mouse into a tablet needs a reload to get tooltips.
const canHover = window.matchMedia("(hover: hover)").matches;

const FlightMap = lazy(() => import("./components/FlightMap").then((module) => ({ default: module.FlightMap })));

const ignoreHover = () => {};

export function App() {
  const { planes, trails, connection, lastUpdate, reconnect: reconnectFeed } = usePlanes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [altitudeUnit, setAltitudeUnit] = useState<AltitudeUnit>("ft");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusDetails, setFocusDetails] = useState(false);
  const [reconnectFeedback, setReconnectFeedback] = useState(false);
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const detailsHadFocus = useRef(false);
  const { details, error, disconnected: detailsDisconnected, reconnect: reconnectDetails, reconnecting: detailsReconnecting } = usePlaneDetails(selectedId);
  const reconnecting = connection === "reconnecting" || detailsReconnecting || reconnectFeedback;

  useEffect(() => {
    if (!reconnectFeedback) return;
    // Keep feedback perceptible even when the backend refuses the connection immediately.
    const timer = window.setTimeout(() => setReconnectFeedback(false), 800);
    return () => window.clearTimeout(timer);
  }, [reconnectFeedback]);

  useEffect(() => {
    setHoveredId((id) => (planes.some((plane) => plane.id === id) ? id : null));
    setSelectedId((id) => (planes.some((plane) => plane.id === id) ? id : null));
  }, [planes]);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      detailsHadFocus.current = event.target instanceof Element && Boolean(event.target.closest("#flight-details"));
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);
  
  useEffect(() => {
    if (selectedId || !detailsHadFocus.current) return;
    detailsHadFocus.current = false;
    // Only recover when the removed panel left focus on the body; a trigger focus from clearSelection wins.
    if (document.activeElement && document.activeElement !== document.body) return;
    document.querySelector<HTMLElement>(".map-area")?.focus({ preventScroll: true });
  }, [selectedId]);

  const selectPlane = (id: string) => {
    // Clicking the selected plane again unselects it.
    if (id === selectedId) {
      clearSelection();
      return;
    }
    const active = document.activeElement;
    selectionTrigger.current = active instanceof HTMLElement && active.matches(".aircraft-marker") ? active : null;
    setFocusDetails(Boolean(selectionTrigger.current?.matches(":focus-visible")));
    setSelectedId(id);
  };
  const clearSelection = useCallback(() => {
    setSelectedId(null);
    if (selectionTrigger.current?.isConnected) selectionTrigger.current.focus({ preventScroll: true });
  }, []);

  // Escape is convenient when the user's attention is on the map.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedId) clearSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, clearSelection]);

  return (
    <div className="app-shell">
      <FlightHeader altitudeUnit={altitudeUnit} onAltitudeUnitChange={setAltitudeUnit} connection={connection} planeCount={planes.length} lastUpdate={lastUpdate} />

      {!autoReconnect && (connection === "offline" || detailsDisconnected || reconnecting) && (
        <div className="connection-error" role={reconnecting ? "status" : "alert"} aria-busy={reconnecting}>
          <span>{reconnecting ? "Reconnecting to the flight service…" : "Connection lost. Check the backend and reconnect."}</span>
          <button
            type="button"
            disabled={reconnecting}
            onClick={() => {
              setReconnectFeedback(true);
              if (connection === "offline") reconnectFeed();
              if (detailsDisconnected) reconnectDetails();
            }}
          >
            {reconnecting ? "Reconnecting…" : "Reconnect"}
          </button>
        </div>
      )}
      <div className="workspace">
        <main className="map-area" aria-label="Flight map" tabIndex={-1}>
          <Suspense
            fallback={
              <div className="map-loading">
                <p role="status">Loading map…</p>
              </div>
            }
          >
            <FlightMap
              planes={planes}
              trails={trails}
              selectedId={selectedId}
              details={details}
              onSelect={selectPlane}
              hoveredId={hoveredId}
              onHover={canHover ? setHoveredId : ignoreHover}
              onDeselect={() => setSelectedId(null)}
            />
          </Suspense>
          <div className="map-caption">
            {selectedId && observedTrails ? (
              <>
                Trail: lower <span className="altitude-scale" aria-hidden="true" /> higher altitude · Dotted: destination
              </>
            ) : (
              "Simulated positions · WebSocket feed"
            )}
          </div>
        </main>
        {selectedId && <FlightDetails planeId={selectedId} details={details} error={error} altitudeUnit={altitudeUnit} onClose={clearSelection} focusOnOpen={focusDetails} />}
      </div>
    </div>
  );
}
