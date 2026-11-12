import type { PlaneBasic } from '../../types/flight';
import { PLANE_PATH } from '../../assets/planeIcon';

/** Every builder uses DOM APIs or fixed strings, so feed text is never parsed as HTML. */
const el = (tag: string, className: string, text?: string) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const PLANE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PLANE_PATH}"/></svg>`;

/** A real button is keyboard-accessible and announces its pressed (selected) state. */
export function createAircraftButton(plane: PlaneBasic, onClick: () => void, onHover: (hovered: boolean) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'aircraft-marker';
  button.style.setProperty('--plane-color', plane.color);
  button.setAttribute('aria-label', `Select ${plane.id}`);
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-controls', 'flight-details');
  button.setAttribute('aria-describedby', 'map-keyboard-help');
  button.addEventListener('mouseenter', () => onHover(true));
  button.addEventListener('mouseleave', () => onHover(button.matches(':focus')));
  button.addEventListener('focus', () => onHover(true));
  button.addEventListener('blur', () => onHover(button.matches(':hover')));
  button.innerHTML = PLANE_ICON;
  button.addEventListener('click', onClick);
  return button;
}

export function createDestinationPin(): HTMLElement {
  return el('div', 'destination-pin');
}

export const TOOLTIP_ID = 'flight-hover-tooltip';

/** Hover card: the plane's ID as a callsign badge. Flight number and route are in the details panel. */
export function tooltipContent(id: string, color: string): HTMLElement {
  const content = el('div', 'tip');
  content.setAttribute('role', 'tooltip');
  content.id = TOOLTIP_ID;
  const dot = el('span', 'tip__dot');
  dot.style.background = color;
  content.append(dot, el('span', 'tip__callsign', id));
  return content;
}
