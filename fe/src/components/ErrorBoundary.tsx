import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Error boundaries are still class components in React 18. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Visible during development; no extra logging service or backend required.
    console.error('Flight radar render error', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error" role="alert">
          <div className="fatal-error__icon">!</div>
          <h1>Something went wrong.</h1>
          <p>The flight radar could not be displayed. Try reloading the page.</p>
          <button className="button button--dark" onClick={() => window.location.reload()}>
            Reload flight radar
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
