import type { AltitudeUnit, ConnectionState } from '../types/flight';
import { PLANE_PATH } from '../assets/planeIcon';

type Props = {
  altitudeUnit: AltitudeUnit;
  onAltitudeUnitChange: (unit: AltitudeUnit) => void;
  connection: ConnectionState;
  planeCount: number;
  lastUpdate: Date | null;
};

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  live: 'Live', connecting: 'Connecting', reconnecting: 'Reconnecting', offline: 'Offline',
};

const UNITS: { value: AltitudeUnit; label: string; name: string }[] = [
  { value: 'ft', label: 'ft', name: 'Feet' },
  { value: 'm', label: 'm', name: 'Meters' },
];

export function FlightHeader({ altitudeUnit, onAltitudeUnitChange, connection, planeCount, lastUpdate }: Props) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <svg className="topbar__logo" viewBox="0 0 24 24" aria-hidden="true">
          <path transform="rotate(45 12 12)" d={PLANE_PATH} />
        </svg>
        <div>
          <h1>Flight Radar</h1>
          <p>Simulated live air traffic</p>
        </div>
      </div>

      <div className="topbar__status">
        {/* The text carries the state; the dot colour only reinforces it. */}
        <span role="status" aria-live="polite" className={`connection-pill connection-pill--${connection}`}>
          {CONNECTION_LABEL[connection]}
        </span>
        <span className="topbar__stat topbar__count">
          <strong>{planeCount}</strong>
          <small>aircraft</small>
        </span>
        <span className="topbar__stat topbar__timestamp" title={lastUpdate
          ? `Last position received at ${lastUpdate.toLocaleTimeString()}` : undefined}>
          <strong>{lastUpdate
            ? lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : '--:--:--'}</strong>
          <small>{lastUpdate ? 'Updated' : 'Awaiting first update'}</small>
        </span>
        <div className="unit-toggle" role="group" aria-label="Altitude unit">
          {UNITS.map(({ value, label, name }) => (
            <button key={value} type="button" aria-pressed={altitudeUnit === value} aria-label={`Altitude in ${name}`}
              onClick={() => onAltitudeUnitChange(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
