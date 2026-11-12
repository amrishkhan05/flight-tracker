# Decisions and assumptions

This file records every significant choice in the frontend: what was chosen, why, what it costs, and what would make me change it.

- **Part A** lists the questions I asked the hiring team before starting, and what I chose for each.
- **Part B** covers React and code decisions (state, effects, refs, hooks, loading, errors).
- **Part C** covers product and UI decisions (hover card, trail, map, layout, accessibility, testing).

`README.md` is the quick start; `WALKTHROUGH.md` explains the code file by file.

---

# Part A. Questions asked to the hiring team

On 6 November I emailed Joselin Diaz these questions:

> 1. **Selection:** Is showing details for one plane at a time the intended behavior?
> 2. **Deselection:** Since the protocol has no unsubscribe message, is closing the details WebSocket when deselecting a plane acceptable?
> 3. **Scale:** Should we target the default 20 planes updating every second, or is there a larger dataset/update frequency we should support?
> 4. **Connection recovery:** Is a visible connection error with a Retry button sufficient, or do you expect automatic reconnection?
> 5. **Display units:** Should we display the backend's metric units, or convert altitude and speed to feet and knots?
> 6. **Map tiles:** Is using external OpenStreetMap tiles acceptable, with all flight data coming exclusively from the supplied WebSocket backend?
> 7. **Movement:** Are position updates on each WebSocket message sufficient, or is smooth animation between updates expected?

Joselin replied on 9 November: *"all those decisions are left to your discretion, so please document them."*

| # | Question | What I chose |
| --- | --- | --- |
| A1 | Selection | One plane at a time; clicking it again unselects |
| A2 | Deselection | Close the details WebSocket on deselect |
| A3 | Scale | Built for 20 planes at 1 update/s; measured smooth to about 200 |
| A4 | Connection recovery | Automatic reconnection by default, plus a Reconnect button mode |
| A5 | Display units | Feet (metres toggle), knots, ft/min, local time |
| A6 | Map tiles | External OpenFreeMap tiles (OpenStreetMap data); flight data only from the WebSockets |
| A7 | Movement | Smooth gliding and rotation between updates; instant for reduced motion |

## A1. Selection: one plane at a time

**Decision.** One selected plane at a time. Clicking a plane opens its details; clicking the same plane again, the X, Escape, or empty map closes them. Clicking another plane switches straight to it.

**Why.**
- The backend's details endpoint is built for it: one connection follows one `planeId`.
- It matches Flightradar24 and FlightAware: one panel, one flight.
- One panel stays readable on a phone. Several panels would cover the map they describe.

**Cost.** You cannot compare two flights side by side.

**Would change if:** comparing flights became a real need. That means one details connection per selected plane, plus tabs or a panel list. `usePlaneDetails` takes one ID, so it would be called once per selection.

## A2. Deselection: close the details WebSocket

**Decision.** Unselecting closes the `/ws/planes/details` connection. Selecting a different plane closes the old connection and opens a new one.

**Why.**
- The protocol only has `subscribe`, so closing the socket is the only way to tell the server to stop. The backend clears that client's update timer when the socket closes (`be/src/server.ts`, `websocket-handlers.ts`).
- Leaving the socket open would keep the server sending details nobody reads, every second.
- The same React effect opens and closes the connection, so a subscription cannot leak.

**Alternative considered.** The backend also accepts a second `subscribe` on the same socket and replaces the old subscription. Closing and reopening was chosen because one code path then covers both switching and deselecting, and no stale subscription can survive a lost message.

**Cost.** Switching planes costs a new connection: a few milliseconds on localhost.

**Edge case.** If the server closes with code 1008 ("Plane not found", e.g. after a backend restart with fewer planes), the panel says "This aircraft is no longer available" and does not retry.

## A3. Scale: 20 planes at one update per second

**Decision.** Built and tested for the backend defaults (`PLANES_COUNT=20`, 1 update/s), with headroom measured rather than assumed.

**Measured** with the real backend in headless Chromium (software rendering, so a real laptop does better):

| Planes | Update interval | Frame rate | Slowest 5% of frames |
| --- | --- | --- | --- |
| 20 | 1 s | 56 fps | 17 ms |
| 200 | 1 s | 58 fps | 17 ms |
| 200 | 250 ms | 50 fps | 50 ms |
| 1,000 | 1 s | 23 fps | 83 ms |

**Why it holds up to a few hundred planes.**
- Markers are moved by one `requestAnimationFrame` loop outside React, so React does not re-render 30–60 times a second.
- React re-renders once per feed message, which is cheap.

