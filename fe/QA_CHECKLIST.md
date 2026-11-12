# Flight Radar — manual acceptance checklist

Use this after installing dependencies and starting the supplied backend and frontend.

- [ ] Open `http://localhost:5173`: the light map fills the workspace with no aircraft sidebar.
- [ ] Connection state changes to **Live** and the aircraft count matches `PLANES_COUNT` (20 by default).
- [ ] Wait 2–3 seconds: airplane markers move smoothly and turn along their travel direction.
- [ ] Select an aircraft marker: the details WebSocket subscribes; flight number, model, speed, altitude, heading, passengers and ETA appear.
- [ ] A dashed line appears **from the selected plane to its destination airport**. Destination code is labelled on the map.
- [ ] Select a different marker: the old details and destination are replaced; no previous flight details flash.
- [ ] Click the selected marker again: the panel, pin, and route disappear. Select again, then try X, Escape, and clicking empty map: each one unselects.
- [ ] Tab to an aircraft, use arrows/Home/End to change aircraft, then Enter/Space to open details. Focus moves to Close; Escape or keyboard activation of Close returns focus to the aircraft. Tab leaves the aircraft group.
- [ ] Shift+Tab from Close to the panel, then use arrow keys to scroll overflowing details. Live updates preserve focus; focusing an offscreen aircraft brings it into view.
- [ ] Click **Show all** after panning/zooming to frame the live aircraft again.
- [ ] Turn off the backend: the header says Reconnecting, existing markers remain visible, and no fictional new aircraft appear.
- [ ] With `VITE_AUTO_RECONNECT=true`, restart the backend: feed and selected details reconnect automatically without losing selection.
- [ ] With `VITE_AUTO_RECONNECT=false`, restart the backend: no socket retries occur until Reconnect is clicked. Check feed and selected details.
- [ ] With the backend stopped, click Reconnect twice in separate attempts: each click shows a teal banner, spinner, and disabled "Reconnecting…" button for at least 800 ms before restoring Reconnect. Reduced-motion mode keeps the indicator static.
- [ ] Set `VITE_OBSERVED_TRAILS=true` and restart Vite: selecting an aircraft shows its trail shaded light (lower) to dark (higher), separate from the coral dotted destination guide. Reloading the page or restarting the backend briefly keeps the trail as one unbroken line. Closing hides it; selecting another aircraft shows only that aircraft's trail.
- [ ] Set `VITE_TRAIL_MAX_POINTS=3`: after four distinct positions, only the latest three remain. Stationary updates do not add points. A connection gap of a minute or more shows a faint grey dotted connector; shorter drops do not. Restarting the backend (planes reappear elsewhere) never draws a line across the jump; a removed aircraft loses its history.
- [ ] With `VITE_OBSERVED_TRAILS=false`, no trail is recorded or drawn. Invalid trail flags or limits fail startup explicitly. With trails on, a refresh keeps the trail as one continuous line; closing the tab clears it.
- [ ] Keyboard: Tab reaches map marker buttons; Enter/Space selects them; focus indicators are visible.
- [ ] Select and close a flight on desktop: details sit beside the map without overlap, and the map canvas resizes correctly.
- [ ] With a mouse, hover a plane: a small card shows its ID as a callsign (e.g. PLANE-12). Sweeping across planes opens no new connections (check the browser's Network tab, WS filter). On a touch screen, tapping shows no card and opens the details directly.
- [ ] Phone (about 390px wide): selecting a plane opens a bottom sheet over the map; the page does not scroll, the sheet scrolls inside, and a plane tapped near the bottom moves above the sheet.
- [ ] Tablet portrait (about 810px): details open as a card at the bottom left of a full-size map; tablet landscape and desktop keep the side panel. No horizontal scrolling at any width.
- [ ] Enable OS/browser reduced-motion preference: aircraft jump directly to latest positions instead of interpolating.
- [ ] Run `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build` from `fe/` with no errors.

**Note:** The supplied backend intentionally generates unrealistic geographic relationships between aircraft and destinations. Treat the dashed line as a geographic visualization, not a real flight plan. External map tiles require internet access.
