# Walkthrough: why the code is written this way

This file explains the code file by file. The product decisions behind it (one selection at a time, closing the details socket on deselect, scale, reconnection, units, map tiles, animation) and my answers to the questions I asked the hiring team are in **`DECISIONS.md`**; the sections below link to it where a decision shows up in the code.

## 1. Application entry (`src/main.tsx`)

- `createRoot` + `StrictMode`: a client-side React app. `StrictMode` runs effect setup/cleanup twice in development to expose leaks, which is why every hook cleans up sockets, timers and map objects.
- Only `styles.css` is imported here. MapLibre's CSS is imported by the lazily loaded map, so it is not part of the first paint.
- `ErrorBoundary` wraps `App`, so a render failure shows a Reload screen instead of a blank page. There is no router: one screen.

## 2. Main page (`src/App.tsx`)

- **State it owns** (why `useState` and not Context: `DECISIONS.md` §B1): the selected plane ID, the hovered plane ID, the altitude unit, and two small focus flags. Everything else comes from hooks. `null` means nothing selected.
- **Data:** `usePlanes()` gives positions, trails, connection state and last-update time. `usePlaneDetails(selectedId)` subscribes only while a plane is selected. Hovering a plane shows only its ID from the live feed, so hovering never opens a socket. On touch-only screens (`(hover: hover)` does not match) hover is ignored entirely: a tap selects, so a tooltip would only cover neighbouring planes. This is read once at load, marked with a `shortcut:` comment.
- **Selection** (`DECISIONS.md` §A1): `selectPlane` toggles: clicking the selected plane again calls `clearSelection`. Close, Escape (one window `keydown` listener, removed on cleanup) and clicking empty map also clear it. If the plane disappears from the feed, selection and hover are cleared.
- **Focus:** after keyboard selection, focus moves to the panel's Close button; closing returns it to the plane that opened it, or to the map if that plane is gone.
- **Reconnect banner** (`DECISIONS.md` §A4): shown only when `VITE_AUTO_RECONNECT=false` and a socket is down. The "Reconnecting…" feedback stays at least 800 ms so it is visible even when the backend refuses instantly.
- **Map loading:** `React.lazy` + `Suspense` load the map chunk (MapLibre JS and CSS) separately, with a "Loading map…" placeholder; the header and feed start immediately.
- **Header:** `FlightHeader` shows the connection pill (`role="status"`, so changes are announced), aircraft count from the latest broadcast, last update time, and the ft/m toggle.
- **Details:** `FlightDetails` exists only while something is selected; unmounting it with the selection also ends the details subscription.

## 3. Basic feed (`src/hooks/usePlanes.ts`)

- Starts with no planes and `connecting`; never invents positions while offline.
- One effect owns the `/ws/planes/basic` socket (why effects are split by job: `DECISIONS.md` §B3). It re-runs only when the user presses Reconnect (an `attempt` counter); socket, timers and retry count live in effect-local variables because they never need a re-render.
- Each message is validated (`parseBasicMessage`); a bad message keeps the last good positions. A valid one replaces the snapshot, marks the feed Live and updates the timestamp.
- **Liveness:** no valid message for 5 s (`SILENCE_TIMEOUT_MS`) retires the socket, because a stuck connection may never fire `onclose`.
- **Reconnect** (`DECISIONS.md` §A4): with `VITE_AUTO_RECONNECT=true`, retries back off 1, 2, 4, then 8 s; with `false`, the state becomes Offline and the Reconnect button appears. Cleanup cancels timers and closes the socket.
- **Trails (optional):** each valid update appends positions with `appendTrails`. Trails are restored from `sessionStorage` on start (`loadTrails`) and saved on `pagehide` (`saveTrails`), so a reload keeps them.

## 4. Details feed (`src/hooks/usePlaneDetails.ts`)

