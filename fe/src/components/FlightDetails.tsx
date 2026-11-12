import { useEffect, useRef } from 'react';
import { lookupAirport } from '../data/airports';
import { formatAltitude, formatTime, statusLabel, toKnots, toVerticalFeet } from '../lib/format';
import { PLANE_PATH } from '../assets/planeIcon';
import type { AltitudeUnit, PlaneDetailed } from '../types/flight';

type Props = {
  planeId: string;
  details: PlaneDetailed | null;
  error: string | null;
  onClose: () => void;
  altitudeUnit: AltitudeUnit;
  focusOnOpen?: boolean;
};

export function FlightDetails({ planeId, details, error, onClose, altitudeUnit, focusOnOpen }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusOnOpen) closeRef.current?.focus();
  }, [planeId, focusOnOpen]);
  return (
    <section id="flight-details" className="details-panel" aria-label="Selected flight details" tabIndex={0}>
      <div className="details-panel__top">
        <span className="eyebrow">SELECTED AIRCRAFT</span>
        <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close flight details" title="Close details" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19" /></svg>
        </button>
      </div>

      {!details ? (
        <div className="details-panel__loading" role="status">
          <strong>{error ? 'Flight unavailable' : 'Loading flight details'}</strong>
          <p>{error ?? `Subscribing to ${planeId}…`}</p>
        </div>
      ) : (
        <>
          <div className="flight-title">
            <div className="flight-title__number">{details.flightNumber}</div>
            <span className="status-tag">{statusLabel(details.status)}</span>
            <p>{details.airline} · {details.model}</p>
            <small>Registration {details.registration}</small>
          </div>

          <div className="route-card">
            <div className="route-card__places">
              <div>
                <strong>{details.origin.airport}</strong>
                <small>{details.origin.city}</small>
              </div>
              <div className="route-card__connector" aria-hidden="true">
                <svg className="route-card__plane" viewBox="0 0 24 24">
                  <path d={PLANE_PATH} />
                </svg>
              </div>
              <div className="route-card__destination">
                <strong>{details.destination.airport}</strong>
                <small>{details.destination.city}</small>
              </div>
            </div>
            <div className="route-card__note">
              {lookupAirport(details.destination.airport)
                ? 'Dotted line shows a direct guide to the destination.'
                : 'Destination location unavailable in the local airport list.'}
            </div>
          </div>

          <div className="details-subtitle">FLIGHT DATA</div>
          <dl className="stat-grid">
            <div><dt>Altitude</dt><dd>{formatAltitude(details.altitude, altitudeUnit)}</dd></div>
            <div><dt>Speed*</dt><dd>{toKnots(details.speed)}</dd></div>
            <div><dt>Heading</dt><dd>{Math.round((details.heading + 360) % 360) % 360}°</dd></div>
            <div><dt>Vertical speed</dt><dd>{toVerticalFeet(details.verticalSpeed)}</dd></div>
            <div><dt>Flight duration</dt><dd>{details.flightDuration} min</dd></div>
            <div><dt>Estimated arrival</dt><dd>{formatTime(details.estimatedArrival)}</dd></div>
          </dl>
          <div className="passenger-row">
            <span>Passengers on board</span>
            <strong>{details.numberOfPassengers} <span>/ {details.maxPassengers}</span></strong>
          </div>
          <div className="details-panel__bottom">*Speed field supplied by the simulator (m/s), displayed in knots. Times use your local timezone.</div>
        </>
      )}
    </section>
  );
}