**Cost.** Each plane is an HTML `<button>`: excellent for keyboard and screen-reader users, but slow around 1,000 planes.

**Would change if:** the fleet grows past a few hundred. Then draw planes as a MapLibre symbol layer (WebGL, one draw call), keep buttons only for the selected or focused plane, and cluster when zoomed out.

## A4. Connection recovery: automatic, with a manual mode

**Decision.** Both, chosen by `VITE_AUTO_RECONNECT`:
- `true` (default): reconnect automatically, waiting 1, 2, 4, then 8 seconds between attempts.
- `false`: stop and show a banner with a Reconnect button.

**Why.**
- A live map should recover by itself; nobody wants to press a button after every Wi-Fi hiccup.
- The growing wait stops a down server from being hit every second.
- The manual mode is useful in demos and tests, where you want to see the failure instead of having it hidden.

**What makes it reliable.**
- **Silence counts as failure.** A connection can hang without firing `onclose`. If no valid message arrives for 5 seconds, the socket is treated as dead.
- **Nothing is invented while offline.** Planes stay at their last known positions, and the header says Reconnecting or Offline.
- **Visible feedback.** "Reconnecting…" stays on screen for at least 800 ms even if the attempt fails instantly, so pressing the button visibly does something.

## A5. Display units: aviation units, with a metres toggle

| Field | Backend sends | Shown as |
| --- | --- | --- |
| Altitude | metres | feet by default; ft/m toggle in the header |
| Speed | m/s | knots |
| Vertical speed | m/s | ft/min, with + when climbing |
| Arrival time | Unix milliseconds | the viewer's local time |

**Why.**
- Pilots, air traffic control and every major tracker use feet, knots and ft/min; "10,668 m" for a plane at 35,000 ft looks wrong to anyone in aviation.
- Altitude is the value non-specialists most want in metres, so it gets the toggle.
- All conversions live in `src/lib/format.ts`, and the types record the backend's units (`src/types/flight.ts`), so metres are never shown as feet by accident.

**Cost.** Speed and vertical speed have no metric option. Each would be one line added to the same toggle.

## A6. Map tiles: external OpenFreeMap tiles

**Decision.** The base map comes from OpenFreeMap (OpenStreetMap data, vector tiles, no API key). All flight data comes only from the two supplied WebSocket endpoints.

**Why.**
- The brief restricts flight data, not the base map; without streets and coastlines, positions mean nothing.
- No account or API key, so the reviewer runs the app with zero setup.
- Vector tiles stay sharp at every zoom.

**Related.**
- **Airport positions:** the simulator only sends airport codes, so its ten codes are bundled as static coordinates from OurAirports (public domain), to draw the destination guide. This is map data, not flight data, and makes no request.
- **Tile failure:** the map shows "Map tiles could not load" with a working Retry button. The header and live feed keep running.

**Would change if:** production needed guaranteed uptime: then a paid or self-hosted tile provider, which is one URL in `src/hooks/map/useMapInstance.ts`.

## A7. Movement: smooth animation between updates

**Decision.** Markers glide from the old position to the new one over 950 ms and rotate to face their direction of travel.

**Why.**
- At one update a second, jumping markers look broken and the eye loses track of which plane moved.
- 950 ms, just under the 1-second interval, finishes each glide right before the next update, so planes move continuously without falling behind the data.
- If updates come faster (e.g. every 250 ms), each glide starts from where the marker is currently drawn, so planes never jump backwards.
- **Direction is calculated.** The basic feed has no heading, so rotation comes from the last two positions. The selected plane's reported heading is shown as data in the panel.
- **Everything follows the drawn marker.** The hover card, trail tip and destination guide attach to the marker as drawn, not to the last feed position, so nothing lags behind.

**Accessibility.** With the system's "reduce motion" setting on, markers jump straight to each new position, and the other animations (the live pulse, the sheet slide-in, the spinner) are off.

---

# Part B. React and code decisions

## B1. `useState` in `App`, not Context, Redux or Zustand

**Decision.** The shared UI state is a few plain `useState` values in `App`: the selected plane ID, the hovered plane ID, the altitude unit, and two small focus/feedback flags. They are passed down as props.

**Why not Context.**
- **The tree is shallow.** `App` renders `FlightHeader`, `FlightMap` and `FlightDetails` directly, so every prop travels one level. Context solves prop drilling through many layers, and there are no layers here.
- **Context would re-render more.** The plane list changes every second. Every component that reads a context re-renders when its value changes, including components that only needed the selected ID. Props let each component get exactly what it uses.
- **Context fits values that are widely used and rarely change** (theme, signed-in user, language). Live positions are the opposite.
- **Props are easier to follow and test.** Reading `App.tsx` shows who gets what, and each component can be rendered in a test with plain props, with no provider wrapper.