- Takes a plane ID, or `null` for no socket. Only the selected plane uses it; the hover card needs no details.
- Opens `/ws/planes/details` and, once open, sends exactly `{ "type": "subscribe", "planeId": … }`.
- Shows only details whose `id` matches the current plane, so the previous plane never flashes after a switch.
- Close code **1008** (plane no longer exists) shows "This aircraft is no longer available." and is never retried. Other drops follow the same reconnect setting as the feed, with the same 5 s silence check.
- A new plane ID closes the old socket and opens a new one; `null` closes it. The protocol has no unsubscribe message, so closing is how the server is told to stop (`DECISIONS.md` §A2). Re-subscribing on one socket would also work; one socket per selection keeps cleanup obvious.

## 5. Flight map (`src/components/FlightMap.tsx`, `src/hooks/map/`, `src/lib/map/`)

The map is the only part that touches MapLibre's imperative API. It is split by concern: `FlightMap.tsx` (~60 lines) only wires hooks together and renders the controls; each hook owns one thing and cleans it up.

Folders follow one rule: components render, hooks own state and effects, `lib/` holds plain functions, `assets/` holds shared artwork.

```text
src/
├── App.tsx, main.tsx, styles.css
├── assets/planeIcon.ts        plane silhouette (markers, header, details)
├── components/                FlightHeader, FlightMap, FlightDetails, ErrorBoundary
├── hooks/                     usePlanes, usePlaneDetails, useLatest
│   └── map/                   one hook per map concern (table below)
├── lib/                       messages, socket, env, trails, geography, format, liveness
│   └── map/                   dom.ts, layers.ts (MapLibre helpers)
├── data/airports.ts
├── types/flight.ts
└── test/                      Vitest unit tests
```

