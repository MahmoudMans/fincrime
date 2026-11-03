"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * A button for actions that cannot be undone. The first click asks
 * "Are you sure?" in place; the second click runs the action. The
 * question goes away by itself after a few seconds.
 */
export function ConfirmButton({
  children,
  confirmLabel = "Yes, continue",
  className = "secondary-button",
  disabled = false,
  onConfirm,
}: {
  children: ReactNode;
  confirmLabel?: string;
  className?: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) {
      return;
    }

    const timer = window.setTimeout(
      () => setArmed(false),
      6000
    );

    return () => window.clearTimeout(timer);
  }, [armed]);

  if (!armed) {
    return (
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => setArmed(true)}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      className="ui-confirm"
      role="group"
      aria-label="Confirm this action"
    >
      <button
        type="button"
        className="ui-confirm-yes"
        disabled={disabled}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>

      <button
        type="button"
        className="ui-confirm-no"
        onClick={() => setArmed(false)}
      >
        Cancel
      </button>
    </span>
  );
}