**Why not Redux, Zustand or `useReducer`.**
- There are five small, independent values. A store adds actions, selectors and boilerplate without making anything simpler.
- `useReducer` helps when several values must change together by rules. Here each value changes on its own (select, hover, unit), so separate `useState` calls are clearer.

**Would change if:** the app grows pages or deep component trees that need the selection (filters, a flight list, a search box). Then a small Context, or Zustand with selectors for frequently changing data, becomes worth it.

## B2. Server data in custom hooks, not React Query

**Decision.** Each WebSocket is owned by one custom hook: `usePlanes` (basic feed) and `usePlaneDetails` (details feed). Each hook returns plain data plus connection state.

**Why.**
- React Query and SWR are built for request/response fetching (caching, refetching, staleness). A WebSocket is a stream the server pushes; their caching model does not fit and would add a dependency for no gain.
- A custom hook keeps everything about one socket in one place: open, subscribe, validate, retry, silence check, close. Components only see `planes` or `details`.
- Hooks are tested on their own (`src/test/reconnect.test.ts`) without rendering the map.

## B3. Several small `useEffect`s instead of one big one

**Decision.** Each effect does one job, with its own dependencies and its own cleanup.

**The rule.** One effect per external thing being kept in sync: a socket, a timer, a window listener, or a map object. If two jobs need different dependencies or different cleanup, they are different effects.

**Example: `App.tsx` has five effects:**

| Effect | Runs when | Cleans up |
| --- | --- | --- |
| Hold "Reconnecting…" for 800 ms | the feedback flag turns on | clears the timer |
| Drop selection/hover if that plane left the feed | the plane list changes | nothing needed |
| Track whether focus is inside the details panel | once | removes the `focusin` listener |
| Move focus to the map if the closed panel had it | the selection changes | nothing needed |
| Close details on Escape | the selection changes | removes the `keydown` listener |

**Example: `useAircraftMarkers` has four effects:**

| Effect | Runs when |
| --- | --- |
| Remove all markers when the map goes away | the map changes |
| Add, move and remove markers | each feed update |
| Highlight the selected marker | the selection changes |
| Run the animation loop | the map changes (once) |

**Why not merge them.**
- **Different timing.** In one effect, every feed update (once a second) would also restart the animation loop and re-add the Escape listener; every selection would rebuild all markers.
- **Clear cleanup.** Each effect undoes exactly what it set up. One effect with five jobs would need one cleanup that undoes five things correctly in every case.
- **Readable.** Each effect can be read, reasoned about and changed on its own.

**Effects only for outside systems.** Values that can be computed from state are computed during render, not stored and synced by an effect. For example, `reconnecting` in `App.tsx` is a plain `const` built from the connection state.

**StrictMode proves the cleanup.** In development React runs every effect twice (setup, cleanup, setup). The app keeps working, with no duplicate sockets, listeners or map layers, which shows each cleanup is correct.

## B4. `useRef` for things that must not cause re-renders

**Decision.** The MapLibre map's markers, popup, destination pin, animation state and the element that opened the panel live in refs. Socket handles, timers and retry counts live as local variables inside the effect that owns them.

**Why.**
- Changing a ref does not re-render. The animation updates marker positions 30–60 times a second; doing that through state would re-render React on every frame.
- Library objects (MapLibre markers, the popup) are mutable and managed by MapLibre, not React.
- Effect-local variables are the simplest place for a socket's timers and counters: they exist exactly as long as that connection.

**Exception.** The map itself is state (`useMapInstance`), because the other hooks must re-run when it becomes ready.

## B5. `useLatest` instead of re-creating listeners

**Decision.** Marker click and hover listeners are attached once per marker and read the latest callback from a ref (`src/hooks/useLatest.ts`).

**Why.** `App` creates a new `selectPlane` function on each render. If marker listeners depended on it directly, every render would tear down and re-attach listeners on every marker. With `useLatest`, the DOM listener stays put and always calls the newest function.

## B6. Little `useCallback`, no `useMemo` or `React.memo`

**Decision.**
- `useCallback` is used once: `clearSelection`, because it is a dependency of the Escape effect and must keep the same identity.
- There is no `useMemo` or `React.memo`.

