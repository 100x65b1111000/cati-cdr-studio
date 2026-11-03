import React from 'react';
import EmptyState from './EmptyState';

// Class-only by React's design: there is no hook for getDerivedStateFromError.
// Without a boundary a render throw unmounts the root, which leaves the bare body
// background on screen with no explanation and no way out but a manual refresh.
export default class ViewErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('[view] render failed:', error, info?.componentStack);
  }

  // Switching views is the recovery path, so dead state must not follow you there.
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="panel rounded-lg">
        <EmptyState
          title="This view did not load"
          body="The rest of the app is still working. Pick another view from the rail, or reload to fetch the files again."
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="hoverable rounded border border-k-hairline px-3 py-1.5 text-xs text-k-ink"
            >
              Reload
            </button>
          }
        />
      </div>
    );
  }
}
