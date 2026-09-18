"use client";

import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CircleAlert,
  Search,
  ShieldAlert,
  UserRoundSearch,
  Wallet,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import {
  fetchAccount360,
  fetchAccounts,
  fetchCustomer360,
  fetchCustomers,
  fetchTransactionExplorer,
  type Account360,
  type AccountSummary,
  type Customer360,
  type CustomerSummary,
  type TransactionExplorerItem,
} from "@/lib/api";

type ExplorerTab =
  | "customers"
  | "accounts"
  | "transactions";

export function IntelligenceExplorer() {
  const [tab, setTab] =
    useState<ExplorerTab>("customers");

  return (
    <section className="panel intelligence-panel">
      <div className="panel-heading intelligence-heading">
        <div>
          <div className="eyebrow">
            Financial intelligence
          </div>

          <h2>Entity & transaction explorer</h2>

          <p>
            Investigate customers, accounts,
            counterparties and transaction risk
            from one workspace.
          </p>
        </div>

        <div className="intelligence-tabs">
          <button
            type="button"
            className={
              tab === "customers"
                ? "intelligence-tab active"
                : "intelligence-tab"
            }
            onClick={() =>
              setTab("customers")
            }
          >
            <UserRoundSearch size={14} />
            Customers
          </button>

          <button
            type="button"
            className={
              tab === "accounts"
                ? "intelligence-tab active"
                : "intelligence-tab"
            }
            onClick={() =>
              setTab("accounts")
            }
          >
            <Wallet size={14} />
            Accounts
          </button>

          <button
            type="button"
            className={
              tab === "transactions"
                ? "intelligence-tab active"
                : "intelligence-tab"
            }
            onClick={() =>
              setTab("transactions")
            }
          >
            <ArrowRightLeft size={14} />
            Transactions
          </button>
        </div>
      </div>

      {tab === "customers" && (
        <CustomerExplorer />
      )}

      {tab === "accounts" && (
        <AccountExplorer />
      )}

      {tab === "transactions" && (
        <TransactionExplorer />
      )}
    </section>
  );
}

function CustomerExplorer() {
  const [query, setQuery] =
    useState("");

  const [customers, setCustomers] =
    useState<CustomerSummary[]>([]);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [detail, setDetail] =
    useState<Customer360 | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const controller =
      new AbortController();

    const timer = window.setTimeout(
      () => {
        void fetchCustomers(
          query,
          controller.signal
        )
          .then((items) => {
            setCustomers(items);

            setSelectedId(
              (current) => {
                if (
                  current &&
                  items.some(
                    (item) =>
                      item.id === current
                  )
                ) {
                  return current;
                }

                return items[0]?.id ?? null;
              }
            );
          })
          .finally(
            () => setLoading(false)
          );
      },
      180
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const controller =
      new AbortController();

    void fetchCustomer360(
      selectedId,
      controller.signal
    )
      .then(setDetail)
      .catch(() => undefined);

    return () => controller.abort();
  }, [selectedId]);

  const visibleDetail =
    selectedId &&
    detail?.summary.id === selectedId
      ? detail
      : null;

  return (
    <div className="intelligence-layout">
      <aside className="entity-list-panel">
        <div className="entity-search">
          <Search size={14} />

          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="Search customers..."
          />
        </div>

        <div className="entity-list">
          {loading && (
            <div className="entity-empty">
              Loading customers...
            </div>
          )}

          {!loading &&
            customers.length === 0 && (
              <div className="entity-empty">
                No customers found.
              </div>
            )}

          {customers.map(
            (customer) => (
              <button
                type="button"
                key={customer.id}
                className={
                  selectedId === customer.id
                    ? "entity-row selected"
                    : "entity-row"
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
                    {" "}alerts
                  </small>
                </div>
              </button>
            )
          )}
        </div>
      </aside>

      <div className="entity-detail">
        {!visibleDetail ? (
          <ExplorerPlaceholder
            label="Select a customer"
          />
        ) : (
          <CustomerDetail
            detail={visibleDetail}
          />
        )}
      </div>
    </div>
  );
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
                    {" "}alerts
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
                    {" "}transactions
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
      />

      <AlertSnapshotList
        alerts={detail.alerts}
      />
    </div>
  );
}

