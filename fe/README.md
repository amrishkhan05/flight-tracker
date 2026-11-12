# Flight Radar · Frontend

A React + TypeScript map that plots the simulator's planes in real time. Click a plane to see its live details; click it again (or press Escape, the X, or empty map) to hide them. All flight data comes from the two supplied WebSocket endpoints. Only `fe/` was written; `be/` is unchanged.

## Run it

Use Node.js 20 or 22 LTS.

```bash
# Terminal 1: the supplied backend
cd be && npm install && npm run dev

# Terminal 2: this frontend
cd fe && npm install && npm run dev
```

Open http://localhost:5173. If the backend is not on port 4000, copy `.env.example` to `.env` and set `VITE_WS_BASE_URL`.

## Requirements

| Brief | Where |
| --- | --- |
| Built in `fe` with React + TypeScript | Strict TypeScript; socket payloads are validated from `unknown` before use (`src/lib/messages.ts`) |
| Map that plots planes in real time | MapLibre GL; markers glide between the 1-second updates and turn to face their direction of travel (`components/FlightMap.tsx`, `hooks/map/`) |
| Select / unselect to show / hide details | Click a plane to open the panel; click it again, the X, Escape, or empty map to close it. Keyboard: Tab, arrows, Enter |
| Data only from the provided WebSocket backend | `/ws/planes/basic` for all positions, `/ws/planes/details` subscribed only while a plane is selected |

## Check it

```bash
npm run typecheck   # strict TypeScript
npm test            # unit tests (Vitest)
npm run test:e2e    # browser tests (Playwright); first run: npx playwright install chromium
npm run build       # typecheck + production bundle
```

The browser tests mock both WebSockets and the basemap, so they run without the backend or internet.

## Key decisions

Every decision and assumption, including answers to the questions I asked the hiring team (selection, deselection, scale, reconnection, units, map tiles, movement), is explained in **`DECISIONS.md`**. In short:

- **No state library.** Two custom hooks own the two sockets (`usePlanes`, `usePlaneDetails`). The only shared UI state is the selected plane ID. For 20 planes, Redux or React Query would add code without adding value.
- **MapLibre lives in refs, not state.** The map, markers and animation are mutable objects outside React. A `requestAnimationFrame` loop moves markers, so React does not re-render 30 times a second.
- **DOM markers are real `<button>`s.** That gives keyboard focus and screen-reader labels for free. Past a few hundred planes I would switch to a GeoJSON symbol layer (measured in `DECISIONS.md` §A3).
- **Details connect only while needed.** Selecting opens the details socket; unselecting closes it. With a mouse, hovering a plane shows its ID as a small callsign badge, taken from the live feed, so hovering opens no connections at all; the flight number and route appear when you click. Touch-only screens skip the badge: a tap opens the details directly.
- **Untrusted input is checked.** Every message is validated before rendering; bad messages are logged, not rendered.
- **Network loss is visible.** Last positions stay on screen. With `VITE_AUTO_RECONNECT=true` (default) sockets retry with backoff (1, 2, 4, 8 s); with `false` a Reconnect button appears.
- **Works on phones and tablets.** Below 900px the details open as a card or bottom sheet over a full-size map instead of squeezing it, and a selected plane that would be hidden under the sheet is panned into view.
- **The map loads lazily**, JavaScript and CSS, so the header and feed start before MapLibre's ~300 KB (gzipped) arrives. The map is split into one hook per concern (instance, markers, trail, route, tooltip).

## Settings (`.env`)

| Variable | Default | Effect |
| --- | --- | --- |
| `VITE_WS_BASE_URL` | `ws://<host>:4000` | Backend address |
| `VITE_AUTO_RECONNECT` | `true` | Retry automatically, or show a Reconnect button |
| `VITE_OBSERVED_TRAILS` | `false` | Draw the selected plane's travelled trail, shaded lighter to darker as it climbs; short connection drops are bridged, gaps over a minute are dotted (kept across reloads of the tab; zoom in to see it, planes move ~2 km/s) |
| `VITE_TRAIL_MAX_POINTS` | `1000` | Positions kept per plane for trails |

Invalid values stop the dev server or build with a clear message.

## Limitations and next steps

- The simulator picks each plane's position and destination independently, so the dotted line is a guide from the plane to its destination, not a real flight plan.
- Map tiles come from OpenFreeMap and need internet. Airport positions for the simulator's ten codes are bundled from OurAirports (public domain).
- The hover card shows only the plane ID. Showing the route on hover would be valuable, but the route is only in the details endpoint, so it would cost a details connection per plane hovered. The right fix is in the backend: add `flightNumber`, `origin` and `destination` to `/ws/planes/basic` (they never change for a plane). See `WALKTHROUGH.md` section 6.
- Trails only cover what this page has seen; real trackers show the whole flight. That needs a backend history endpoint. `WALKTHROUGH.md` section 7 compares the trail design with Flightradar24, FlightAware and ADS-B Exchange.
- For a real product: a WSS endpoint behind a proxy, symbol layers for large fleets, and monitoring for stale sockets.

`DECISIONS.md` explains what was chosen and why; `WALKTHROUGH.md` explains the code file by file; `QA_CHECKLIST.md` lists manual checks.