| File | Owns |
| --- | --- |
| `components/FlightMap.tsx` | Props in, hooks wired, Show all / Retry map buttons, keyboard help text. Imports MapLibre's CSS, so that CSS loads with the lazy map chunk instead of the first paint. |
| `hooks/map/useMapInstance.ts` | Creates and destroys the map, controls, `ResizeObserver`, error banner state, Retry, and click-on-empty-map to unselect. Returns `map = null` until the style has loaded, so every other hook simply waits for a map. |
| `hooks/map/useAircraftMarkers.ts` | One `<button>` marker per plane: add/update/remove on each feed update, rotation, selection highlight, roving-tabindex keyboard navigation, first fit, and the single `requestAnimationFrame` loop. Exposes `markers` (with each plane's on-screen `shown` position) and `frames` (callbacks run every animation frame). |
| `hooks/map/useObservedTrail.ts` | The selected plane's trail, shaded lighter (lower) to darker (higher), with a faint grey dotted connector only across gaps of a minute or more, plus a two-point "tip" from the newest recorded point to the animated marker. See section 7. |
| `hooks/map/useSelectedRoute.ts` | Dotted great-circle guide to the destination and the coral destination pin. |
| `hooks/map/useKeepSelectionVisible.ts` | On narrow screens, pans the selected plane out from under the details card. |
| `hooks/map/useHoverTooltip.ts` | The dark hover card: the plane's ID as a radar-style callsign badge, from the live feed. Why it shows no route: see section 6. Follows the animated marker and links it via `aria-describedby`. |
| `lib/map/dom.ts` | Plain DOM builders (aircraft button, tooltip card, pin). Feed text only goes through `textContent`. |
| `lib/map/layers.ts` | GeoJSON helpers and `lineSource()`, which adds a line layer once per map (StrictMode runs effects twice). |

Key decisions:

- **Shared animated position** (`DECISIONS.md` §A7). Route, trail and tooltip must stay attached to the marker *as drawn*, not to the last feed position. `useAircraftMarkers` interpolates `shown` between `from` and `to` (950 ms per 1-second update, ~30fps); the other hooks subscribe to `frames` instead of running their own loops.
- **Refs, not state, for map objects.** The map, markers, popup and pin are mutable library objects; storing them in state would re-render React on every frame. `map` itself is state only because hooks must re-run when it becomes ready.
- **Callbacks via `useLatest`.** Marker DOM listeners are created once and read the latest React callback from a ref (`src/hooks/useLatest.ts`), so markers are never torn down to pick up a new handler.
- **Map errors.** Only an error *before* the style loads shows "Map tiles could not load"; tile failures afterwards are normal (`isStyleLoaded()` stays false while tiles load, so it cannot tell the two apart). Retry bumps an attempt counter that recreates the map; every hook cleans up when `map` changes.
- **MapLibre's worker.** MapLibre 6 builds its worker URL at runtime, so Vite cannot detect it: the dev server 404s it and `npm run build` leaves it out ("Worker failed to load", no tiles). `useMapInstance.ts` imports the worker with `?url` and passes it to `maplibregl.setWorkerUrl()`.
- **CSS order.** MapLibre's CSS now loads after `styles.css`, so app rules that target MapLibre-managed elements use two classes (for example `.map-area .map-canvas`) to keep winning.
- **Camera.** On wide screens selection never moves the camera. On phones and portrait tablets the details card covers part of the map, so `useKeepSelectionVisible.ts` pans the map only when the selected plane would be hidden under it. Show all fits the fleet on request; focusing an off-screen plane pans it into view.

**Why not 20 React marker components?** (Measured limits are in `DECISIONS.md` §A3.) MapLibre manages marker positions on its own map. Keeping marker DOM under MapLibre avoids turning every 30fps map move into a React component render. There are only 20 markers, so accessible HTML marker buttons are a reasonable, deliberately simple choice.

## 6. Design decision: the hover card shows only the plane ID

(Summary and history of this decision: `DECISIONS.md` §C1.)

**What the user would like to see.** Showing the flight number and route on hover (for example "TA222 · JFK → LAX") is a real value addition: it lets the user scan the map and find a flight without clicking every plane.

**Why the frontend does not do it today.** The basic feed (`/ws/planes/basic`) only sends ID, position, altitude and colour. The flight number and route are only available from `/ws/planes/details`, so showing them on hover meant opening a details WebSocket for every plane the pointer touched. Sweeping across ten planes meant ten connections opened and closed, each starting a server-side timer and sending updates nobody reads after the pointer moves on. An earlier version softened this with a 250 ms hover delay and later considered caching each plane's route, but both only reduce the cost of a design that should not need the extra call at all. So the hover card now shows only the plane ID from the live feed: zero extra connections, instant, and no loading state. The route stays one click away in the details panel.

**The right fix is in the backend.** The flight number, origin and destination are fixed for a plane's lifetime (they are set once in `be/src/plane.ts`). They belong in the basic feed, either:

- as three short fields on every plane in `/ws/planes/basic` (`flightNumber`, `origin`, `destination` as airport codes), about 60 bytes per plane per update (`"flightNumber":"TA222","origin":"JFK","destination":"LAX"`), about 1 KB/s for 20 planes; or
- sent once per plane when it first appears (or when a client connects), with later updates carrying only what changes (position and altitude).

With either, the hover card shows the route instantly with no extra calls, and the frontend change is small: extend `PlaneBasic` in `src/types/flight.ts`, validate the new fields in `isPlaneBasic` (`src/lib/messages.ts`), and add one line to `tooltipContent` (`src/lib/map/dom.ts`). The brief supplies the backend and asks for a frontend that consumes it, so `be/` was left unchanged; this is the change I would propose to the backend team.

## 7. How the trail compares to real flight trackers

I checked how the main trackers draw a plane's path before settling the design.

| | Flown path | Path ahead | Missing or estimated data | Which planes |
| --- | --- | --- | --- | --- |
| Flightradar24 | Solid, coloured by altitude (white near the ground, then yellow, green to blue, purple and red at cruise) | Not confirmed in their docs | Black dotted line while the plane is outside coverage and its position is estimated | Only after you click a plane |
| FlightAware | Solid green | Dashed line from the filed flight plan, ahead of the plane | Gap drawn in white as a great-circle curve, "you can't draw any conclusions from it"; the icon says ESTIMATED | The flight you are viewing |
| ADS-B Exchange / airplanes.live (tar1090) | Coloured by altitude (orange to purple to red) | Optional "estimated last leg" | Not described in their help | Selected plane, or all planes with the T key |

**What this app does, and why:**

- **Selected plane only, solid line for the flown path.** Same as Flightradar24 and FlightAware: one trail is readable; twenty overlapping trails are not.
- **Trail shaded by altitude: lighter = lower, darker = higher.** One hue, light blue to deep navy (`ALTITUDE_LOW` / `ALTITUDE_HIGH` in `lib/map/layers.ts`), blended evenly in Lab colour space, with a small "lower ▬ higher altitude" bar in the map caption. Flightradar24 and ADS-B Exchange use several hues; I tried that first, but over the simulator's narrow 6–15 km band it looked like a rainbow and needed a legend to decode. A single-hue light-to-dark scale changes gradually and reads at a glance. The basic feed already sends altitude, so it costs nothing extra. Each pair of recorded points is its own short line with their average altitude, the simplest way to get per-piece colour in MapLibre.
- **Short interruptions are bridged; only long gaps are marked.** A reconnect, a bad message or a page reload usually costs a few seconds, and over a few seconds a plane flies almost straight, so the trail simply continues as one line. I first marked every interruption with a grey dotted connector (like Flightradar24's dotted estimate and FlightAware's white gap), but several short drops chopped the trail into solid and dotted pieces. Now only a gap of a minute or more (`TRAIL_GAP_MS` in `src/lib/trails.ts`) starts a new segment with a faint grey dotted "no data here" connector.
- **Dotted coral guide to the destination.** (Amber at first, but it was hard to see on the light map; coral contrasts with both the map and the blue trail.) Same convention as FlightAware's dashed planned route: dashed means "not flown". Ours is a direct great-circle guide, not a filed plan, and the UI says so, because the simulator picks routes at random.
- **History only since the page opened (kept across reloads of the tab).** Real trackers show the whole flight from their servers. The supplied backend has no history endpoint, so this app records what it sees. As with the hover route (section 6), the proper fix is a backend endpoint that returns a plane's recorded positions, which the trail would draw before live updates extend it.

Sources: [Flightradar24 trail colours](https://support.fr24.com/support/solutions/articles/3000115027-why-does-the-aircraft-s-trail-change-colour-), [FlightAware planned route](https://discussions.flightaware.com/t/planned-route-now-displayed-on-maps-for-airborne-flights/8376), [FlightAware map behaviour](https://flightaware.com/news/article/Improvements-to-FlightAware-Maps--Understanding-Map-Behavior/196), [airplanes.live map help](https://airplanes.live/map-help/), [ADS-B Exchange map help](https://support.adsbexchange.com/hc/en-us/articles/44653064937741-Map-Help).

## 8. Other files

- **`src/components/FlightDetails.tsx`:** A pure rendering component. It has loading/error and detail branches. Airport city/code is taken from the subscribed details, altitude is converted from metres to feet, speed from m/s to knots, ETA milliseconds to local time, and vertical speed from m/s to ft/min. `<dl><dt><dd>` makes labels and values semantically related.
- **`src/components/ErrorBoundary.tsx`:** A small class component using React's `getDerivedStateFromError` and `componentDidCatch`. A render boundary isn't a replacement for asynchronous socket error handling; those failures are handled by the hooks.
- **`src/lib/messages.ts`:** `JSON.parse()` returns an `unknown` value, and type guards validate it before use. Reject invalid coordinates instead of accidentally placing a marker on an impossible latitude/longitude. Surface server errors without a render crash.
- **`src/lib/geography.ts`:** `bearing()` uses MapLibre's Mercator coordinates to match visible travel direction. `greatCircle()` converts lat/lon to 3D unit vectors and interpolates across the shortest spherical arc. The endpoint tests verify its aircraft and airport positions.
- **`src/data/airports.ts`:** Only the ten codes that *actually appear in `be/src/plane.ts`*. This is static public-domain mapping data, not a flight information source and not a new request to an aviation API.
- **`src/types/flight.ts`:** Mirrors the original data models. The comments specify units from backend source; this prevents showing metres as feet or milliseconds as seconds.
- **`src/lib/socket.ts`:** Keeps host/env configuration in one place. Everything else uses the same base URL.
- **`src/lib/format.ts`:** Isolates display conversions instead of repeating magic numbers in JSX. Why feet, knots and ft/min: `DECISIONS.md` §A5.
- **`src/styles.css`:** Defines the header, flexible map, and selected-flight details panel. Above 900px the details sit beside the map; at 900px and below they open as a card (tablet) or bottom sheet (phone) over a full-size map, with a fixed height so they never jump and long content scrolls inside. Focus styles and reduced-motion styling are explicit.
- **`src/test`:** Fast unit tests (Vitest) for geography, message validation, env flags, reconnect timing, trails, trail colouring and gap connectors, trail storage, the header, the details panel, shared formatting, and the error boundary.
- **`e2e/`:** Playwright browser tests for the brief's core flows: planes plotted, select/unselect, details subscription, reconnect, the hover card (plane ID, no extra connection; no card on touch screens), keyboard navigation between planes, the phone sheet layout, the map worker, and map error recovery. WebSockets and the basemap are mocked, so they need neither the backend nor internet.

## 9. Practical limitations

Scale, tiles and the backend changes I would propose are covered in `DECISIONS.md` §A3, §A6 and §C7.

- This is a **simulated** radar: backend randomizes origin, destination, and physical location independently, so real-world routes would not match the dots.
- The basic feed **does not include heading**. All aircraft derive map-facing direction from successive positions. The selected aircraft's backend heading is displayed as data, not used to override marker rotation.
- The map needs external tiles, but all flight data remain exclusively on the two supplied WebSocket endpoints.
- The original backend supports only one selected plane per detail connection, as implemented.

## 10. Details not covered above

**Manual reconnect** (`VITE_AUTO_RECONNECT=false`): pressing Reconnect turns the banner teal with a spinner and a disabled "Reconnecting…" button for at least 800 ms, even if the attempt fails or succeeds instantly; the socket attempt itself is not delayed. Failure brings the Reconnect button back; success removes the banner. Reduced motion stops the spinner.

**Trail rules** (`VITE_OBSERVED_TRAILS=true`): positions are recorded for every plane, including before it is selected, up to `VITE_TRAIL_MAX_POINTS` (2–10000, oldest dropped). Updates where the plane did not move add no point, so the cap is not a fixed time window. Short interruptions (a reconnect, a bad message, a page reload) are bridged, so the trail stays one line. Only a gap of a minute or more, a date-line crossing, or a jump no plane could fly (over 300 km between updates under a minute apart, `TRAIL_MAX_JUMP_KM`) starts a new segment. The last case is what a backend restart looks like: every plane comes back under the same ID at a new random position, and without this rule the trail would draw a solid line thousands of km long. A long gap is drawn as a faint grey dotted connector ("no data here"), but only where a plane could have flown it (300 km per minute) and never across the date line. Each recorded point keeps its altitude for the colouring. A plane that leaves the feed loses its trail.

**TypeScript:** strict mode with checked array indexing (`noUncheckedIndexedAccess`) and unused-code checks. Socket data and stored trails enter as `unknown` and pass type guards before use. GeoJSON features declare empty properties as `Record<string, never>`, airport lookups return `undefined` for unknown codes (including `"constructor"`), and the error boundary accepts `unknown` thrown values.

**Look and layout:** markers use the simulator's colours, turn red on hover, and keep a glow while selected. The details panel sits beside the map on wide screens (the map resizes when it opens or closes). On tablets in portrait it is a card over the bottom-left of the map, and on phones a bottom sheet; the map keeps its size, the legend moves to the top (hidden on phones), and the header stats wrap to a second row below 760px. Shift+Tab from the panel's Close button focuses the panel so it can be scrolled with the keyboard.

> **Data caveat:** the simulator assigns each plane's position and its origin/destination independently. The dotted line is a guide from the plane's current position to its destination, not a flown track or a filed flight plan. The UI says so.
