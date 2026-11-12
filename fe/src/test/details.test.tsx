import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FlightDetails } from '../components/FlightDetails';
import type { PlaneDetailed } from '../types/flight';

it('displays the same API altitude in meters or feet without changing other units', () => {
  const details: PlaneDetailed = {
    id: 'plane-1', latitude: 45, longitude: -90, altitude: 10668, color: '#ffffff',
    model: 'Boeing 737', airline: 'Test Airways', flightNumber: 'TA123',
    registration: 'N12345', speed: 283, heading: 180, verticalSpeed: 0,
    origin: { airport: 'JFK', city: 'New York' },
    destination: { airport: 'LAX', city: 'Los Angeles' },
    flightDuration: 125, estimatedArrival: 1794000000000,
    numberOfPassengers: 180, maxPassengers: 200, status: 'cruising',
  };
  for (const altitudeUnit of ['m', 'ft'] as const) {
    const html = renderToStaticMarkup(
      <FlightDetails planeId={details.id} details={details} error={null}
        altitudeUnit={altitudeUnit} onClose={() => {}} />,
    );
    expect(html).toContain(altitudeUnit === 'm' ? '10,668 m' : '35,000 ft');
    expect(html).toContain('550 kt');
    expect(html).toContain('0 ft/min');
  }
  expect(details.altitude).toBe(10668);
});

it('shows the simulator\'s -180..180 heading as a 0-360 compass heading', () => {
  const base = { id: 'p', latitude: 0, longitude: 0, altitude: 0, color: '#ffffff', model: '', airline: '',
    flightNumber: 'X', registration: '', speed: 0, verticalSpeed: 0, origin: { airport: 'JFK', city: '' },
    destination: { airport: 'LAX', city: '' }, flightDuration: 0, estimatedArrival: 0,
    numberOfPassengers: 0, maxPassengers: 0, status: 'cruising' } as const;
  for (const [heading, shown] of [[-90, '270°'], [-0.2, '0°'], [359.7, '0°'], [45, '45°']] as const) {
    const html = renderToStaticMarkup(<FlightDetails planeId="p" details={{ ...base, heading }} error={null}
      altitudeUnit="m" onClose={() => {}} />);
    expect(html).toContain(`<dd>${shown}</dd>`);
  }
});
