"use client";

import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CircleAlert,
  ShieldAlert,
  UserRoundSearch,
  Wallet,
} from "lucide-react";
import {
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";

import {
  AccountToolbar,
  CustomerToolbar,
  TransactionToolbar,
} from "@/components/gx-explorer-toolbars";
import { Pager } from "@/components/list-tools";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/state-card";
import {
  fetchAccount360,
  fetchAccounts,
  fetchCustomer360,
  fetchCustomers,
  fetchTransactionExplorer,
  type Account360,
  type Customer360,
  type TransactionExplorerItem,
} from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import {
  formatDate,
  formatDateTime,
  humanize,
} from "@/lib/format";
import {
  ACCOUNT_COLUMNS,
  ACCOUNT_DEFAULTS,
  ALL,
  CUSTOMER_COLUMNS,
  CUSTOMER_DEFAULTS,
  TRANSACTION_COLUMNS,
  TRANSACTION_DEFAULTS,
  amountRangeProblem,
  filterAccounts,
  filterCustomers,
  filterTransactions,
  filtersChanged,
  normalizeAccountFilters,
  normalizeCustomerFilters,
  normalizeTransactionFilters,
  riskBand,
  sortAccounts,
  sortCustomers,
  sortTransactions,
  transactionDirection,
  transactionServerQuery,
  type AccountFilters,
  type CustomerFilters,
  type TransactionFilters,
} from "@/lib/gx-explorer";
import { useSettled } from "@/lib/gx-use-settled";
import {
  clampPage,
  countBy,
  paginate,
  plural,
} from "@/lib/list-utils";
import { useLoad } from "@/lib/use-load";

type ExplorerTab =
  | "customers"
  | "accounts"
  | "transactions";

const TABS = [
  {
    id: "customers",
    label: "Customers",
    icon: UserRoundSearch,
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: Wallet,
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: ArrowRightLeft,
  },
] as const;

/** Rows per page: the narrow entity list and the wide table. */
const LIST_PAGE_SIZE = 15;
const TABLE_PAGE_SIZE = 25;

export function IntelligenceExplorer({
  initialTab = "customers",
  initialQuery = "",
}: {
  initialTab?: ExplorerTab;
  /** Pre-fills the transaction search, e.g. from the command palette. */
  initialQuery?: string;
}) {
  const [tab, setTab] =
    useState<ExplorerTab>(initialTab);

  const baseId = useId();

  return (
    <section className="panel intelligence-panel">
      <div className="panel-heading intelligence-heading">
        <div>
          <div className="eyebrow">
            Entity explorer
          </div>

          <h2>Entity & transaction explorer</h2>

          <p>
            Investigate customers, accounts,
            counterparties and transaction risk
            from one workspace.
          </p>
        </div>

        <div
          className="intelligence-tabs"
          role="tablist"
          aria-label="Explorer sections"
          onKeyDown={(event) => {
            const index = TABS.findIndex(
              (entry) => entry.id === tab
            );

            let next = index;

            if (event.key === "ArrowRight") {
              next = (index + 1) % TABS.length;
            } else if (event.key === "ArrowLeft") {
              next =
                (index + TABS.length - 1) %
                TABS.length;
            } else if (event.key === "Home") {
              next = 0;
            } else if (event.key === "End") {
              next = TABS.length - 1;
            } else {
              return;
            }

            event.preventDefault();
            setTab(TABS[next].id);

            document
              .getElementById(
                `${baseId}-tab-${TABS[next].id}`
              )
              ?.focus();
          }}
        >
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls={`${baseId}-panel`}
              tabIndex={tab === entry.id ? 0 : -1}
              className={
                tab === entry.id
                  ? "intelligence-tab active"
                  : "intelligence-tab"
              }
              onClick={() => setTab(entry.id)}
            >
              <entry.icon
                size={14}
                aria-hidden="true"
              />
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${tab}`}
      >
        {tab === "customers" && (
          <CustomerExplorer />
        )}

        {tab === "accounts" && (
          <AccountExplorer />
        )}

        {tab === "transactions" && (
          <TransactionExplorer
            initialQuery={initialQuery}
          />
        )}
      </div>
    </section>
  );
}

function CustomerExplorer() {
  const [filters, setFilters] =
    useState<CustomerFilters>(CUSTOMER_DEFAULTS);

  const [page, setPage] = useState(0);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  // The backend answers the text search; the box is applied after
  // a short pause so typing does not fire a request per keystroke.
  const [query, setQuery] = useSettled(filters.q);

  const fetchRows = useCallback(
    (signal: AbortSignal) =>
      fetchCustomers(query.trim(), signal),
    [query]
  );

  const load = useLoad(
    fetchRows,
    "Unable to load customers."
  );

  const rows = useMemo(
    () =>
      load.error === null ? (load.data ?? []) : [],
    [load.data, load.error]
  );

  const countries = useMemo(
    () => rows.map((row) => row.countryCode),
    [rows]
  );

  const riskFacet = useMemo(
    () =>
      filterCustomers(rows, {
        ...filters,
        risk: ALL,
      }),
    [rows, filters]
  );

  const riskCounts = useMemo(
    () =>
      countBy(riskFacet, (row) =>
        row.riskTier.toUpperCase()
      ),
    [riskFacet]
  );

  const visible = useMemo(
    () =>
      sortCustomers(
        filterCustomers(rows, filters),
        filters.sort
      ),
    [rows, filters]
  );

  const active =
    visible.find((row) => row.id === selectedId) ??
    visible[0] ??
    null;

  const safePage = clampPage(
    page,
    visible.length,
    LIST_PAGE_SIZE
  );

  const pageRows = paginate(
    visible,
    safePage,
    LIST_PAGE_SIZE
  );

  const hasFilters = filtersChanged(
    filters,
    CUSTOMER_DEFAULTS
  );

  function update(patch: Partial<CustomerFilters>) {
    setFilters((current) => ({
      ...current,
      ...patch,
    }));
    setPage(0);
  }

  function reset() {
    setFilters(CUSTOMER_DEFAULTS);
    setQuery("");
    setPage(0);
  }

  function applyView(value: CustomerFilters) {
    const next = normalizeCustomerFilters(value);

    setFilters(next);
    setQuery(next.q);
    setPage(0);
  }

  return (
    <>
      <CustomerToolbar
        filters={filters}
        onChange={update}
        onReset={reset}
        onApplyView={applyView}
        onExport={() =>
          exportRowsAsCsv(
            "Customers",
            visible,
            CUSTOMER_COLUMNS
          )
        }
        summary={{
          shown: visible.length,
          total: rows.length,
          hasFilters,
          pending: load.data === null,
        }}
        riskCounts={riskCounts}
        riskTotal={riskFacet.length}
        countries={countries}
      />

      <div
        className="intelligence-layout"
        aria-busy={load.loading}
      >
        <aside
          className="entity-list-panel"
          aria-label="Customers"
        >
          <div
            className={
              load.loading && rows.length > 0
                ? "entity-list ui-list-loading"
                : "entity-list"
            }
          >
            {load.error !== null && (
              <ErrorState
                compact
                title="Unable to load customers"
                message={load.error}
                onRetry={load.reload}
              />
            )}

            {load.error === null &&
              load.data === null && (
                <LoadingState
                  compact
                  label="Loading customers"
                />
              )}

            {load.error === null &&
              load.data !== null &&
              visible.length === 0 && (
                <EmptyState
                  compact
                  title={
                    hasFilters
                      ? "No customers match these filters"
                      : "No customers yet"
                  }
                  message={
                    hasFilters
                      ? "Try a different search or clear the filters."
                      : "Customers appear here once data has been ingested."
                  }
                  action={
                    hasFilters ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={reset}
                      >
                        Reset filters
                      </button>
                    ) : undefined
                  }
                />
              )}

            {pageRows.map((customer) => (
              <button
                type="button"
                key={customer.id}
                className={
                  active?.id === customer.id
                    ? "entity-row selected"
                    : "entity-row"
                }
                aria-current={
                  active?.id === customer.id
                    ? "true"
                    : undefined
                }
                onClick={() =>
                  setSelectedId(customer.id)
                }
              >
                <div>
                  <strong>
                    {customer.fullName}
                  </strong>

                  <span>
                    {customer.externalId}
                    {" · "}
                    {customer.countryCode}
                  </span>
                </div>

                <div className="entity-row-right">
                  <span
                    className={
                      `risk-badge risk-${customer.riskTier.toLowerCase()}`
                    }
                  >
                    {customer.riskTier}
                  </span>

                  <small>
                    {customer.openAlerts}
                    {" "}
                    {plural(
                      customer.openAlerts,
                      "alert"
                    )}
                  </small>
                </div>
              </button>
            ))}
          </div>

          <Pager
            page={safePage}
            pageSize={LIST_PAGE_SIZE}
            total={visible.length}
            onPage={setPage}
            label="Customer pages"
          />
        </aside>

        <div className="entity-detail">
          {active ? (
            <CustomerDetailPane
              key={active.id}
              id={active.id}
            />
          ) : (
            <ExplorerPlaceholder
              label={
                load.data === null
                  ? "Select a customer"
                  : "No customer selected"
              }
            />
          )}
        </div>
      </div>
    </>
  );
}

/** Loads one customer profile; keyed by id so that it never shows another one. */
function CustomerDetailPane({
  id,
}: {
  id: string;
}) {
  const fetchDetail = useCallback(
    (signal: AbortSignal) =>
      fetchCustomer360(id, signal),
    [id]
  );

  const { data, error, reload } = useLoad(
    fetchDetail,
    "Unable to load the customer profile."
  );

  if (error !== null) {
    return (
      <ErrorState
        compact
        title="Unable to load this customer"
        message={error}
        onRetry={reload}
      />
    );
  }

  if (!data) {
    return (
      <LoadingState
        compact
        label="Loading customer"
      />
    );
  }

  return <CustomerDetail detail={data} />;
}

function CustomerDetail({
  detail,
}: {
  detail: Customer360;
}) {
  const summary = detail.summary;

  return (
    <div>
      <div className="entity-detail-header">
        <div>
          <div className="eyebrow">
            Customer 360
          </div>

          <h3>{summary.fullName}</h3>

          <p>
            {summary.externalId}
            {" · "}
            {summary.countryCode}
            {" · "}
            onboarded{" "}
            {formatDate(summary.createdAt)}
          </p>
        </div>

        <span
          className={
            `risk-badge risk-${summary.riskTier.toLowerCase()}`
          }
        >
          {summary.riskTier} RISK
        </span>
      </div>

      <div className="detail-metrics">
        <DetailMetric
          label="Accounts"
          value={summary.accountCount}
        />

        <DetailMetric
          label="Transactions"
          value={summary.transactionCount}
        />

        <DetailMetric
          label="Open alerts"
          value={summary.openAlerts}
        />

        <DetailMetric
          label="Inbound"
          value={money(
            summary.totalInbound,
            "EUR"
          )}
        />

        <DetailMetric
          label="Outbound"
          value={money(
            summary.totalOutbound,
            "EUR"
          )}
        />
      </div>

      <div className="detail-grid">
        <DetailBlock
          title="Accounts"
          count={detail.accounts.length}
          empty="No accounts yet."
        >
          {detail.accounts.map(
            (account) => (
              <div
                className="detail-list-row"
                key={account.id}
              >
                <div>
                  <strong>
                    {account.accountNumber}
                  </strong>

                  <span>
                    {humanize(
                      account.accountType
                    )}
                    {" · "}
                    {account.currency}
                  </span>
                </div>

                <div className="detail-list-right">
                  <strong>
                    {money(
                      account.balance,
                      account.currency
                    )}
                  </strong>

                  <span>
                    {account.openAlerts}
                    {" "}
                    {plural(
                      account.openAlerts,
                      "alert"
                    )}
                  </span>
                </div>
              </div>
            )
          )}
        </DetailBlock>

        <DetailBlock
          title="Top counterparties"
          count={
            detail.counterparties.length
          }
          empty="No counterparties yet."
        >
          {detail.counterparties.map(
            (counterparty) => (
              <div
                className="detail-list-row"
                key={
                  counterparty.customerId
                }
              >
                <div>
                  <strong>
                    {
                      counterparty.fullName
                    }
                  </strong>

                  <span>
                    {
                      counterparty.countryCode
                    }
                    {" · "}
                    {
                      counterparty
                        .transactionCount
                    }
                    {" "}
                    {plural(
                      counterparty
                        .transactionCount,
                      "transaction"
                    )}
                  </span>
                </div>

                <div className="detail-list-right">
                  <strong>
                    {money(
                      counterparty.volume,
                      "EUR"
                    )}
                  </strong>

                  <span
                    className={
                      `risk-text risk-${counterparty.riskTier.toLowerCase()}`
                    }
                  >
                    {counterparty.riskTier}
                  </span>
                </div>
              </div>
            )
          )}
        </DetailBlock>
      </div>

      <CompactTransactionList
        transactions={
          detail.recentTransactions
        }
        ownAccountIds={
          new Set(
            detail.accounts.map(
              (account) => account.id
            )
          )
        }
      />

      <AlertSnapshotList
        alerts={detail.alerts}
      />
    </div>
  );
}

function AccountExplorer() {
  const [filters, setFilters] =
    useState<AccountFilters>(ACCOUNT_DEFAULTS);

  const [page, setPage] = useState(0);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [query, setQuery] = useSettled(filters.q);

  const fetchRows = useCallback(
    (signal: AbortSignal) =>
      fetchAccounts(query.trim(), signal),
    [query]
  );

  const load = useLoad(
    fetchRows,
    "Unable to load accounts."
  );

  const rows = useMemo(
    () =>
      load.error === null ? (load.data ?? []) : [],
    [load.data, load.error]
  );

  const currencies = useMemo(
    () => rows.map((row) => row.currency),
    [rows]
  );

  const statusFacet = useMemo(
    () =>
      filterAccounts(rows, {
        ...filters,
        status: ALL,
      }),
    [rows, filters]
  );

  const statusCounts = useMemo(
    () =>
      countBy(statusFacet, (row) =>
        row.status.toUpperCase()
      ),
    [statusFacet]
  );

  const riskFacet = useMemo(
    () =>
      filterAccounts(rows, {
        ...filters,
        risk: ALL,
      }),
    [rows, filters]
  );

  const riskCounts = useMemo(
    () =>
      countBy(riskFacet, (row) =>
        row.customerRiskTier.toUpperCase()
      ),
    [riskFacet]
  );

  const visible = useMemo(
    () =>
      sortAccounts(
        filterAccounts(rows, filters),
        filters.sort
      ),
    [rows, filters]
  );

  const active =
    visible.find((row) => row.id === selectedId) ??
    visible[0] ??
    null;

  const safePage = clampPage(
    page,
    visible.length,
    LIST_PAGE_SIZE
  );

  const pageRows = paginate(
    visible,
    safePage,
    LIST_PAGE_SIZE
  );

  const hasFilters = filtersChanged(
    filters,
    ACCOUNT_DEFAULTS
  );

  function update(patch: Partial<AccountFilters>) {
    setFilters((current) => ({
      ...current,
      ...patch,
    }));
    setPage(0);
  }

  function reset() {
    setFilters(ACCOUNT_DEFAULTS);
    setQuery("");
    setPage(0);
  }

  function applyView(value: AccountFilters) {
    const next = normalizeAccountFilters(value);

    setFilters(next);
    setQuery(next.q);
    setPage(0);
  }

  return (
    <>
      <AccountToolbar
        filters={filters}
        onChange={update}
        onReset={reset}
        onApplyView={applyView}
        onExport={() =>
          exportRowsAsCsv(
            "Accounts",
            visible,
            ACCOUNT_COLUMNS
          )
        }
        summary={{
          shown: visible.length,
          total: rows.length,
          hasFilters,
          pending: load.data === null,
        }}
        riskCounts={riskCounts}
        riskTotal={riskFacet.length}
        statusCounts={statusCounts}
        statusTotal={statusFacet.length}
        currencies={currencies}
      />

      <div
        className="intelligence-layout"
        aria-busy={load.loading}
      >
        <aside
          className="entity-list-panel"
          aria-label="Accounts"
        >
          <div
            className={
              load.loading && rows.length > 0
                ? "entity-list ui-list-loading"
                : "entity-list"
            }
          >
            {load.error !== null && (
              <ErrorState
                compact
                title="Unable to load accounts"
                message={load.error}
                onRetry={load.reload}
              />
            )}

            {load.error === null &&
              load.data === null && (
                <LoadingState
                  compact
                  label="Loading accounts"
                />
              )}

            {load.error === null &&
              load.data !== null &&
              visible.length === 0 && (
                <EmptyState
                  compact
                  title={
                    hasFilters
                      ? "No accounts match these filters"
                      : "No accounts yet"
                  }
                  message={
                    hasFilters
                      ? "Try a different search or clear the filters."
                      : "Accounts appear here once data has been ingested."
                  }
                  action={
                    hasFilters ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={reset}
                      >
                        Reset filters
                      </button>
                    ) : undefined
                  }
                />
              )}

            {pageRows.map((account) => (
              <button
                type="button"
                key={account.id}
                className={
                  active?.id === account.id
                    ? "entity-row selected"
                    : "entity-row"
                }
                aria-current={
                  active?.id === account.id
                    ? "true"
                    : undefined
                }
                onClick={() =>
                  setSelectedId(account.id)
                }
              >
                <div>
                  <strong>
                    {account.accountNumber}
                  </strong>

                  <span>
                    {account.customerName}
                    {" · "}
                    {account.currency}
                    {" · "}
                    {humanize(account.status)}
                  </span>
                </div>

                <div className="entity-row-right">
                  <span
                    className={
                      `risk-badge risk-${account.customerRiskTier.toLowerCase()}`
                    }
                  >
                    {
                      account
                        .customerRiskTier
                    }
                  </span>

                  <small>
                    {account.openAlerts}
                    {" "}
                    {plural(
                      account.openAlerts,
                      "alert"
                    )}
                  </small>
                </div>
              </button>
            ))}
          </div>

          <Pager
            page={safePage}
            pageSize={LIST_PAGE_SIZE}
            total={visible.length}
            onPage={setPage}
            label="Account pages"
          />
        </aside>

        <div className="entity-detail">
          {active ? (
            <AccountDetailPane
              key={active.id}
              id={active.id}
            />
          ) : (
            <ExplorerPlaceholder
              label={
                load.data === null
                  ? "Select an account"
                  : "No account selected"
              }
            />
          )}
        </div>
      </div>
    </>
  );
}

/** Loads one account profile; keyed by id so that it never shows another one. */
function AccountDetailPane({
  id,
}: {
  id: string;
}) {
  const fetchDetail = useCallback(
    (signal: AbortSignal) =>
      fetchAccount360(id, signal),
    [id]
  );

  const { data, error, reload } = useLoad(
    fetchDetail,
    "Unable to load the account profile."
  );

  if (error !== null) {
    return (
      <ErrorState
        compact
        title="Unable to load this account"
        message={error}
        onRetry={reload}
      />
    );
  }

  if (!data) {
    return (
      <LoadingState
        compact
        label="Loading account"
      />
    );
  }

  return <AccountDetail detail={data} />;
}

function AccountDetail({
  detail,
}: {
  detail: Account360;
}) {
  const summary = detail.summary;

  return (
    <div>
      <div className="entity-detail-header">
        <div>
          <div className="eyebrow">
            Account 360
          </div>

          <h3>
            {summary.accountNumber}
          </h3>

          <p>
            Owned by{" "}
            {detail.owner.fullName}
            {" · "}
            {humanize(
              summary.accountType
            )}
            {" · "}
            {summary.currency}
          </p>
        </div>

        <span
          className={
            `account-state account-state-${summary.status.toLowerCase()}`
          }
        >
          {summary.status}
        </span>
      </div>

      <div className="detail-metrics">
        <DetailMetric
          label="Balance"
          value={money(
            summary.balance,
            summary.currency
          )}
        />

        <DetailMetric
          label="Transactions"
          value={
            summary.transactionCount
          }
        />

        <DetailMetric
          label="Open alerts"
          value={summary.openAlerts}
        />

        <DetailMetric
          label="Inbound"
          value={money(
            summary.totalInbound,
            summary.currency
          )}
        />

        <DetailMetric
          label="Outbound"
          value={money(
            summary.totalOutbound,
            summary.currency
          )}
        />
      </div>

      <div className="owner-strip">
        <div>
          <span>Customer owner</span>
          <strong>
            {detail.owner.fullName}
          </strong>
        </div>

        <div>
          <span>Customer ID</span>
          <strong>
            {detail.owner.externalId}
          </strong>
        </div>

        <div>
          <span>Jurisdiction</span>
          <strong>
            {detail.owner.countryCode}
          </strong>
        </div>

        <div>
          <span>Customer risk</span>
          <strong
            className={
              `risk-text risk-${detail.owner.riskTier.toLowerCase()}`
            }
          >
            {detail.owner.riskTier}
          </strong>
        </div>
      </div>

      <DetailBlock
        title="Counterparties"
        count={
          detail.counterparties.length
        }
        empty="No counterparties yet."
      >
        {detail.counterparties.map(
          (counterparty) => (
            <div
              className="detail-list-row"
              key={
                counterparty.customerId
              }
            >
              <div>
                <strong>
                  {
                    counterparty.fullName
                  }
                </strong>

                <span>
                  {
                    counterparty.countryCode
                  }
                  {" · "}
                  {
                    counterparty
                      .transactionCount
                  }
                  {" "}
                  {plural(
                    counterparty
                      .transactionCount,
                    "transaction"
                  )}
                </span>
              </div>

              <div className="detail-list-right">
                <strong>
                  {money(
                    counterparty.volume,
                    summary.currency
                  )}
                </strong>

                <span
                  className={
                    `risk-text risk-${counterparty.riskTier.toLowerCase()}`
                  }
                >
                  {counterparty.riskTier}
                </span>
              </div>
            </div>
          )
        )}
      </DetailBlock>

      <CompactTransactionList
        transactions={
          detail.recentTransactions
        }
        ownAccountIds={
          new Set([summary.id])
        }
      />

      <AlertSnapshotList
        alerts={detail.alerts}
      />
    </div>
  );
}

function TransactionExplorer({
  initialQuery = "",
}: {
  initialQuery?: string;
}) {
  const [filters, setFilters] =
    useState<TransactionFilters>({
      ...TRANSACTION_DEFAULTS,
      q: initialQuery,
    });

  const [page, setPage] = useState(0);

  // The backend answers the text search, channel, status and amount
  // range. The typed fields are applied after a short pause.
  const [query, setQuery] = useSettled(filters.q);
  const [min, setMin] = useSettled(filters.min);
  const [max, setMax] = useSettled(filters.max);

  const { channel, status } = filters;

  const fetchRows = useCallback(
    (signal: AbortSignal) =>
      fetchTransactionExplorer(
        transactionServerQuery({
          q: query,
          channel,
          status,
          min,
          max,
        }),
        signal
      ),
    [query, channel, status, min, max]
  );

  const load = useLoad(
    fetchRows,
    "Unable to load transactions."
  );

  const rows = useMemo(
    () =>
      load.error === null ? (load.data ?? []) : [],
    [load.data, load.error]
  );

  const countries = useMemo(
    () =>
      rows.map(
        (transaction) =>
          transaction.destinationCountry
      ),
    [rows]
  );

  const riskFacet = useMemo(
    () =>
      filterTransactions(rows, {
        ...filters,
        risk: ALL,
      }),
    [rows, filters]
  );

  const riskCounts = useMemo(
    () =>
      countBy(riskFacet, (transaction) =>
        riskBand(transaction.riskScore)
      ),
    [riskFacet]
  );

  const visible = useMemo(
    () =>
      sortTransactions(
        filterTransactions(rows, filters),
        filters.sort
      ),
    [rows, filters]
  );

  const safePage = clampPage(
    page,
    visible.length,
    TABLE_PAGE_SIZE
  );

  const pageRows = paginate(
    visible,
    safePage,
    TABLE_PAGE_SIZE
  );

  const hasFilters = filtersChanged(
    filters,
    TRANSACTION_DEFAULTS
  );

  const rangeProblem = amountRangeProblem(
    filters.min,
    filters.max
  );

  function update(
    patch: Partial<TransactionFilters>
  ) {
    setFilters((current) => ({
      ...current,
      ...patch,
    }));
    setPage(0);
  }

  function reset() {
    setFilters(TRANSACTION_DEFAULTS);
    setQuery("");
    setMin("");
    setMax("");
    setPage(0);
  }

  function applyView(value: TransactionFilters) {
    const next =
      normalizeTransactionFilters(value);

    setFilters(next);
    setQuery(next.q);
    setMin(next.min);
    setMax(next.max);
    setPage(0);
  }

  return (
    <div className="transaction-explorer ui-gx-transactions">
      <TransactionToolbar
        filters={filters}
        onChange={update}
        onReset={reset}
        onApplyView={applyView}
        onExport={() =>
          exportRowsAsCsv(
            "Transactions",
            visible,
            TRANSACTION_COLUMNS
          )
        }
        summary={{
          shown: visible.length,
          total: rows.length,
          hasFilters,
          pending: load.data === null,
        }}
        riskCounts={riskCounts}
        riskTotal={riskFacet.length}
        countries={countries}
      />

      {load.error !== null && (
        <ErrorState
          compact
          title="Unable to load transactions"
          message={load.error}
          onRetry={load.reload}
        />
      )}

      {load.error === null &&
        load.data === null && (
          <LoadingState
            compact
            label="Loading transactions"
          />
        )}

      {load.error === null &&
        load.data !== null &&
        visible.length === 0 && (
          <EmptyState
            compact
            title={
              hasFilters
                ? "No transactions match these filters"
                : "No transactions yet"
            }
            message={
              rangeProblem ??
              (hasFilters
                ? "Try a different search or clear the filters."
                : "Transactions appear here once data has been ingested.")
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={reset}
                >
                  Reset filters
                </button>
              ) : undefined
            }
          />
        )}

      {load.error === null &&
        visible.length > 0 && (
          <div
            className={
              load.loading
                ? "table-scroll ui-list-loading"
                : "table-scroll"
            }
            aria-busy={load.loading}
          >
            <table className="intelligence-table">
              <caption className="ui-visually-hidden">
                Transactions matching the current
                filters
              </caption>

              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Source</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Status</th>
                  <th scope="col">Risk</th>
                  <th scope="col">Why</th>
                </tr>
              </thead>

              <tbody>
                {pageRows.map(
                  (transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                    />
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

      <Pager
        page={safePage}
        pageSize={TABLE_PAGE_SIZE}
        total={visible.length}
        onPage={setPage}
        label="Transaction pages"
      />
    </div>
  );
}

function TransactionRow({
  transaction,
}: {
  transaction: TransactionExplorerItem;
}) {
  const band = riskBand(transaction.riskScore);

  return (
    <tr>
      <td>
        <span className="transaction-reference">
          {transaction.reference}
        </span>

        <small className="transaction-date">
          {formatDateTime(transaction.occurredAt)}
        </small>
      </td>

      <td>
        <div className="party-cell">
          <strong>
            {transaction.sourceCustomer}
          </strong>

          <span>
            {transaction.sourceAccount}
          </span>
        </div>
      </td>

      <td>
        <div className="party-cell">
          <strong>
            {transaction.destinationCustomer}
          </strong>

          <span>
            {transaction.destinationAccount}
            {transaction.destinationCountry
              ? ` · ${transaction.destinationCountry}`
              : ""}
          </span>
        </div>
      </td>

      <td className="amount-cell">
        {money(
          transaction.amount,
          transaction.currency
        )}
      </td>

      <td>
        <span className="channel-pill">
          {humanize(transaction.channel)}
        </span>
      </td>

      <td>
        <span className="channel-pill">
          {humanize(transaction.status)}
        </span>
      </td>

      <td>
        <span
          className={
            band === "HIGH"
              ? "risk-number high"
              : band === "MEDIUM"
                ? "risk-number medium"
                : "risk-number low"
          }
        >
          {transaction.riskScore}

          <span className="ui-visually-hidden">
            {` (${humanize(band)} risk)`}
          </span>
        </span>
      </td>

      <td>
        <div className="risk-reasons">
          {transaction.riskReasons
            .slice(0, 2)
            .map((reason) => (
              <span key={reason}>{reason}</span>
            ))}

          {transaction.riskReasons.length > 2 && (
            <span
              title={transaction.riskReasons
                .slice(2)
                .join("; ")}
            >
              {`+${transaction.riskReasons.length - 2} more`}
            </span>
          )}

          {transaction.riskReasons.length === 0 && (
            <span>Baseline activity</span>
          )}
        </div>
      </td>
    </tr>
  );
}

const DIRECTION_LABELS = {
  OUT: "Outgoing",
  IN: "Incoming",
  INTERNAL: "Between own accounts",
  UNKNOWN: "",
} as const;

function CompactTransactionList({
  transactions,
  ownAccountIds,
}: {
  transactions:
    TransactionExplorerItem[];
  /** Accounts of the entity on screen, to tell incoming from outgoing. */
  ownAccountIds: ReadonlySet<string>;
}) {
  return (
    <DetailBlock
      title="Recent transactions"
      count={transactions.length}
      empty="No transactions yet."
    >
      {transactions.map(
        (transaction) => {
          const direction =
            transactionDirection(
              transaction,
              ownAccountIds
            );

          return (
            <div
              className="detail-list-row"
              key={transaction.id}
            >
              <div className="transaction-direction">
                {transaction.riskScore >=
                70 ? (
                  <CircleAlert
                    size={14}
                    className="risk-icon"
                    aria-hidden="true"
                  />
                ) : direction === "OUT" ? (
                  <ArrowUpRight
                    size={14}
                    aria-hidden="true"
                  />
                ) : direction === "IN" ? (
                  <ArrowDownLeft
                    size={14}
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowRightLeft
                    size={14}
                    aria-hidden="true"
                  />
                )}

                <div>
                  <strong>
                    {
                      transaction.reference
                    }
                  </strong>

                  <span>
                    {
                      transaction
                        .sourceCustomer
                    }
                    {" → "}
                    {
                      transaction
                        .destinationCustomer
                    }
                    {DIRECTION_LABELS[
                      direction
                    ] &&
                      ` · ${DIRECTION_LABELS[direction]}`}
                  </span>
                </div>
              </div>

              <div className="detail-list-right">
                <strong>
                  {money(
                    transaction.amount,
                    transaction.currency
                  )}
                </strong>

                <span>
                  Risk{" "}
                  {
                    transaction
                      .riskScore
                  }
                </span>
              </div>
            </div>
          );
        }
      )}
    </DetailBlock>
  );
}

function AlertSnapshotList({
  alerts,
}: {
  alerts: {
    id: string;
    code: string;
    severity: string;
    riskScore: number;
    title: string;
    status: string;
  }[];
}) {
  return (
    <DetailBlock
      title="Alert history"
      count={alerts.length}
    >
      {alerts.length === 0 && (
        <div className="detail-empty">
          No alerts linked to this entity.
        </div>
      )}

      {alerts.map((alert) => (
        <div
          className="detail-list-row"
          key={alert.id}
        >
          <div className="transaction-direction">
            <ShieldAlert size={14} />

            <div>
              <strong>
                {alert.title}
              </strong>

              <span>
                {alert.code}
                {" · "}
                {humanize(
                  alert.status
                )}
              </span>
            </div>
          </div>

          <div className="detail-list-right">
            <strong>
              {alert.riskScore}
            </strong>

            <span>
              {alert.severity}
            </span>
          </div>
        </div>
      ))}
    </DetailBlock>
  );
}

function DetailBlock({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  /** Shown instead of the rows when there are none. */
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="detail-block">
      <div className="detail-block-heading">
        <strong>{title}</strong>
        <span>{count}</span>
      </div>

      <div className="detail-block-body">
        {count === 0 && empty && (
          <div className="detail-empty">
            {empty}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}

function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="detail-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ExplorerPlaceholder({
  label,
}: {
  label: string;
}) {
  return (
    <div className="explorer-placeholder">
      <UserRoundSearch size={28} />
      <strong>{label}</strong>
      <span>
        Select an entity from the
        intelligence index.
      </span>
    </div>
  );
}

function money(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(
      "en-GB",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }
    ).format(amount);
  } catch {
    // An unknown currency code must not take the whole view down.
    return `${amount.toLocaleString("en-GB")} ${currency}`.trim();
  }
}
