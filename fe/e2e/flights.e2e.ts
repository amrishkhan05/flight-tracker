import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';

const planes = [
  { id: 'plane-1', latitude: 40, longitude: -74, altitude: 10000, color: '#d9480f' },
  { id: 'plane-2', latitude: 39, longitude: -77, altitude: 9000, color: '#1971c2' },
];
const details = (id: string, flightNumber: string) => ({
  id, latitude: 40, longitude: -74, altitude: 10000, color: '#d9480f', model: 'Boeing 737',
  airline: 'Test Air', flightNumber, registration: 'N12345', speed: 250, heading: -90, verticalSpeed: 0,
  origin: { airport: 'JFK', city: 'New York' }, destination: { airport: 'LAX', city: 'Los Angeles' },
  flightDuration: 60, estimatedArrival: Date.now() + 3_600_000, numberOfPassengers: 150,
  maxPassengers: 180, status: 'cruising',
});

/** A blank style with one vector source, so tile requests happen but never reach the internet. */
async function mockBasemap(page: Page, { styleFails = false } = {}) {
  let failStyle = styleFails;
  await page.route('https://tiles.openfreemap.org/styles/**', (route) => failStyle
    ? route.fulfill({ status: 503, body: 'down' })
    : route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      version: 8,
      sources: { land: { type: 'vector', tiles: ['https://tiles.openfreemap.org/tiles/{z}/{x}/{y}.pbf'] } },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#e8eef0' } },
        { id: 'land', type: 'fill', source: 'land', 'source-layer': 'land' },
      ],
    }) }));
  // Every tile fails, like a flaky connection or an ad blocker.
  await page.route('https://tiles.openfreemap.org/tiles/**', (route) => route.abort());
  return { recoverStyle: () => { failStyle = false; } };
}

