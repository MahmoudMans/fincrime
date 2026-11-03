"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";

interface Settled<T> {
  fetcher: unknown;
  tick: number;
  data: T | null;
  error: string | null;
  status: number | null;
}

export interface LoadResult<T> {
  /** Last successfully loaded value. Kept while a reload runs. */
  data: T | null;
  /** Message of the latest failure, or null. */
  error: string | null;
  /** HTTP status behind the failure when there is one. */
  errorStatus: number | null;
  /** True until the current fetcher has produced a result. */
  loading: boolean;
  /** Runs the same request again. */
  reload: () => void;
}

function messageOf(failure: unknown, fallback: string) {
  if (failure instanceof ApiError || failure instanceof Error) {
    return failure.message || fallback;
  }

  return fallback;
}

/**
 * Loads data with a cancellable request. Wrap the fetcher in
 * useCallback so that it only changes when its inputs change: a new
 * fetcher starts a new request and aborts the previous one, while the
 * previous data stays on screen until the new data arrives.
 */
export function useLoad<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  fallbackMessage = "Unable to load data."
): LoadResult<T> {
  const [tick, setTick] = useState(0);

  const [settled, setSettled] = useState<Settled<T> | null>(
    null
  );

  useEffect(() => {
    const controller = new AbortController();

    Promise.resolve()
      .then(() => fetcher(controller.signal))
      .then(
        (data) => {
          if (controller.signal.aborted) {
            return;
          }

          setSettled({
            fetcher,
            tick,
            data,
            error: null,
            status: null,
          });
        },
        (failure: unknown) => {
          if (
            controller.signal.aborted ||
            (failure instanceof DOMException &&
              failure.name === "AbortError")
          ) {
            return;
          }

          setSettled((previous) => ({
            fetcher,
            tick,
            data: previous?.data ?? null,
            error: messageOf(failure, fallbackMessage),
            status:
              failure instanceof ApiError
                ? failure.status
                : null,
          }));
        }
      );

    return () => controller.abort();
  }, [fetcher, tick, fallbackMessage]);

  const reload = useCallback(() => {
    setTick((current) => current + 1);
  }, []);

  const current =
    settled !== null &&
    settled.fetcher === fetcher &&
    settled.tick === tick
      ? settled
      : null;

  return {
    data: settled?.data ?? null,
    error: current?.error ?? null,
    errorStatus: current?.status ?? null,
    loading: current === null,
    reload,
  };
}
