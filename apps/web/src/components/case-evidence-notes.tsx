"use client";

import {
  AlertTriangle,
  FilePlus2,
  MessageSquareText,
  Network,
  Paperclip,
  Save,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  useId,
  useState,
} from "react";

import type {
  CaseWorkspaceEvidence,
  CaseWorkspaceView,
} from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import {
  CASE_TEXT_MAX_LENGTH,
  countEvidenceTypes,
  evidenceCsvColumns,
  filterEvidence,
  filterNotes,
  hasEvidenceFor,
  newestFirst,
} from "@/lib/cw-case-lists";
import {
  formatDateTime,
  humanize,
} from "@/lib/format";
import {
  clampPage,
  paginate,
} from "@/lib/list-utils";

import {
  ChipGroup,
  ExportButton,
  Pager,
  ResetButton,
  ResultCount,
  SearchField,
  Toolbar,
  type Option,
} from "./list-tools";
import { EmptyState } from "./state-card";

const PAGE_SIZE = 8;

/** Notes get a search box once there are enough of them to need one. */
const NOTES_SEARCH_MIN = 4;

/**
 * A failed case operation, shown next to the controls that caused it
 * (the page is long, so a banner at the top could be out of sight).
 */
export function CaseActionError({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="ui-cw-error" role="alert">
      <AlertTriangle size={14} aria-hidden="true" />

      <span>{message}</span>

      <button
        type="button"
        aria-label="Dismiss this error"
        onClick={onDismiss}
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

function EvidenceIcon({ type }: { type: string }) {
  if (type === "GRAPH_CYCLE") {
    return <Network size={15} aria-hidden="true" />;
  }

  if (type === "TRANSACTION") {
    return <FilePlus2 size={15} aria-hidden="true" />;
  }

  return <ShieldAlert size={15} aria-hidden="true" />;
}

export function EvidenceSection({
  workspace,
  action,
  error,
  onDismissError,
  onAttachAlert,
  onAttachTransaction,
  onAttachGraph,
}: {
  workspace: CaseWorkspaceView;
  action: string | null;
  error: string | null;
  onDismissError: () => void;
  onAttachAlert: () => Promise<void>;
  onAttachTransaction: () => Promise<void>;
  onAttachGraph: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");

  const [type, setType] = useState("ALL");

  const [page, setPage] = useState(0);

  const evidence = workspace.evidence;

  const alertAttached = hasEvidenceFor(
    evidence,
    "ALERT",
    workspace.primaryAlert.id
  );

  const reference = workspace.primaryAlert.transactionReference;

  const transactionAttached =
    reference !== null &&
    hasEvidenceFor(evidence, "TRANSACTION", reference);

  const graphAttached = evidence.some(
    (item) => item.evidenceType === "GRAPH_CYCLE"
  );

  const types = Array.from(
    new Set(evidence.map((item) => item.evidenceType))
  ).sort();

  const activeType = types.includes(type) ? type : "ALL";

  const counts = countEvidenceTypes(evidence, query);

  const visible = filterEvidence(evidence, query, activeType);

  const filtered = query.trim() !== "" || activeType !== "ALL";

  const safePage = clampPage(page, visible.length, PAGE_SIZE);

  const typeOptions: Option<string>[] = [
    {
      value: "ALL",
      label: "All",
      count: Object.values(counts).reduce(
        (sum, value) => sum + value,
        0
      ),
    },
    ...types.map((value) => ({
      value,
      label: humanize(value),
      count: counts[value] ?? 0,
    })),
  ];

  function reset() {
    setQuery("");
    setType("ALL");
    setPage(0);
  }

  return (
    <section className="case-workspace-block">
      <div className="case-block-heading">
        <div>
          <Paperclip size={15} aria-hidden="true" />

          <strong>Evidence</strong>
        </div>

        <span>{evidence.length}</span>
      </div>

      <div className="evidence-actions">
        <button
          type="button"
          className="mini-button"
          disabled={action !== null || alertAttached}
          title={
            alertAttached
              ? "This alert is already attached as evidence"
              : undefined
          }
          onClick={() => void onAttachAlert()}
        >
          <ShieldAlert size={12} aria-hidden="true" />
          {action === "alert"
            ? "Attaching..."
            : alertAttached
              ? "Alert attached"
              : "Attach alert"}
        </button>

        <button
          type="button"
          className="mini-button"
          disabled={
            action !== null ||
            !reference ||
            transactionAttached
          }
          title={
            !reference
              ? "The primary alert has no transaction"
              : transactionAttached
                ? "This transaction is already attached as evidence"
                : undefined
          }
          onClick={() => void onAttachTransaction()}
        >
          <FilePlus2 size={12} aria-hidden="true" />
          {action === "transaction"
            ? "Attaching..."
            : transactionAttached
              ? "Transaction attached"
              : "Attach transaction"}
        </button>

        <button
          type="button"
          className="mini-button"
          disabled={action !== null || graphAttached}
          title={
            graphAttached
              ? "Circular-flow graph evidence is already attached"
              : undefined
          }
          onClick={() => void onAttachGraph()}
        >
          <Network size={12} aria-hidden="true" />
          {action === "graph"
            ? "Attaching..."
            : graphAttached
              ? "Circular graph attached"
              : "Attach circular graph"}
        </button>
      </div>

      <CaseActionError message={error} onDismiss={onDismissError} />

      {evidence.length > 0 && (
        <>
          <Toolbar label="Filter case evidence">
            <SearchField
              label="Search evidence"
              placeholder="Search title, reference or snapshot..."
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(0);
              }}
            />

            <ResetButton disabled={!filtered} onClick={reset} />

            <ExportButton
              disabled={visible.length === 0}
              onExport={() =>
                exportRowsAsCsv(
                  `${workspace.caseNumber} evidence`,
                  visible,
                  evidenceCsvColumns(workspace.caseNumber)
                )
              }
            />
          </Toolbar>

          {types.length > 1 && (
            <div className="ui-chips-row">
              <ChipGroup
                label="Filter evidence by type"
                value={activeType}
                options={typeOptions}
                onChange={(value) => {
                  setType(value);
                  setPage(0);
                }}
              />
            </div>
          )}

          <ResultCount
            shown={visible.length}
            total={evidence.length}
            noun="evidence items"
            filtered={filtered}
          />
        </>
      )}

      {evidence.length === 0 ? (
        <EmptyState
          compact
          title="No preserved evidence yet"
          message="Attach the alert, its transaction or the circular-flow graph to keep a snapshot with the case."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          compact
          title="No evidence matches these filters"
          message="Try a different search or clear the filters."
          action={
            <button
              type="button"
              className="secondary-button"
              onClick={reset}
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="evidence-list">
          {paginate(visible, safePage, PAGE_SIZE).map(
            (item: CaseWorkspaceEvidence) => (
              <article className="evidence-item" key={item.id}>
                <div className="evidence-icon">
                  <EvidenceIcon type={item.evidenceType} />
                </div>

                <div className="evidence-copy">
                  <strong>{item.title}</strong>

                  <p>{item.description}</p>

                  <div className="evidence-meta">
                    <span>{item.evidenceType}</span>

                    <span>{item.referenceId}</span>

                    <time
                      dateTime={item.createdAt}
                      title={item.createdAt}
                    >
                      {formatDateTime(item.createdAt)}
                    </time>
                  </div>

                  <code>{item.snapshotText}</code>
                </div>
              </article>
            )
          )}
        </div>
      )}

      <Pager
        label="Evidence pages"
        page={safePage}
        pageSize={PAGE_SIZE}
        total={visible.length}
        onPage={setPage}
      />
    </section>
  );
}

export function NotesSection({
  workspace,
  noteBody,
  action,
  error,
  onDismissError,
  onNoteChange,
  onSubmit,
}: {
  workspace: CaseWorkspaceView;
  noteBody: string;
  action: string | null;
  error: string | null;
  onDismissError: () => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");

  const [page, setPage] = useState(0);

  const composerId = useId();

  const counterId = useId();

  const saving = action === "note";

  const canSave = noteBody.trim() !== "" && action === null;

  const notes = workspace.notes;

  const visible = filterNotes(newestFirst(notes), query);

  const filtered = query.trim() !== "";

  const safePage = clampPage(page, visible.length, PAGE_SIZE);

  const remaining = CASE_TEXT_MAX_LENGTH - noteBody.length;

  return (
    <section className="case-workspace-block">
      <div className="case-block-heading">
        <div>
          <MessageSquareText size={15} aria-hidden="true" />

          <strong>Analyst notes</strong>
        </div>

        <span>{notes.length}</span>
      </div>

      <div className="note-composer ui-cw-composer">
        <label
          htmlFor={composerId}
          className="ui-visually-hidden"
        >
          New analyst note
        </label>

        <textarea
          id={composerId}
          value={noteBody}
          maxLength={CASE_TEXT_MAX_LENGTH}
          readOnly={saving}
          placeholder="Record investigative observations, rationale or follow-up..."
          aria-describedby={counterId}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          onChange={(event) => onNoteChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.ctrlKey || event.metaKey)
            ) {
              event.preventDefault();

              if (canSave) {
                void onSubmit();
              }
            }
          }}
        />

        <button
          type="button"
          className="primary-button"
          disabled={!canSave}
          title="Save note (Ctrl+Enter)"
          onClick={() => void onSubmit()}
        >
          <Save size={14} aria-hidden="true" />
          {saving ? "Saving..." : "Save note"}
        </button>

        <p
          id={counterId}
          className={
            remaining <= 100
              ? "ui-cw-counter ui-cw-counter-warn"
              : "ui-cw-counter"
          }
        >
          {noteBody.length.toLocaleString()} /{" "}
          {CASE_TEXT_MAX_LENGTH.toLocaleString()} characters
          {remaining <= 100 &&
            ` (${remaining.toLocaleString()} left)`}
          {" · Ctrl+Enter to save"}
        </p>
      </div>

      <CaseActionError message={error} onDismiss={onDismissError} />

      {notes.length >= NOTES_SEARCH_MIN && (
        <>
          <Toolbar label="Search analyst notes">
            <SearchField
              label="Search notes"
              placeholder="Search notes or authors..."
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(0);
              }}
            />

            <ResetButton
              disabled={!filtered}
              onClick={() => {
                setQuery("");
                setPage(0);
              }}
            />
          </Toolbar>

          <ResultCount
            shown={visible.length}
            total={notes.length}
            noun="notes"
            filtered={filtered}
          />
        </>
      )}

      <div className="case-note-list">
        {notes.length === 0 ? (
          <EmptyState
            compact
            title="No analyst notes yet"
            message="Write the first note above. Notes are kept with the case and its audit timeline."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            title="No notes match this search"
            message="Try different words or clear the search."
            action={
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setQuery("");
                  setPage(0);
                }}
              >
                Clear search
              </button>
            }
          />
        ) : (
          paginate(visible, safePage, PAGE_SIZE).map((note) => (
            <article className="case-note" key={note.id}>
              <div className="case-note-head">
                <strong>{note.authorName}</strong>

                <time
                  dateTime={note.createdAt}
                  title={note.createdAt}
                >
                  {formatDateTime(note.createdAt)}
                </time>
              </div>

              <p className="ui-cw-pre">{note.body}</p>
            </article>
          ))
        )}
      </div>

      <Pager
        label="Note pages"
        page={safePage}
        pageSize={PAGE_SIZE}
        total={visible.length}
        onPage={setPage}
      />
    </section>
  );
}
