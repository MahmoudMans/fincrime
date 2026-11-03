import { initialsOf } from "@/lib/format";

/** The backend stores assignees in a 160 character column. */
export const ASSIGNEE_MAX_LENGTH = 160;

/**
 * The text the app stores for a signed-in user: the same
 * "Display Name (username)" the backend writes as the actor on case
 * events, e.g. "Senior AML Analyst (senior@fincrime.local)".
 */
export function formatAssignee(
  displayName: string,
  username: string
): string {
  const name = displayName.trim();

  const user = username.trim();

  const text =
    name && user && name !== user
      ? `${name} (${user})`
      : name || user;

  return text.slice(0, ASSIGNEE_MAX_LENGTH);
}

/**
 * "Senior AML Analyst (senior@fincrime.local)" -> "SA". initialsOf on
 * the whole text would read the "(username" part as a last name.
 */
export function assigneeInitials(assignee: string): string {
  const name = assignee.replace(/\s*\([^)]*\)\s*$/, "").trim();

  return initialsOf(name || assignee);
}

function keyOf(value: string): string {
  return value.trim().toLowerCase();
}

export function sameAssignee(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  return (
    Boolean(left && right) &&
    keyOf(left ?? "") === keyOf(right ?? "")
  );
}

/**
 * True when the stored assignee text names this user, whether it was
 * written as "Name (username)", just the username or just the name.
 */
export function isCurrentUser(
  assignee: string | null | undefined,
  displayName: string,
  username: string
): boolean {
  const value = keyOf(assignee ?? "");

  const user = keyOf(username);

  if (!value) {
    return false;
  }

  return (
    value === keyOf(formatAssignee(displayName, username)) ||
    (user !== "" &&
      (value === user || value.endsWith(`(${user})`))) ||
    (keyOf(displayName) !== "" && value === keyOf(displayName))
  );
}

export interface AssigneeSuggestion {
  name: string;
  /** Number of cases that carry this assignee. */
  count: number;
}

/**
 * Assignees already used on cases, most used first. Names that only
 * differ by case or surrounding spaces count as one person.
 */
export function collectAssignees(
  sources: ReadonlyArray<string | null | undefined>
): AssigneeSuggestion[] {
  const found = new Map<string, AssigneeSuggestion>();

  for (const source of sources) {
    const name = source?.trim();

    if (!name) {
      continue;
    }

    const existing = found.get(keyOf(name));

    if (existing) {
      existing.count += 1;
    } else {
      found.set(keyOf(name), { name, count: 1 });
    }
  }

  return Array.from(found.values()).sort(
    (left, right) =>
      right.count - left.count ||
      left.name.localeCompare(right.name)
  );
}

/** Why this text cannot be submitted as an assignee, or null. */
export function assigneeProblem(
  value: string,
  current: string | null | undefined
): string | null {
  const text = value.trim();

  if (!text) {
    return "Enter a name to assign the case to.";
  }

  if (text.length > ASSIGNEE_MAX_LENGTH) {
    return `Use at most ${ASSIGNEE_MAX_LENGTH} characters.`;
  }

  if (sameAssignee(text, current)) {
    return "The case is already assigned to this person.";
  }

  return null;
}
