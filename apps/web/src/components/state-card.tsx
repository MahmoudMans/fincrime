import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({
  label = "Loading",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "state-card ui-state-compact"
          : "state-card"
      }
      role="status"
      aria-live="polite"
    >
      <div className="spinner" aria-hidden="true" />

      <strong>{label}…</strong>
    </div>
  );
}

export function ErrorState({
  title = "Unable to load this view",
  message,
  onRetry,
  compact = false,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "state-card error-state ui-state-compact"
          : "state-card error-state"
      }
      role="alert"
    >
      <AlertTriangle size={24} aria-hidden="true" />

      <strong>{title}</strong>

      <span>{message}</span>

      {onRetry && (
        <button
          type="button"
          className="secondary-button"
          onClick={onRetry}
        >
          <RefreshCw size={13} aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "state-card ui-state-empty ui-state-compact"
          : "state-card ui-state-empty"
      }
    >
      {icon ?? <Inbox size={24} aria-hidden="true" />}

      <strong>{title}</strong>

      {message && <span>{message}</span>}

      {action}
    </div>
  );
}
