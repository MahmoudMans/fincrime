"use client";

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { pageCount } from "@/lib/list-utils";
import { useSavedFilters } from "@/lib/use-saved-filters";

/** A wrapping row for the controls above a list or table. */
export function Toolbar({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-tools" role="search" aria-label={label}>
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder = "Search...",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <label className="ui-search-field ui-tools-search">
      <span className="ui-visually-hidden">{label}</span>

      <Search size={15} aria-hidden="true" />

      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Colours the active chip: danger, warning, ok or info. */
  tone?: "danger" | "warning" | "ok" | "info";
}

export function SelectField<T extends string>({
  value,
  onChange,
  label,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  label: string;
  options: readonly Option<T>[];
}) {
  return (
    <select
      className="ui-select ui-tools-select"
      aria-label={label}
      value={value}
      onChange={(event) =>
        onChange(event.target.value as T)
      }
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
          {option.count !== undefined
            ? ` (${option.count.toLocaleString()})`
            : ""}
        </option>
      ))}
    </select>
  );
}

/** Pill buttons for a short list of mutually exclusive filters. */
export function ChipGroup<T extends string>({
  value,
  onChange,
  label,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  label: string;
  options: readonly Option<T>[];
}) {
  return (
    <div
      className="ui-chips"
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            className={
              active
                ? `ui-chip active${
                    option.tone ? ` ui-chip-${option.tone}` : ""
                  }`
                : "ui-chip"
            }
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}

            {option.count !== undefined && (
              <span className="ui-chip-count">
                {option.count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ResultCount({
  shown,
  total,
  noun,
  filtered,
}: {
  shown: number;
  total: number;
  noun: string;
  filtered: boolean;
}) {
  return (
    <p className="ui-result-count" aria-live="polite">
      {total === 0
        ? `No ${noun}`
        : shown === total
          ? `${total.toLocaleString()} ${noun}`
          : `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} ${noun}`}
      {filtered && total > 0 ? " (filtered)" : ""}
    </p>
  );
}

export function ResetButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ui-reset"
      disabled={disabled}
      onClick={onClick}
    >
      Reset
    </button>
  );
}

/**
 * Downloads what the person is looking at. `onExport` builds and
 * saves the file (see exportRowsAsCsv in lib/csv.ts).
 */
export function ExportButton({
  onExport,
  disabled = false,
  label = "Export CSV",
}: {
  onExport: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="ui-icon-text-button"
      disabled={disabled}
      onClick={onExport}
      title={
        disabled
          ? "Nothing to export"
          : "Download the rows that match the current filters"
      }
    >
      <Download size={14} aria-hidden="true" />
      {label}
    </button>
  );
}

/** Previous / Next for client-side paging (page is 0-based). */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  label,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  label: string;
}) {
  const pages = pageCount(total, pageSize);

  if (pages <= 1) {
    return null;
  }

  return (
    <nav className="ui-pager" aria-label={label}>
      <button
        type="button"
        className="secondary-button"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={13} aria-hidden="true" />
        Previous
      </button>

      <span>
        Page {Math.min(page, pages - 1) + 1} of {pages}
      </span>

      <button
        type="button"
        className="secondary-button"
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
      >
        Next
        <ChevronRight size={13} aria-hidden="true" />
      </button>
    </nav>
  );
}

/**
 * Saved filter presets for one screen. `current` is the filter state
 * as the screen holds it; `onApply` receives a preset back. Presets
 * live in this browser only.
 */
export function SavedViews<T>({
  storageKey,
  current,
  canSave,
  onApply,
}: {
  storageKey: string;
  current: T;
  /** False while the screen shows its unfiltered default. */
  canSave: boolean;
  onApply: (value: T) => void;
}) {
  const { saved, save, remove } = useSavedFilters<T>(storageKey);

  const [naming, setNaming] = useState(false);

  const [name, setName] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (naming) {
      inputRef.current?.focus();
    }
  }, [naming]);

  const currentKey = JSON.stringify(current);

  function commit() {
    if (name.trim() === "") {
      return;
    }

    save(name, current);
    setName("");
    setNaming(false);
  }

  if (saved.length === 0 && !canSave) {
    return null;
  }

  return (
    <div
      className="ui-views"
      role="group"
      aria-label="Saved views"
    >
      <span className="ui-views-label">
        <Bookmark size={13} aria-hidden="true" />
        Saved views
      </span>

      {saved.map((view) => (
        <span
          key={view.id}
          className={
            JSON.stringify(view.value) === currentKey
              ? "ui-view active"
              : "ui-view"
          }
        >
          <button
            type="button"
            className="ui-view-apply"
            onClick={() => onApply(view.value)}
          >
            {view.name}
          </button>

          <button
            type="button"
            className="ui-view-remove"
            aria-label={`Remove saved view ${view.name}`}
            onClick={() => remove(view.id)}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}

      {naming ? (
        <form
          className="ui-view-form"
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
        >
          <input
            ref={inputRef}
            value={name}
            maxLength={40}
            placeholder="Name this view"
            aria-label="Name for the saved view"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setNaming(false);
                setName("");
              }
            }}
          />

          <button
            type="submit"
            className="secondary-button"
            disabled={name.trim() === ""}
          >
            Save
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setNaming(false);
              setName("");
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="ui-view-add"
          disabled={!canSave}
          onClick={() => setNaming(true)}
          title={
            canSave
              ? "Save the current filters as a view"
              : "Set a filter first, then save it"
          }
        >
          + Save current filters
        </button>
      )}
    </div>
  );
}