async function openApp(page: Page) {
  const sockets: { basic?: WebSocketRoute; details: WebSocketRoute[]; subscriptions: string[] } = { details: [], subscriptions: [] };
  await page.routeWebSocket('**/ws/planes/basic', (socket) => {
    sockets.basic = socket;
    // Like the real backend: send now, then every second.
    const send = () => socket.send(JSON.stringify({ type: 'planes', data: planes }));
    send();
    const timer = setInterval(send, 1000);
    socket.onClose(() => clearInterval(timer));
  });
  await page.routeWebSocket('**/ws/planes/details', (socket) => {
    sockets.details.push(socket);
    socket.onMessage((message) => {
      const { planeId } = JSON.parse(String(message)) as { planeId: string };
      sockets.subscriptions.push(planeId);
      socket.send(JSON.stringify({ type: 'plane-details', data: details(planeId, planeId === 'plane-1' ? 'TA111' : 'TA222') }));
    });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Select plane-1' })).toBeVisible();
  return sockets;
}

const panel = (page: Page) => page.getByRole('region', { name: 'Selected flight details' });

test('plots every plane from the feed and selects one to show its details', async ({ page }) => {
  await mockBasemap(page);
  const sockets = await openApp(page);
  await expect(page.locator('.aircraft-marker')).toHaveCount(2);
  await expect(page.getByRole('status').filter({ hasText: /^Live$/ })).toBeVisible();

  await page.getByRole('button', { name: 'Select plane-1' }).click();
  await expect(panel(page).getByText('TA111')).toBeVisible();
  await expect(panel(page).getByText('270°')).toBeVisible();
  expect(sockets.subscriptions).toEqual(['plane-1']);

  await page.getByRole('button', { name: 'Select plane-2' }).click();
  await expect(panel(page).getByText('TA222')).toBeVisible();
  await expect(panel(page).getByText('TA111')).toHaveCount(0);
});

test('unselects by clicking the plane again, the close button, Escape, or empty map', async ({ page }) => {
  await mockBasemap(page);
  await openApp(page);
  const marker = page.getByRole('button', { name: 'Select plane-1' });

  await marker.click();
  await expect(marker).toHaveAttribute('aria-pressed', 'true');
  await marker.click();
  await expect(panel(page)).toHaveCount(0);
  await expect(marker).toHaveAttribute('aria-pressed', 'false');

  await marker.click();
  await panel(page).getByRole('button', { name: 'Close flight details' }).click();
  await expect(panel(page)).toHaveCount(0);

  await marker.click();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);

  await marker.click();
  await expect(panel(page)).toBeVisible();
  await page.locator('.map-canvas canvas').click({ position: { x: 30, y: 300 } });
  await expect(panel(page)).toHaveCount(0);
});

test('closes the details subscription when the plane is unselected', async ({ page }) => {
  await mockBasemap(page);
  const sockets = await openApp(page);
  const marker = page.getByRole('button', { name: 'Select plane-1' });
  await marker.click();
  await expect(panel(page).getByText('TA111')).toBeVisible();
  const closed = new Promise<void>((resolve) => sockets.details[0]!.onClose(() => resolve()));
  await marker.click();
  await closed;
});

test('keeps planes on screen and offers Reconnect when the feed drops', async ({ page }) => {
  await mockBasemap(page);
  const sockets = await openApp(page);
  await sockets.basic!.close();
  await expect(page.getByRole('alert')).toContainText('Connection lost');
  await expect(page.locator('.aircraft-marker')).toHaveCount(2);
  await page.getByRole('button', { name: 'Reconnect' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole('status').filter({ hasText: /^Live$/ })).toBeVisible();
});

test('failed tiles do not show the map error once the style has loaded', async ({ page }) => {
  await mockBasemap(page);
  await openApp(page);
  await page.waitForTimeout(1500); // let the aborted tile requests report their errors
  await expect(page.getByText('Map tiles could not load')).toHaveCount(0);
});

test('the MapLibre worker loads (it is passed to setWorkerUrl via a Vite ?url import)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await mockBasemap(page);
  await openApp(page);
  await page.waitForTimeout(1500);
  expect(errors.filter((text) => text.includes('Worker failed to load'))).toEqual([]);
});

test('a failed map style shows the error, and Retry map loads it once it is back', async ({ page }) => {
  const basemap = await mockBasemap(page, { styleFails: true });
  await page.routeWebSocket('**/ws/planes/basic', (socket) => {
    socket.send(JSON.stringify({ type: 'planes', data: planes }));
  });
  await page.goto('/');
  await expect(page.getByText('Map tiles could not load')).toBeVisible();
  basemap.recoverStyle();
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByText('Map tiles could not load')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Select plane-1' })).toBeVisible();
});

test('hovering a plane shows its ID as a callsign and opens no extra connection', async ({ page }) => {
  await mockBasemap(page);
  const sockets = await openApp(page);
  await page.getByRole('button', { name: 'Select plane-2' }).hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toHaveText('plane-2'); // shown as PLANE-2 by CSS; the text stays readable
  // Sweep across both planes: the card comes from the live feed, so no details socket is opened.
  await page.getByRole('button', { name: 'Select plane-1' }).hover();
  await expect(tooltip).toHaveText('plane-1');
  await page.waitForTimeout(600);
  expect(sockets.details).toHaveLength(0);
});
test('arrow keys, Home and End move focus between planes and wrap around', async ({ page }) => {
  await mockBasemap(page);
  await openApp(page);
  const first = page.getByRole('button', { name: 'Select plane-1' });
  const second = page.getByRole('button', { name: 'Select plane-2' });
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(second).toBeFocused();
  await page.keyboard.press('ArrowRight'); // past the last plane wraps to the first
  await expect(first).toBeFocused();
  await page.keyboard.press('ArrowLeft'); // before the first wraps to the last
  await expect(second).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await page.keyboard.press('End');
  await expect(second).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(panel(page).getByText('TA222')).toBeVisible();
});

test('on a phone the details open as a sheet over the map, without page scroll, and the plane stays visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await mockBasemap(page);
  await openApp(page);
  const marker = page.getByRole('button', { name: 'Select plane-1' });
  // Drag the map so the plane sits where the sheet will open.
  const start = (await marker.boundingBox())!;
  await page.mouse.move(195, start.y - 120);
  await page.mouse.down();
  await page.mouse.move(195, start.y + 120, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await marker.boundingBox())!.y).toBeGreaterThan(500);
  await marker.click();
  const sheet = panel(page);
  await expect(sheet.getByText('TA111')).toBeVisible();
  const box = (await sheet.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(664); // fully on screen
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(664);
  // The selected plane is above the sheet, not hidden under it (it may be panned there).
  await expect.poll(async () => (await marker.boundingBox())!.y + 18).toBeLessThan(box.y);
});

test.describe('on a touch-only device', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test('tapping a plane opens the sheet with no hover tooltip and no extra details connection', async ({ page }) => {
    await mockBasemap(page);
    const sockets = await openApp(page);
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
    await page.getByRole('button', { name: 'Select plane-1' }).tap();
    await expect(panel(page).getByText('TA111')).toBeVisible();
    await page.waitForTimeout(600); // longer than the 250 ms hover delay
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    expect(sockets.details).toHaveLength(1); // only the selection's own connection
  });
});

test('on a phone a plane just above where the sheet will land is still moved clear of it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await mockBasemap(page);
  await openApp(page);
  // Learn where the sheet settles, then close it again.
  await page.getByRole('button', { name: 'Select plane-2' }).click();
  await expect(panel(page)).toBeVisible();
  await page.waitForTimeout(400); // past the slide-in
  const sheetTop = (await panel(page).boundingBox())!.y;
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);

  // Drag the map so plane-1's centre sits 10px above that edge: half the marker would be under the sheet.
  const marker = page.getByRole('button', { name: 'Select plane-1' });
  const centre = async () => { const box = (await marker.boundingBox())!; return box.y + box.height / 2; };
  const from = await centre();
  await page.mouse.move(200, 150);
  await page.mouse.down();
  await page.mouse.move(200, 150 + (sheetTop - 10 - from), { steps: 12 });
  await page.waitForTimeout(300); // stop before releasing, so the map does not keep gliding
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(Math.abs(await centre() - (sheetTop - 10))).toBeLessThan(6);

  await marker.click();
  await expect(panel(page)).toBeVisible();
  await page.waitForTimeout(800); // pan finishes
  const box = (await marker.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(sheetTop); // the whole plane is above the sheet
});