function AccountExplorer() {
  const [query, setQuery] =
    useState("");

  const [accounts, setAccounts] =
    useState<AccountSummary[]>([]);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [detail, setDetail] =
    useState<Account360 | null>(null);

  useEffect(() => {
    const controller =
      new AbortController();

    const timer = window.setTimeout(
      () => {
        void fetchAccounts(
          query,
          controller.signal
        ).then(
          (items) => {
            setAccounts(items);

            setSelectedId(
              (current) => {
                if (
                  current &&
                  items.some(
                    (item) =>
                      item.id === current
                  )
                ) {
                  return current;
                }

                return items[0]?.id ?? null;
              }
            );
          }
        );
      },
      180
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const controller =
      new AbortController();

    void fetchAccount360(
      selectedId,
      controller.signal
    )
      .then(setDetail)
      .catch(() => undefined);

    return () => controller.abort();
  }, [selectedId]);

  const visibleDetail =
    selectedId &&
    detail?.summary.id === selectedId
      ? detail
      : null;

  return (
    <div className="intelligence-layout">
      <aside className="entity-list-panel">
        <div className="entity-search">
          <Search size={14} />

          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="Search accounts..."
          />
        </div>

        <div className="entity-list">
          {accounts.length === 0 && (
            <div className="entity-empty">
              No accounts found.
            </div>
          )}

          {accounts.map(
            (account) => (
              <button
                type="button"
                key={account.id}
                className={
                  selectedId === account.id
                    ? "entity-row selected"
                    : "entity-row"
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
                    {" "}alerts
                  </small>
                </div>
              </button>
            )
          )}
        </div>
      </aside>

      <div className="entity-detail">
        {!visibleDetail ? (
          <ExplorerPlaceholder
            label="Select an account"
          />
        ) : (
          <AccountDetail
            detail={visibleDetail}
          />
        )}
      </div>
    </div>
  );
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
                  {" "}transactions
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
      />

      <AlertSnapshotList
        alerts={detail.alerts}
      />
    </div>
  );
}

function TransactionExplorer() {
  const [query, setQuery] =
    useState("");

  const [channel, setChannel] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [minAmount, setMinAmount] =
    useState("");

  const [maxAmount, setMaxAmount] =
    useState("");

  const [transactions, setTransactions] =
    useState<
      TransactionExplorerItem[]
    >([]);

  useEffect(() => {
    const controller =
      new AbortController();

    const timer = window.setTimeout(
      () => {
        void fetchTransactionExplorer(
          {
            query,
            channel,
            status,
            minAmount,
            maxAmount,
          },
          controller.signal
        )
          .then(setTransactions)
          .catch(() => undefined);
      },
      180
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    query,
    channel,
    status,
    minAmount,
    maxAmount,
  ]);

  return (
    <div className="transaction-explorer">
      <div className="transaction-filters">
        <label className="filter-search">
          <Search size={14} />

          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="Reference, account, customer..."
          />
        </label>

        <select
          value={channel}
          onChange={(event) =>
            setChannel(
              event.target.value
            )
          }
        >
          <option value="">
            All channels
          </option>
          <option value="WIRE">
            Wire
          </option>
          <option value="BANK_TRANSFER">
            Bank transfer
          </option>
          <option value="CARD">
            Card
          </option>
          <option value="CASH_DEPOSIT">
            Cash deposit
          </option>
        </select>

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
        >
          <option value="">
            All statuses
          </option>
          <option value="SETTLED">
            Settled
          </option>
          <option value="REVIEW">
            Review
          </option>
          <option value="PENDING">
            Pending
          </option>
        </select>

        <input
          type="number"
          min="0"
          value={minAmount}
          onChange={(event) =>
            setMinAmount(
              event.target.value
            )
          }
          placeholder="Min amount"
        />

        <input
          type="number"
          min="0"
          value={maxAmount}
          onChange={(event) =>
            setMaxAmount(
              event.target.value
            )
          }
          placeholder="Max amount"
        />
      </div>

      <div className="transaction-result-count">
        <ArrowRightLeft size={13} />
        {transactions.length}
        {" "}matching transactions
      </div>

      <div className="table-scroll">
        <table className="intelligence-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Amount</th>
              <th>Channel</th>
              <th>Risk</th>
              <th>Why</th>
            </tr>
          </thead>

          <tbody>
            {transactions.map(
              (transaction) => (
                <tr key={transaction.id}>
                  <td>
                    <span className="transaction-reference">
                      {transaction.reference}
                    </span>

                    <small className="transaction-date">
                      {formatDateTime(
                        transaction.occurredAt
                      )}
                    </small>
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

                  <td className="amount-cell">
                    {money(
                      transaction.amount,
                      transaction.currency
                    )}
                  </td>

                  <td>
                    <span className="channel-pill">
                      {humanize(
                        transaction.channel
                      )}
                    </span>
                  </td>

                  <td>
                    <span
                      className={
                        transaction.riskScore >=
                        70
                          ? "risk-number high"
                          : transaction.riskScore >=
                              40
                            ? "risk-number medium"
                            : "risk-number low"
                      }
                    >
                      {
                        transaction
                          .riskScore
                      }
                    </span>
                  </td>

                  <td>
                    <div className="risk-reasons">
                      {transaction
                        .riskReasons
                        .slice(0, 2)
                        .map(
                          (reason) => (
                            <span
                              key={reason}
                            >
                              {reason}
                            </span>
                          )
                        )}

                      {transaction
                        .riskReasons
                        .length === 0 && (
                        <span>
                          Baseline activity
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompactTransactionList({
  transactions,
}: {
  transactions:
    TransactionExplorerItem[];
}) {
  return (
    <DetailBlock
      title="Recent transactions"
      count={transactions.length}
    >
      {transactions.map(
        (transaction) => (
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
                />
              ) : transaction.amount >=
                10000 ? (
                <ArrowUpRight
                  size={14}
                />
              ) : (
                <ArrowDownLeft
                  size={14}
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
        )
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
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="detail-block">
      <div className="detail-block-heading">
        <strong>{title}</strong>
        <span>{count}</span>
      </div>

      <div className="detail-block-body">
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
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }
  ).format(amount);
}

function humanize(
  value: string
) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(value)
  );
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}
