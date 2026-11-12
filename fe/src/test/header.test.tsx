import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FlightHeader } from '../components/FlightHeader';

it('keeps the timestamp slot present before and after the first update', () => {
  for (const lastUpdate of [null, new Date('2026-11-06T18:48:07Z')]) {
    const html = renderToStaticMarkup(
      <FlightHeader altitudeUnit="ft" onAltitudeUnitChange={() => {}}
        connection={lastUpdate ? 'live' : 'connecting'} planeCount={lastUpdate ? 20 : 0}
        lastUpdate={lastUpdate} />,
    );
    expect(html).toContain('topbar__timestamp');
    expect(html).toContain(lastUpdate ? 'Updated' : 'Awaiting first update');
    expect(html).toContain(`connection-pill--${lastUpdate ? 'live' : 'connecting'}`);
    expect(html).toContain('aria-pressed="true" aria-label="Altitude in Feet"');
  }
});