**Why.** Memoising has a cost (memory, comparisons, harder-to-read code) and only pays off for measurably slow renders. Here React re-renders once a second for 20 planes, which is cheap. The real hot path, animation, already runs outside React (B4). Memoisation would be added where a profiler showed a slow render, not in advance.

## B7. Functional state updates

**Decision.** State that depends on its previous value uses the function form: `setTrails(previous => appendTrails(previous, …))`, and `setSelectedId(id => …)` when pruning planes that left the feed.

**Why.** Socket handlers are created once per connection and live a long time. The function form always works on the latest state, so a handler never overwrites newer data with an old copy, and the effect does not need the state in its dependencies (which would reconnect the socket every second).

## B8. An `attempt` counter to retry

**Decision.** Reconnect and Retry map bump a counter (`setAttempt(n => n + 1)`) that the socket or map effect depends on.

**Why.** Changing the counter runs the effect's cleanup (closing the old socket or map) and then its setup (opening a new one). Recovery goes through the same code path as the first start, with no separate "reconnect" function to keep in sync.

## B9. Lazy-loaded map, with Suspense

**Decision.** `FlightMap` is loaded with `React.lazy` and shown inside `Suspense` with a "Loading map…" placeholder. MapLibre's CSS is imported by the map file, so it arrives with the same chunk.

**Why.** MapLibre is about 300 KB gzipped. Loading it separately means the header, connection state and live feed start immediately; the map follows a moment later.

## B10. An error boundary for render errors only

**Decision.** `ErrorBoundary` (a small class component, since React only supports error boundaries as classes) wraps the app and shows a Reload screen if rendering crashes.

**Why.** A blank white page is the worst failure. Socket and network errors are not render errors, so the hooks handle those themselves and show them in the header and banner (A4).

## B11. Untrusted data is checked at runtime

**Decision.** Every WebSocket message, and every trail restored from storage, starts as `unknown` and passes a type guard (`src/lib/messages.ts`, `src/lib/trails.ts`) before use. Invalid coordinates, wrong types and unknown message shapes are dropped and logged; the last good data stays on screen.

**Why.** TypeScript types describe data but do not check it when the app runs. A bad message must never crash the map or put a plane at an impossible position. Strict TypeScript, with checked array indexing, catches the rest at build time.

## B12. Folder structure by role

```text
src/
├── assets/          shared artwork (plane icon)
├── components/      render UI: FlightHeader, FlightMap, FlightDetails, ErrorBoundary
├── hooks/           state and effects: usePlanes, usePlaneDetails, useLatest
│   └── map/         one hook per map concern
├── lib/             plain functions, no React: messages, socket, env, trails, geography, format
│   └── map/         MapLibre helpers: dom.ts, layers.ts
├── data/            static airport coordinates
├── types/           backend data models
└── test/            unit tests
```

**Why.** Each folder answers one question: does it render (components), hold state or effects (hooks), or compute (lib)? Plain functions in `lib/` are tested without React, and the map is split into one hook per concern (instance, markers, trail, route, hover, keep-visible), so `FlightMap.tsx` stays about 60 lines of wiring.

## B13. Tools: Vite, MapLibre, plain CSS

- **Vite:** fast dev server and build, first-class TypeScript and React support, and the current standard for new React apps (Create React App is deprecated).
- **MapLibre GL:** open-source fork of Mapbox GL with no token required. WebGL rendering, vector tiles, smooth zoom, and marker rotation built in.
- **Plain CSS in one file** (~420 lines, colour variables, sections per area): the UI has a handful of components, so CSS Modules, Tailwind or CSS-in-JS would add tooling without solving a real problem.

---

# Part C. Product and UI decisions

## C1. The hover card shows only the plane ID

**Decision.** Hovering a plane shows only its ID as a small radar-style callsign badge (e.g. PLANE-12), taken from the live feed. Touch screens skip the hover card: a tap opens the details.

**How it got there.**
1. **First version:** hovering opened a details WebSocket to show the flight number and route. Problem: sweeping the pointer across ten planes opened and closed ten connections, each starting a server timer.
2. **A 250 ms hover delay** reduced the calls but did not remove them, and caching each plane's route was considered too.
3. **A visual glitch:** the card first showed "plane-12", then switched to "TA222" when details arrived. Showing the ID as a header with the route underneath still meant loading per hover.
4. **Final:** ID only. No extra connections, instant, no loading state, no flicker. The flight number and route are one click away in the details panel.

**Why.** Showing the route on hover is valuable to the user, but not at the cost of one network connection per plane the pointer touches. The data is in the wrong endpoint; the cheap, correct fix is in the backend.

