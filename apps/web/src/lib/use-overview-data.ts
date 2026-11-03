"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  fetchAlertQueue,
  fetchCases,
  fetchDashboardOverview,
  fetchDetectionRuns,
  fetchGraphNetwork,
  type DashboardOverview,
  type DetectionRun,
  type GraphNetwork,
  type InvestigationCase,
} from "./api";

/** Whole-queue alert counts. Null on a backend without /api/v1/alerts. */
export interface AlertStats {
  total: number;
  severity: Record<string, number>;
  status: Record<string, number>;
}

export interface OverviewErrors {
  overview: string | null;
  network: string | null;
  cases: string | null;
  runs: string | null;
}

export interface OverviewData {
  overview: DashboardOverview | null;
  network: GraphNetwork | null;
  cases: InvestigationCase[];
  detectionRuns: DetectionRun[];
  alertStats: AlertStats | null;
  errors: OverviewErrors;
  /** True only until the first load settles. */
  loading: boolean;
  /** Re-fetches everything; resolves when the data has been applied. */
  refresh: () => Promise<void>;
  refreshCases: () => Promise<void>;
}

const REFRESH_INTERVAL_MS = 60_000;

const NO_ERRORS: OverviewErrors = {
  overview: null,
  network: null,
  cases: null,
  runs: null,
};

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof Error
    ? reason.message
    : fallback;
}

/**
 * Loads the shared dashboard data without letting one failing
 * endpoint block the rest: every source succeeds or fails on its
 * own, and the previous good value is kept when a refresh fails.
 * The data is refreshed in the background while the tab is visible.
 */
export function useOverviewData(): OverviewData {
  const [overview, setOverview] =
    useState<DashboardOverview | null>(null);

  const [network, setNetwork] =
    useState<GraphNetwork | null>(null);

  const [cases, setCases] =
    useState<InvestigationCase[]>([]);

  const [detectionRuns, setDetectionRuns] =
    useState<DetectionRun[]>([]);

  const [alertStats, setAlertStats] =
    useState<AlertStats | null>(null);

  const [errors, setErrors] =
    useState<OverviewErrors>(NO_ERRORS);

  const [loading, setLoading] = useState(true);

  const mounted = useRef(true);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const [
        overviewResult,
        networkResult,
        casesResult,
        runsResult,
        statsResult,
      ] = await Promise.allSettled([
        fetchDashboardOverview(signal),
        fetchGraphNetwork(signal),
        fetchCases(signal),
        fetchDetectionRuns(signal),
        fetchAlertQueue({ size: 1 }, signal),
      ]);

      if (signal?.aborted || !mounted.current) {
        return;
      }

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value);
      }

      if (networkResult.status === "fulfilled") {
        setNetwork(networkResult.value);
      }

      if (casesResult.status === "fulfilled") {
        setCases(casesResult.value);
      }

      if (runsResult.status === "fulfilled") {
        setDetectionRuns(runsResult.value);
      }

      // Optional: an older backend has no alert search API, so a
      // failure here only hides the severity chart.
      if (statsResult.status === "fulfilled") {
        setAlertStats({
          total: statsResult.value.totalItems,
          severity: statsResult.value.severityCounts,
          status: statsResult.value.statusCounts,
        });
      }

      setErrors({
        overview:
          overviewResult.status === "rejected"
            ? messageOf(
                overviewResult.reason,
                "Unable to load the dashboard overview."
              )
            : null,
        network:
          networkResult.status === "rejected"
            ? messageOf(
                networkResult.reason,
                "Unable to load the network graph."
              )
            : null,
        cases:
          casesResult.status === "rejected"
            ? messageOf(
                casesResult.reason,
                "Unable to load investigation cases."
              )
            : null,
        runs:
          runsResult.status === "rejected"
            ? messageOf(
                runsResult.reason,
                "Unable to load detection runs."
              )
            : null,
      });

      setLoading(false);
    },
    []
  );

  useEffect(() => {
    mounted.current = true;

    const controller = new AbortController();

    void load(controller.signal);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(controller.signal);
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted.current = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  const refreshCases = useCallback(async () => {
    try {
      const latest = await fetchCases();

      if (mounted.current) {
        setCases(latest);
      }
    } catch (failure) {
      if (mounted.current) {
        setErrors((current) => ({
          ...current,
          cases: messageOf(
            failure,
            "Unable to refresh investigation cases."
          ),
        }));
      }
    }
  }, []);

  return {
    overview,
    network,
    cases,
    detectionRuns,
    alertStats,
    errors,
    loading,
    refresh,
    refreshCases,
  };
}
