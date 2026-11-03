"use client";

import { UserRoundCheck } from "lucide-react";
import {
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ASSIGNEE_MAX_LENGTH,
  assigneeInitials,
  assigneeProblem,
  collectAssignees,
  formatAssignee,
  isCurrentUser,
  sameAssignee,
} from "@/lib/cw-assignee";
import { plural } from "@/lib/list-utils";

import { useAuth } from "./auth-context";
import { ConfirmButton } from "./confirm-button";

const MAX_SUGGESTION_CHIPS = 6;

/**
 * Chooses who a case is assigned to. The assignee is free text, so
 * the field offers the signed-in user ("Assign to me", stored the way
 * the backend writes actors: "Name (username)"), the people already
 * on other cases, and anything typed. It is a native combobox
 * (input + datalist) with a visible label, so it works with the
 * keyboard and screen readers; Enter submits.
 */
export function AssigneePicker({
  assignedTo,
  knownAssignees,
  canEdit,
  busy,
  onAssign,
  onUnassign,
}: {
  assignedTo: string | null;
  /** Assignees on the cases the person can see. Repeats are counted. */
  knownAssignees: ReadonlyArray<string | null | undefined>;
  canEdit: boolean;
  /** True while any case operation is running. */
  busy: boolean;
  /** Resolves true when the assignment was saved. */
  onAssign: (assignee: string) => Promise<boolean>;
  /**
   * Shows an Unassign button when given. The case workspace does not
   * pass it yet: the backend rejects an empty assignee.
   */
  onUnassign?: () => Promise<boolean>;
}) {
  const { session } = useAuth();

  const me = formatAssignee(session.displayName, session.username);

  const [draft, setDraft] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);

  const inputId = useId();

  const listId = useId();

  const hintId = useId();

  const noteId = useId();

  const suggestions = useMemo(
    () => collectAssignees([...knownAssignees, me]),
    [knownAssignees, me]
  );

  const chips = suggestions
    .filter(
      (item) =>
        !sameAssignee(item.name, assignedTo) &&
        !sameAssignee(item.name, me)
    )
    .slice(0, MAX_SUGGESTION_CHIPS);

  const assignedToMe = sameAssignee(assignedTo, me);

  const isMine = isCurrentUser(
    assignedTo,
    session.displayName,
    session.username
  );

  const locked = !canEdit || busy || submitting;

  const draftProblem = assigneeProblem(draft, assignedTo);

  const problem = draft.trim() ? draftProblem : null;

  const canSubmit = !locked && draftProblem === null;

  async function run(task: () => Promise<boolean>) {
    if (submittingRef.current) {
      return false;
    }

    submittingRef.current = true;

    setSubmitting(true);

    try {
      return await task();
    } finally {
      submittingRef.current = false;

      setSubmitting(false);
    }
  }

  async function submit(value: string) {
    if (!canEdit || busy || assigneeProblem(value, assignedTo)) {
      return;
    }

    const saved = await run(() => onAssign(value.trim()));

    if (saved) {
      setDraft("");
    }
  }

  return (
    <div className="ui-cw-picker">
      <div className="ui-cw-owner" role="status">
        <span className="ui-cw-avatar" aria-hidden="true">
          {assignedTo ? assigneeInitials(assignedTo) : "?"}
        </span>

        <div className="ui-cw-owner-copy">
          <span className="ui-cw-owner-label">Current owner</span>

          <strong>{assignedTo ?? "Unassigned"}</strong>
        </div>

        {isMine && <span className="ui-cw-owner-you">You</span>}
      </div>

      <form
        className="ui-cw-picker-form"
        onSubmit={(event) => {
          event.preventDefault();

          void submit(draft);
        }}
      >
        <label htmlFor={inputId} className="ui-cw-field-label">
          Assign to
        </label>

        <input
          id={inputId}
          className="ui-cw-input"
          list={listId}
          value={draft}
          maxLength={ASSIGNEE_MAX_LENGTH}
          autoComplete="off"
          readOnly={busy || submitting}
          disabled={!canEdit}
          placeholder="Name or Name (username)"
          aria-describedby={`${hintId}${canEdit ? "" : ` ${noteId}`}`}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => setDraft(event.target.value)}
        />

        <datalist id={listId}>
          {suggestions.map((item) => (
            <option key={item.name} value={item.name} />
          ))}
        </datalist>

        <p
          id={hintId}
          className={
            problem
              ? "ui-cw-hint ui-cw-hint-problem"
              : "ui-cw-hint"
          }
        >
          {problem ??
            "Pick a suggestion or type any name. Press Enter to assign."}

          {draft.length > ASSIGNEE_MAX_LENGTH - 40 && (
            <span>
              {" "}
              {draft.length}/{ASSIGNEE_MAX_LENGTH}
            </span>
          )}
        </p>

        {chips.length > 0 && (
          <div
            className="ui-cw-chips"
            role="group"
            aria-label="Suggested assignees"
          >
            {chips.map((item) => (
              <button
                key={item.name}
                type="button"
                className="ui-cw-chip"
                disabled={locked}
                title={`${item.count} ${plural(
                  item.count,
                  "case"
                )}. Fill in ${item.name}`}
                onClick={() => setDraft(item.name)}
              >
                <span className="ui-cw-avatar ui-cw-avatar-small" aria-hidden="true">
                  {assigneeInitials(item.name)}
                </span>

                <span className="ui-cw-chip-text">{item.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="ui-cw-picker-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={locked || assignedToMe}
            aria-describedby={canEdit ? undefined : noteId}
            title={assignedToMe ? "The case is already assigned to you" : me}
            onClick={() => void submit(me)}
          >
            <UserRoundCheck size={13} aria-hidden="true" />
            Assign to me
          </button>

          <button
            type="submit"
            className="secondary-button"
            disabled={!canSubmit}
            aria-describedby={canEdit ? undefined : noteId}
          >
            {submitting ? "Assigning..." : "Assign case"}
          </button>

          {onUnassign && assignedTo && (
            <ConfirmButton
              confirmLabel="Yes, unassign"
              disabled={locked}
              onConfirm={() => void run(onUnassign)}
            >
              Unassign
            </ConfirmButton>
          )}
        </div>
      </form>

      {!canEdit && (
        <span id={noteId} className="case-permission-note" role="note">
          Senior Analyst or Administrator required
        </span>
      )}
    </div>
  );
}