**Proposed backend change.** Add `flightNumber`, `origin` and `destination` to `/ws/planes/basic`. They never change during a flight and cost about 60 bytes per plane per update (about 1 KB/s for 20 planes). Then the hover card shows the route instantly, and the frontend change is three lines. Full reasoning: `WALKTHROUGH.md` section 6.

**Touch screens.** `(hover: hover)` is checked once at load. Without a mouse, a tooltip would only cover nearby planes, and the tap already opens the full details. (Plugging a mouse into a tablet needs a reload to get tooltips; marked as a `shortcut:` in the code.)

## C2. Travelled trail: optional, off by default

**Decision.** `VITE_OBSERVED_TRAILS=true` draws the selected plane's travelled path. It is off by default.

**Why off by default.** It isn't in the brief, and the backend has no history, so the trail can only show what this tab has seen since it opened.

**Design,** compared with Flightradar24, FlightAware and ADS-B Exchange (see `WALKTHROUGH.md` section 7):
- **Shaded by altitude:** light blue (low) to dark navy (high). A rainbow scale was tried first, but over the simulator's narrow 6–15 km range it was hard to read without a key.
- **Short drops are bridged:** a reconnect or page reload is a few seconds, so the trail continues as one line. Marking every drop with dots looked broken after several interruptions.
- **Gaps over a minute** get a faint grey dotted "no data here" connector.
- **Impossible jumps** (over 300 km in under a minute, e.g. after a backend restart) are never joined.
- **Kept across reloads** of the tab (session storage).

## C3. Destination guide, not a flight plan

**Decision.** The selected plane gets a dotted coral great-circle line to its destination airport, with a coral airport pin.

**Why.**
- It answers "where is this plane going?" at a glance.
- Dotted means "not flown", the same convention FlightAware uses for planned routes.
- The simulator picks positions and destinations independently, so the panel labels the line as a guide, not a real route.
- Coral replaced the first amber, which was hard to see on the light map; it also stands apart from the blue trail.

## C4. Header

**Decision.** A logo and title on the left. On the right: a connection pill (Live / Connecting / Reconnecting / Offline, with a coloured dot), the aircraft count, the last update time and the ft/m toggle. Below 760px the stats move to a second row.

**Why.** Connection state is the most important status in a live app, so it is the first thing on the right, as text with colour as backup. It's announced to screen readers (`role="status"`). Times use fixed-width digits so the header doesn't shift every second.

## C5. Layout on phones and tablets

**Decision.**
- Above 900px the details panel sits beside the map.
- At 900px and below it opens as a card (tablet) over the map.
- Below 700px it becomes a bottom sheet (phone).

The panel has a fixed height and scrolls inside. If the selected plane would sit under the card, the map pans so the plane stays visible.

**Why.** Squeezing the map on a phone leaves a strip too small to use, and pushing it down hides it. Overlaying keeps the map full size, like Google Maps and Flightradar24 on mobile. The fixed height stops the sheet jumping when details arrive.

## C6. Accessibility

- **Planes are real buttons.** Tab enters the map once, arrow keys move between planes, Enter or Space selects, and screen readers announce each plane.
- **Focus is managed.** Opening details from the keyboard moves focus to the Close button; closing returns it to the plane.
- **Escape closes** the details from anywhere.
- **Colour is never the only signal:** the connection pill has text, and the trail has a labelled scale.
- **Reduced motion** turns off gliding and all decorative animation.

## C7. The backend is unchanged

**Decision.** Only `fe/` was written; the brief supplies the backend and asks for a frontend that consumes it.

**Backend changes I would propose:**
1. Add `flightNumber`, `origin` and `destination` to `/ws/planes/basic`, for the hover route (C1).
2. A history endpoint with each plane's past positions, so trails can show the whole flight (C2).
3. An `unsubscribe` message, so one details connection can be reused across selections (A2).
4. A flight or session ID that changes when a plane is re-created, so a client can tell a backend restart from a real flight.

## C8. Testing

- **Unit tests (Vitest, 49):** message validation, unit conversions, geography, trail rules and storage, reconnect timing, environment settings, header, details panel, error boundary.
- **Browser tests (Playwright, 12):** the brief's flows end to end: planes plotted, select/unselect, details subscription and closing, reconnect, hover card with no extra connection, no tooltip on touch, keyboard navigation, the phone sheet, and map error recovery. WebSockets and the base map are mocked, so the tests need neither the backend nor internet.
- **Strict TypeScript and a production build** are part of the check.
