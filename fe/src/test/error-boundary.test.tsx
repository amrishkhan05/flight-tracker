import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary';

it('renders children normally and an accessible reload fallback after failure', () => {
  const boundary = new ErrorBoundary({ children: <p>Flight map</p> });
  expect(renderToStaticMarkup(boundary.render())).toContain('Flight map');
  boundary.state = ErrorBoundary.getDerivedStateFromError();
  const html = renderToStaticMarkup(boundary.render());
  expect(html).toContain('role="alert"');
  expect(html).toContain('Reload flight radar');
  expect(html).not.toContain('<p>Flight map</p>');
});

it('logs Error and non-Error thrown values with the React component stack', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const boundary = new ErrorBoundary({ children: null });
    for (const error of [new Error('Render failed'), 'Render failed', null]) {
      boundary.componentDidCatch(error, { componentStack: 'FlightMap' });
      expect(log).toHaveBeenLastCalledWith('Flight radar render error', error, 'FlightMap');
    }
  } finally {
    log.mockRestore();
  }
});
