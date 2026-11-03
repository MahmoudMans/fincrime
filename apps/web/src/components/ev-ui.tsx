"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { shortHash } from "@/lib/format";

/** An action failed: announced at once, can be dismissed. */
export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="ui-ev-banner ui-ev-banner-error" role="alert">
      <AlertTriangle size={15} aria-hidden="true" />

      <span>{message}</span>

      {onDismiss && (
        <button
          type="button"
          className="ui-ev-banner-close"
          aria-label="Dismiss this message"
          onClick={onDismiss}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** An action worked: announced politely, can be dismissed. */
export function SuccessBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="ui-ev-banner ui-ev-banner-ok" role="status">
      <CheckCircle2 size={15} aria-hidden="true" />

      <span>{message}</span>

      {onDismiss && (
        <button
          type="button"
          className="ui-ev-banner-close"
          aria-label="Dismiss this message"
          onClick={onDismiss}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Copies the full value to the clipboard. The clipboard can be
 * refused (insecure page, permission), so the result is shown either
 * way: "Copied" or "Copy failed", for a couple of seconds.
 */
export function CopyButton({
  value,
  label,
}: {
  value: string;
  /** What is being copied, for the accessible name: "content hash". */
  label: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  async function copy() {
    let next: "copied" | "failed" = "copied";

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      next = "failed";
    }

    setState(next);

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setState("idle");
    }, 2000);
  }

  return (
    <div className="ui-ev-copy">
      <button
        type="button"
        className="ui-ev-copy-button"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        onClick={() => void copy()}
      >
        <Copy size={13} aria-hidden="true" />
      </button>

      <output
        className={
          state === "failed"
            ? "ui-ev-copy-state ui-ev-copy-failed"
            : "ui-ev-copy-state"
        }
      >
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Copy failed"
            : ""}
      </output>
    </div>
  );
}

/**
 * A hash shortened for reading, with the whole value in the tooltip
 * and one click to copy it.
 */
export function HashText({
  value,
  label,
  length = 16,
}: {
  value: string | null | undefined;
  label: string;
  length?: number;
}) {
  if (!value) {
    return <span className="ui-ev-hash-empty">—</span>;
  }

  return (
    <div className="ui-ev-hash">
      <code title={value}>{shortHash(value, length)}</code>

      <CopyButton value={value} label={label} />
    </div>
  );
}
