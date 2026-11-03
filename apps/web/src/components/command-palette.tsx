"use client";

import {
  BriefcaseBusiness,
  CircleDollarSign,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from "react";

import type {
  AlertView,
  InvestigationCase,
  TransactionView,
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import {
  NAV_ITEMS,
  getNavGroup,
  type ViewId,
} from "@/lib/navigation";

interface PaletteEntry {
  id: string;
  kind: "Go to" | "Alert" | "Case" | "Transaction";
  title: string;
  detail: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  view: ViewId;
  param: string | null;
}

const MAX_PER_KIND = 5;

function matches(haystack: string[], needle: string) {
  const text = haystack.join(" ").toLowerCase();

  return needle
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

/**
 * Ctrl/Cmd+K quick finder: jump to any module, or find an alert, case
 * or recent transaction by code, reference, account or name.
 * Mount it only while open so its state resets every time.
 */
export function CommandPalette({
  onClose,
  onNavigate,
  alerts,
  cases,
  transactions,
}: {
  onClose: () => void;
  onNavigate: (view: ViewId, param?: string | null) => void;
  alerts: AlertView[];
  cases: InvestigationCase[];
  transactions: TransactionView[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const entries = useMemo<PaletteEntry[]>(() => {
    const needle = query.trim().toLowerCase();

    const views: PaletteEntry[] = NAV_ITEMS.filter(
      (item) =>
        needle === "" ||
        matches(
          [
            item.label,
            item.title,
            getNavGroup(item.group).label,
            ...item.keywords,
          ],
          needle
        )
    ).map((item) => ({
      id: `view:${item.id}`,
      kind: "Go to",
      title: item.label,
      detail: getNavGroup(item.group).label,
      icon: item.icon,
      view: item.id,
      param: null,
    }));

    if (needle.length < 2) {
      return views;
    }

    const alertEntries: PaletteEntry[] = alerts
      .filter((alert) =>
        matches(
          [
            alert.code,
            alert.title,
            alert.accountNumber ?? "",
            alert.transactionReference ?? "",
          ],
          needle
        )
      )
      .slice(0, MAX_PER_KIND)
      .map((alert) => ({
        id: `alert:${alert.id}`,
        kind: "Alert",
        title: alert.title,
        detail: `${alert.code} · ${alert.severity} · risk ${alert.riskScore}`,
        icon: ShieldAlert,
        view: "alerts",
        param: alert.code,
      }));

    const caseEntries: PaletteEntry[] = cases
      .filter((item) =>
        matches(
          [
            item.caseNumber,
            item.title,
            item.primaryAlertCode,
            item.assignedTo ?? "",
          ],
          needle
        )
      )
      .slice(0, MAX_PER_KIND)
      .map((item) => ({
        id: `case:${item.id}`,
        kind: "Case",
        title: item.title,
        detail: `${item.caseNumber} · ${item.status.replace("_", " ").toLowerCase()}`,
        icon: BriefcaseBusiness,
        view: "cases",
        param: item.id,
      }));

    const transactionEntries: PaletteEntry[] = transactions
      .filter((transaction) =>
        matches(
          [
            transaction.reference,
            transaction.sourceAccount,
            transaction.sourceCustomer,
            transaction.destinationAccount,
            transaction.destinationCustomer,
          ],
          needle
        )
      )
      .slice(0, MAX_PER_KIND)
      .map((transaction) => ({
        id: `transaction:${transaction.id}`,
        kind: "Transaction",
        title: transaction.reference,
        detail: `${transaction.sourceCustomer} → ${transaction.destinationCustomer} · ${formatCurrency(transaction.amount, transaction.currency)}`,
        icon: CircleDollarSign,
        view: "transactions",
        param: transaction.reference,
      }));

    return [
      ...alertEntries,
      ...caseEntries,
      ...transactionEntries,
      ...views,
    ];
  }, [query, alerts, cases, transactions]);

  const activeIndex = Math.min(
    active,
    Math.max(entries.length - 1, 0)
  );

  function choose(entry: PaletteEntry) {
    onNavigate(entry.view, entry.param);
    onClose();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLDivElement>
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % Math.max(entries.length, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(
        (activeIndex - 1 + Math.max(entries.length, 1)) %
          Math.max(entries.length, 1)
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const entry = entries[activeIndex];

      if (entry) {
        choose(entry);
      }
    }
  }

  return (
    <div
      className="ui-palette-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="ui-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search and jump to"
        onKeyDown={handleKeyDown}
      >
        <div className="ui-palette-input">
          <Search size={17} aria-hidden="true" />

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              entries[activeIndex]
                ? `${listId}-${activeIndex}`
                : undefined
            }
            aria-autocomplete="list"
            value={query}
            placeholder="Jump to a module, or find an alert, case or transaction..."
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
          />

          <kbd>Esc</kbd>
        </div>

        <ul
          className="ui-palette-list"
          id={listId}
          role="listbox"
          aria-label="Results"
        >
          {entries.length === 0 && (
            <li className="ui-palette-empty">
              Nothing matches &ldquo;{query}&rdquo;.
            </li>
          )}

          {entries.map((entry, index) => {
            const Icon = entry.icon;

            return (
              <li
                key={entry.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? "ui-palette-item active"
                    : "ui-palette-item"
                }
                onMouseMove={() => setActive(index)}
                onClick={() => choose(entry)}
              >
                <Icon size={16} aria-hidden="true" />

                <span className="ui-palette-copy">
                  <strong>{entry.title}</strong>
                  <small>{entry.detail}</small>
                </span>

                <span className="ui-palette-kind">
                  {entry.kind}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="ui-palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move
          </span>

          <span>
            <kbd>Enter</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}
