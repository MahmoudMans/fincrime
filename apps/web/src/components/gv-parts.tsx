"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { ReactNode } from "react";

import { ErrorState, LoadingState } from "@/components/state-card";

/** A message about an action: red for a failure, green for success. */
export function Banner({
  kind,
  onDismiss,
  children,
}: {
  kind: "error" | "ok";
  onDismiss?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`ui-gv-banner ui-gv-banner-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {kind === "error" ? (
        <AlertTriangle size={15} aria-hidden="true" />
      ) : (
        <CheckCircle2 size={15} aria-hidden="true" />
      )}

      <span>{children}</span>

      {onDismiss && (
        <button
          type="button"
          className="ui-gv-banner-close"
          aria-label="Dismiss message"
          onClick={onDismiss}
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** A short status label. The text carries the meaning, not the colour. */
export function StatusPill({
  tone = "info",
  children,
}: {
  tone?: "danger" | "warning" | "ok" | "info" | "neutral" | "violet";
  children: ReactNode;
}) {
  return (
    <span className="ui-gv-pill" data-tone={tone}>
      {children}
    </span>
  );
}

/**
 * What to show above a screen's content while it loads or after a
 * failed load: a spinner before the first result, a full error with
 * Try again when there is nothing to show, or a slim error above the
 * earlier data after a failed refresh. Renders nothing otherwise.
 */
export function LoadNotice({
  data,
  error,
  onRetry,
  label,
  errorTitle,
}: {
  data: unknown;
  error: string | null;
  onRetry: () => void;
  label: string;
  errorTitle: string;
}) {
  if (data === null) {
    return error ? (
      <ErrorState
        title={errorTitle}
        message={error}
        onRetry={onRetry}
      />
    ) : (
      <LoadingState label={label} />
    );
  }

  if (error) {
    return (
      <ErrorState
        compact
        title="Could not refresh. Showing the earlier data."
        message={error}
        onRetry={onRetry}
      />
    );
  }

  return null;
}
