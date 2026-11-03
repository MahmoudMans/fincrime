"use client";

import {
  Activity,
  Search,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import type { TransactionView } from "@/lib/api";
import {
  formatCurrency,
  formatRelativeTime,
  formatTransactionTimestamp,
  humanize,
} from "@/lib/format";

export function TransactionLedger({
  transactions,
  initialQuery = "",
}: {
  transactions: TransactionView[];
  /** Pre-fills the search box, e.g. when arriving from the command palette. */
  initialQuery?: string;
}) {
  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState(initialQuery);

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("ALL");

  const [
    channelFilter,
    setChannelFilter,
  ] =
    useState("ALL");

  const statusOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            transactions.map(
              (transaction) =>
                transaction.status
            )
          )
        ).sort(),
      [transactions]
    );

  const channelOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            transactions.map(
              (transaction) =>
                transaction.channel
            )
          )
        ).sort(),
      [transactions]
    );

  const normalizedQuery =
    searchQuery
      .trim()
      .toLowerCase();

  const filteredTransactions =
    useMemo(
      () =>
        transactions.filter(
          (transaction) => {
            const searchableText =
              [
                transaction.reference,
                transaction.sourceCustomer,
                transaction.sourceAccount,
                transaction.destinationCustomer,
                transaction.destinationAccount,
              ]
                .join(" ")
                .toLowerCase();

            const matchesSearch =
              normalizedQuery.length ===
                0 ||
              searchableText.includes(
                normalizedQuery
              );

            const matchesStatus =
              statusFilter === "ALL" ||
              transaction.status ===
                statusFilter;

            const matchesChannel =
              channelFilter === "ALL" ||
              transaction.channel ===
                channelFilter;

            return (
              matchesSearch &&
              matchesStatus &&
              matchesChannel
            );
          }
        ),
      [
        transactions,
        normalizedQuery,
        statusFilter,
        channelFilter,
      ]
    );

  const hasActiveFilters =
    normalizedQuery.length > 0 ||
    statusFilter !== "ALL" ||
    channelFilter !== "ALL";

  const visibleCountLabel =
    hasActiveFilters
      ? `${filteredTransactions.length} of ${transactions.length} transactions`
      : `${transactions.length} transactions shown`;

  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("ALL");
    setChannelFilter("ALL");
  }

  return (
    <section className="panel transactions-panel transactions-ledger">
      <div className="panel-heading transactions-ledger-heading">
        <div>
          <div className="eyebrow">
            Transaction ledger
          </div>

          <h2>
            Recent transactions
          </h2>

          <p>
            Latest transfers across monitored
            accounts.
          </p>
        </div>

        <div
          className="live-label transactions-dataset-label"
          title="Synthetic demonstration dataset"
        >
          <Activity size={15} />
          Synthetic dataset
        </div>
      </div>

      <div
        className="transaction-ledger-toolbar"
        aria-label="Transaction filters"
      >
        <label className="transaction-ledger-search">
          <span className="transaction-ledger-visually-hidden">
            Search transactions
          </span>

          <Search
            size={15}
            aria-hidden="true"
          />

          <input
            type="search"
            value={searchQuery}
            placeholder="Search reference, account or customer..."
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
          />
        </label>

        <select
          className="transaction-ledger-filter"
          aria-label="Filter transactions by status"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
        >
          <option value="ALL">
            All statuses
          </option>

          {statusOptions.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {humanize(status)}
              </option>
            )
          )}
        </select>

        <select
          className="transaction-ledger-filter"
          aria-label="Filter transactions by channel"
          value={channelFilter}
          onChange={(event) =>
            setChannelFilter(
              event.target.value
            )
          }
        >
          <option value="ALL">
            All channels
          </option>

          {channelOptions.map(
            (channel) => (
              <option
                key={channel}
                value={channel}
              >
                {humanize(channel)}
              </option>
            )
          )}
        </select>

        <button
          type="button"
          className="transaction-ledger-reset"
          disabled={!hasActiveFilters}
          onClick={resetFilters}
        >
          Reset
        </button>
      </div>

      <div className="transaction-ledger-context">
        <span>
          {visibleCountLabel}
        </span>

        {hasActiveFilters && (
          <span className="transaction-ledger-filter-state">
            Filtered view
          </span>
        )}
      </div>

      <div className="table-scroll">
        <table className="transaction-ledger-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Channel</th>
              <th className="amount-heading">
                Amount
              </th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            {filteredTransactions.length ===
            0 ? (
              <tr>
                <td
                  className="transaction-ledger-empty"
                  colSpan={7}
                >
                  {transactions.length === 0
                    ? "No transactions are available."
                    : "No transactions match the current filters."}
                </td>
              </tr>
            ) : (
              filteredTransactions.map(
                (transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <span
                        className="transaction-reference transaction-reference-static"
                        title={`Transaction reference: ${transaction.reference}`}
                      >
                        {
                          transaction
                            .reference
                        }
                      </span>
                    </td>

                    <td>
                      <div className="party-cell">
                        <strong>
                          {
                            transaction
                              .sourceCustomer
                          }
                        </strong>

                        <span>
                          {
                            transaction
                              .sourceAccount
                          }
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="party-cell">
                        <strong>
                          {
                            transaction
                              .destinationCustomer
                          }
                        </strong>

                        <span>
                          {
                            transaction
                              .destinationAccount
                          }
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="channel-pill">
                        {humanize(
                          transaction.channel
                        )}
                      </span>
                    </td>

                    <td className="amount-cell">
                      {formatCurrency(
                        transaction.amount,
                        transaction.currency
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          `transaction-status status-${transaction.status.toLowerCase()}`
                        }
                      >
                        {humanize(
                          transaction.status
                        )}
                      </span>
                    </td>

                    <td className="time-cell transaction-time-cell">
                      <time
                        dateTime={
                          transaction
                            .occurredAt
                        }
                        title={
                          transaction
                            .occurredAt
                        }
                      >
                        <span className="transaction-time-exact">
                          {formatTransactionTimestamp(
                            transaction
                              .occurredAt
                          )}
                        </span>

                        <span className="transaction-time-relative">
                          {formatRelativeTime(
                            transaction
                              .occurredAt
                          )}
                        </span>
                      </time>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
