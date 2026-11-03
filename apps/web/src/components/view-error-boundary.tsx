"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props {
  /** Change this value to clear a previous error (e.g. the view id). */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  resetKey: string;
}

/**
 * Keeps a crash inside one module from blanking the whole workspace.
 * The rest of the app (navigation, search, other modules) stays usable.
 */
export class ViewErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: Props,
    state: State
  ): Partial<State> | null {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }

    return null;
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        className="state-card error-state"
        role="alert"
      >
        <AlertTriangle size={28} aria-hidden="true" />

        <strong>This section hit an unexpected error</strong>

        <span>{this.state.error.message}</span>

        <button
          type="button"
          className="secondary-button"
          onClick={() => this.setState({ error: null })}
        >
          <RefreshCw size={13} aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }
}
