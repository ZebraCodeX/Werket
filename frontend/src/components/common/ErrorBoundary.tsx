import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('App error boundary caught:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-error">
          <div className="app-error-card">
            <b>Something went wrong</b>
            <span>An unexpected error occurred. Your work is safe.</span>
            <button
              className="newdoc-create"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;