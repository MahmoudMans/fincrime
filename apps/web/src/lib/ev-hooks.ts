"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { failureMessage, isAbort } from "@/lib/ev-common";

export interface ActionRunner {
  /** Key of the action that is running, or null. */
  busy: string | null;
  /** Message of the last failed action, or null. */
  error: string | null;
  /** Key of the action that failed, so the message can sit beside it. */
  errorKey: string | null;
  /**
   * Runs one action at a time. A second call while one is running is
   * ignored (double click, Enter held down). `onSuccess` only runs
   * while the screen is still mounted, so it can set state freely.
   */
  run: <T>(
    key: string,
    task: () => Promise<T>,
    fallback: string,
    onSuccess?: (result: T) => void
  ) => Promise<void>;
  clearError: () => void;
}

/**
 * Busy flag, error text and double-submit guard for the buttons of a
 * screen that changes data.
 */
export function useActionRunner(): ActionRunner {
  const [busy, setBusy] = useState<string | null>(null);

  const [failed, setFailed] = useState<{
    key: string;
    message: string;
  } | null>(null);

  const aliveRef = useRef(true);

  const runningRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;
    };
  }, []);

  const run = useCallback(
    async <T>(
      key: string,
      task: () => Promise<T>,
      fallback: string,
      onSuccess?: (result: T) => void
    ) => {
      if (runningRef.current) {
        return;
      }

      runningRef.current = true;

      setBusy(key);
      setFailed(null);

      try {
        const result = await task();

        if (aliveRef.current) {
          onSuccess?.(result);
        }
      } catch (failure) {
        if (aliveRef.current && !isAbort(failure)) {
          setFailed({
            key,
            message: failureMessage(failure, fallback),
          });
        }
      } finally {
        runningRef.current = false;

        if (aliveRef.current) {
          setBusy(null);
        }
      }
    },
    []
  );

  const clearError = useCallback(() => setFailed(null), []);

  return {
    busy,
    error: failed?.message ?? null,
    errorKey: failed?.key ?? null,
    run,
    clearError,
  };
}
