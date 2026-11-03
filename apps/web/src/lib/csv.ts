export type CsvValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

/**
 * Spreadsheet programs run text that starts with one of these as a
 * formula. Alert titles, customer names and notes are free text, so
 * they are prefixed with a quote to keep them as plain text.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text =
    typeof value === "string" ? value : String(value);

  if (typeof value === "string" && FORMULA_START.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function toCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[]
): string {
  const lines = [
    columns.map((column) => escapeCsvCell(column.header)),
    ...rows.map((row) =>
      columns.map((column) => escapeCsvCell(column.value(row)))
    ),
  ];

  return lines.map((cells) => cells.join(",")).join("\r\n");
}

/** "Alert queue" -> "alert-queue-2026-10-07.csv". */
export function csvFilename(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export";

  return `${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
}

/** Saves the text as a UTF-8 CSV file (with a BOM so Excel reads it). */
export function downloadCsv(name: string, csv: string) {
  const blob = new Blob(["﻿", csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = csvFilename(name);
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function exportRowsAsCsv<T>(
  name: string,
  rows: readonly T[],
  columns: readonly CsvColumn<T>[]
) {
  downloadCsv(name, toCsv(rows, columns));
}
