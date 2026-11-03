import type { DataImportIssue, DataImportJob } from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { humanize } from "@/lib/format";
import { matchesQuery } from "@/lib/list-utils";

/** The backend rejects larger files ("Import files are limited to 5 MB."). */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Checks a chosen file before it is uploaded, so the person gets the
 * reason at once instead of after a round trip. The server still has
 * the final say (row limit, content checks).
 */
export function validateImportFile(file: {
  name: string;
  size: number;
}): string | null {
  if (!/\.(csv|json)$/i.test(file.name)) {
    return `${file.name} is not a CSV or JSON file.`;
  }

  if (file.size === 0) {
    return `${file.name} is empty.`;
  }

  if (file.size > IMPORT_MAX_BYTES) {
    return `${file.name} is ${formatFileSize(
      file.size
    )}. Import files are limited to 5 MB.`;
  }

  return null;
}

export interface JobFilters {
  q: string;
  /** A job status, or "ALL". */
  status: string;
  /** A dataset type, or "ALL". */
  dataset: string;
}

export const DEFAULT_JOB_FILTERS: JobFilters = {
  q: "",
  status: "ALL",
  dataset: "ALL",
};

/** Statuses in pipeline order; anything else sorts after them. */
const STATUS_ORDER = [
  "UPLOADED",
  "VALIDATED",
  "READY",
  "IMPORTED",
  "FAILED",
];

export function jobStatusesOf(
  jobs: readonly DataImportJob[]
): string[] {
  const present = Array.from(
    new Set(jobs.map((job) => job.status))
  );

  const rank = (status: string) => {
    const index = STATUS_ORDER.indexOf(status);

    return index === -1 ? STATUS_ORDER.length : index;
  };

  return present.sort(
    (left, right) =>
      rank(left) - rank(right) || left.localeCompare(right)
  );
}

export function jobDatasetsOf(
  jobs: readonly DataImportJob[]
): string[] {
  return Array.from(
    new Set(jobs.map((job) => job.datasetType))
  ).sort();
}

function jobMatchesQuery(
  job: DataImportJob,
  query: string
): boolean {
  return matchesQuery(query, [
    job.fileName,
    job.datasetType,
    humanize(job.datasetType),
    job.status,
    humanize(job.status),
    job.createdBy,
    job.sha256,
    job.id,
    job.graphSyncStatus,
    job.failureMessage,
  ]);
}

export function filterJobs(
  jobs: readonly DataImportJob[],
  filters: JobFilters
): DataImportJob[] {
  return jobs.filter(
    (job) =>
      (filters.status === "ALL" ||
        job.status === filters.status) &&
      (filters.dataset === "ALL" ||
        job.datasetType === filters.dataset) &&
      jobMatchesQuery(job, filters.q)
  );
}

/** Per-status counts for the jobs that match the other filters. */
export function countJobStatuses(
  jobs: readonly DataImportJob[],
  filters: Pick<JobFilters, "q" | "dataset">
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const job of jobs) {
    if (
      (filters.dataset !== "ALL" &&
        job.datasetType !== filters.dataset) ||
      !jobMatchesQuery(job, filters.q)
    ) {
      continue;
    }

    counts[job.status] = (counts[job.status] ?? 0) + 1;
  }

  return counts;
}

export function statusTone(
  status: string
): "danger" | "warning" | "ok" | "info" | undefined {
  switch (status) {
    case "FAILED":
      return "danger";
    case "VALIDATED":
      return "warning";
    case "READY":
    case "IMPORTED":
      return "ok";
    case "UPLOADED":
      return "info";
    default:
      return undefined;
  }
}

export const JOB_CSV_COLUMNS: CsvColumn<DataImportJob>[] = [
  { header: "Job id", value: (job) => job.id },
  { header: "File name", value: (job) => job.fileName },
  { header: "Dataset", value: (job) => job.datasetType },
  { header: "Status", value: (job) => job.status },
  { header: "File size (bytes)", value: (job) => job.fileSize },
  { header: "Media type", value: (job) => job.mediaType },
  { header: "SHA-256", value: (job) => job.sha256 },
  { header: "Total rows", value: (job) => job.totalRows },
  { header: "Valid rows", value: (job) => job.validRows },
  {
    header: "Duplicate rows",
    value: (job) => job.duplicateRows,
  },
  { header: "Invalid rows", value: (job) => job.invalidRows },
  {
    header: "Imported rows",
    value: (job) => job.importedRows,
  },
  { header: "Created by", value: (job) => job.createdBy },
  {
    header: "Created at (ISO 8601)",
    value: (job) => job.createdAt,
  },
  {
    header: "Validated at (ISO 8601)",
    value: (job) => job.validatedAt,
  },
  {
    header: "Imported at (ISO 8601)",
    value: (job) => job.importedAt,
  },
  {
    header: "Graph sync status",
    value: (job) => job.graphSyncStatus,
  },
  {
    header: "Graph sync error",
    value: (job) => job.graphSyncError,
  },
  {
    header: "Failure message",
    value: (job) => job.failureMessage,
  },
];

export interface IssueFilters {
  q: string;
  /** An issue classification (INVALID, DUPLICATE), or "ALL". */
  classification: string;
}

export const DEFAULT_ISSUE_FILTERS: IssueFilters = {
  q: "",
  classification: "ALL",
};

function issueMatchesQuery(
  issue: DataImportIssue,
  query: string
): boolean {
  return matchesQuery(query, [
    issue.rowNumber,
    issue.classification,
    issue.field,
    issue.code,
    issue.message,
  ]);
}

export function filterIssues(
  issues: readonly DataImportIssue[],
  filters: IssueFilters
): DataImportIssue[] {
  return issues.filter(
    (issue) =>
      (filters.classification === "ALL" ||
        issue.classification === filters.classification) &&
      issueMatchesQuery(issue, filters.q)
  );
}

export function countIssueClassifications(
  issues: readonly DataImportIssue[],
  query: string
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const issue of issues) {
    if (!issueMatchesQuery(issue, query)) {
      continue;
    }

    counts[issue.classification] =
      (counts[issue.classification] ?? 0) + 1;
  }

  return counts;
}

export function issueCsvColumns(
  job: Pick<DataImportJob, "id" | "fileName">
): CsvColumn<DataImportIssue>[] {
  return [
    { header: "Job id", value: () => job.id },
    { header: "File name", value: () => job.fileName },
    { header: "Row", value: (issue) => issue.rowNumber },
    {
      header: "Classification",
      value: (issue) => issue.classification,
    },
    { header: "Field", value: (issue) => issue.field },
    { header: "Code", value: (issue) => issue.code },
    { header: "Message", value: (issue) => issue.message },
  ];
}
