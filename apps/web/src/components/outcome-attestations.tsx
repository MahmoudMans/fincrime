"use client";

import {
  BadgeCheck,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  attestCaseOutcome,
  fetchCaseOutcomeAttestations,
  fetchCaseOutcomeAttestationVerifications,
  fetchGovernedCaseOutcomes,
  verifyCaseOutcomeAttestation,
  type CaseOutcomeAttestation,
  type CaseOutcomeAttestationVerification,
  type GovernedCaseOutcome,
} from "@/lib/api";

import {
  useAuth,
} from "./auth-context";

export function OutcomeAttestations() {
  const {
    hasAnyRole,
  } = useAuth();

  const canManage =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [outcomes, setOutcomes] =
    useState<
      GovernedCaseOutcome[]
    >([]);

  const [
    attestations,
    setAttestations,
  ] =
    useState<
      CaseOutcomeAttestation[]
    >([]);

  const [
    verifications,
    setVerifications,
  ] =
    useState<
      CaseOutcomeAttestationVerification[]
    >([]);

  const [action, setAction] =
    useState<string | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(
      null
    );

  async function reload() {
    const [
      loadedOutcomes,
      loadedAttestations,
      loadedVerifications,
    ] =
      await Promise.all([
        fetchGovernedCaseOutcomes(),
        fetchCaseOutcomeAttestations(),
        fetchCaseOutcomeAttestationVerifications(),
      ]);

    setOutcomes(
      loadedOutcomes
    );

    setAttestations(
      loadedAttestations
    );

    setVerifications(
      loadedVerifications
    );
  }

  useEffect(() => {
    const controller =
      new AbortController();

    void Promise.all([
      fetchGovernedCaseOutcomes(
        controller.signal
      ),
      fetchCaseOutcomeAttestations(
        controller.signal
      ),
      fetchCaseOutcomeAttestationVerifications(
        controller.signal
      ),
    ])
      .then(
        ([
          loadedOutcomes,
          loadedAttestations,
          loadedVerifications,
        ]) => {
          setOutcomes(
            loadedOutcomes
          );

          setAttestations(
            loadedAttestations
          );

          setVerifications(
            loadedVerifications
          );

          setError(
            null
          );
        }
      )
      .catch(
        (loadError: unknown) => {
          if (
            loadError instanceof DOMException &&
            loadError.name ===
              "AbortError"
          ) {
            return;
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load outcome integrity attestations."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

  const attestedExecutionIds =
    useMemo(
      () =>
        new Set(
          attestations.map(
            (item) =>
              item.executionId
          )
        ),
      [
        attestations,
      ]
    );

  const unattested =
    useMemo(
      () =>
        outcomes.filter(
          (item) =>
            !attestedExecutionIds.has(
              item.executionId
            )
        ),
      [
        outcomes,
        attestedExecutionIds,
      ]
    );

  const latestVerificationByAttestation =
    useMemo(
      () => {
        const values =
          new Map<
            string,
            CaseOutcomeAttestationVerification
          >();

        for (
          const verification
          of verifications
        ) {
          if (
            !values.has(
              verification.attestationId
            )
          ) {
            values.set(
              verification.attestationId,
              verification
            );
          }
        }

        return values;
      },
      [
        verifications,
      ]
    );

  async function attest(
    caseId: string
  ) {
    if (!canManage) {
      return;
    }

    try {
      setAction(
        `attest:${caseId}`
      );

      setError(
        null
      );

      await attestCaseOutcome(
        caseId
      );

      await reload();

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to attest governed outcome."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  async function verify(
    attestationId: string
  ) {
    if (!canManage) {
      return;
    }

    try {
      setAction(
        `verify:${attestationId}`
      );

      setError(
        null
      );

      await verifyCaseOutcomeAttestation(
        attestationId
      );

      await reload();

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to verify outcome attestation."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  return (
    <section className="panel outcome-attestation-panel">
      <div className="panel-heading outcome-attestation-heading">
        <div>
          <div className="eyebrow">
            Cryptographic provenance
          </div>

          <h2>
            Case outcome integrity attestations
          </h2>

          <p>
            Governed outcomes receive a
            SHA-256 provenance fingerprint
            covering their maker,
            independent checker, executor,
            decision and execution lineage.
          </p>
        </div>

        <div className="outcome-attestation-control">
          <Fingerprint
            size={13}
          />

          SHA-256 provenance
        </div>
      </div>

      {error && (
        <div className="outcome-attestation-error">
          {error}
        </div>
      )}

      <div className="outcome-attestation-metrics">
        <Metric
          label="Outcomes"
          value={
            outcomes.length
          }
        />

        <Metric
          label="Attested"
          value={
            attestations.length
          }
        />

        <Metric
          label="Verified"
          value={
            verifications.filter(
              (item) =>
                item.integrityValid
            ).length
          }
        />
      </div>

      <div className="outcome-attestation-grid">
        <div className="outcome-attestation-card">
          <div className="outcome-attestation-card-heading">
            <div>
              <Fingerprint
                size={14}
              />

              <strong>
                Awaiting attestation
              </strong>
            </div>

            <span>
              {
                unattested.length
              }
              {" outcomes"}
            </span>
          </div>

          {unattested.length ===
            0 && (
            <div className="outcome-attestation-empty">
              <BadgeCheck
                size={22}
              />

              <strong>
                All governed outcomes attested
              </strong>
            </div>
          )}

          {unattested.map(
            (outcome) => (
              <article
                key={
                  outcome.executionId
                }
                className="outcome-attestation-row"
              >
                <div>
                  <strong>
                    {
                      outcome.caseNumber
                    }
                  </strong>

                  <span>
                    {
                      humanize(
                        outcome.governedOutcome
                      )
                    }
                    {" · decision v"}
                    {
                      outcome.decisionVersion
                    }
                  </span>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    !canManage ||
                    action !== null
                  }
                  onClick={() =>
                    void attest(
                      outcome.caseId
                    )
                  }
                >
                  <Fingerprint
                    size={12}
                  />

                  {action ===
                  `attest:${outcome.caseId}`
                    ? "Attesting..."
                    : "Attest"}
                </button>
              </article>
            )
          )}
        </div>

        <div className="outcome-attestation-card">
          <div className="outcome-attestation-card-heading">
            <div>
              <ShieldCheck
                size={14}
              />

              <strong>
                Integrity registry
              </strong>
            </div>

            <span>
              {
                attestations.length
              }
              {" attestations"}
            </span>
          </div>

          {attestations.length ===
            0 && (
            <div className="outcome-attestation-empty">
              <Fingerprint
                size={22}
              />

              <strong>
                No attestation yet
              </strong>
            </div>
          )}

          {attestations.map(
            (attestation) => {
              const verification =
                latestVerificationByAttestation.get(
                  attestation.id
                );

              return (
                <article
                  key={
                    attestation.id
                  }
                  className="outcome-integrity-row"
                >
                  <div className="outcome-integrity-row-head">
                    <div>
                      <strong>
                        {
                          attestation.caseNumber
                        }
                        {" · v"}
                        {
                          attestation.decisionVersion
                        }
                      </strong>

                      <span>
                        {
                          humanize(
                            attestation.governedOutcome
                          )
                        }
                      </span>
                    </div>

                    <div
                      className={
                        verification?.integrityValid
                          ? "outcome-integrity-state valid"
                          : "outcome-integrity-state"
                      }
                    >
                      {verification?.integrityValid
                        ? "Verified"
                        : "Not verified"}
                    </div>
                  </div>

                  <div className="outcome-integrity-hash">
                    <span>
                      Provenance
                    </span>

                    <code>
                      {
                        attestation.provenanceHash
                      }
                    </code>
                  </div>

                  <div className="outcome-integrity-hash">
                    <span>
                      Audit anchor
                    </span>

                    <code>
                      {
                        attestation.auditRootHash
                      }
                    </code>
                  </div>

                  <div className="outcome-integrity-actions">
                    <span>
                      Attested by
                      {" "}
                      {
                        attestation.attestedBy
                      }
                    </span>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        !canManage ||
                        action !== null
                      }
                      onClick={() =>
                        void verify(
                          attestation.id
                        )
                      }
                    >
                      <ShieldCheck
                        size={12}
                      />

                      {action ===
                      `verify:${attestation.id}`
                        ? "Verifying..."
                        : "Verify"}
                    </button>
                  </div>

                  {verification && (
                    <div className="outcome-verification-detail">
                      {
                        verification.detail
                      }
                    </div>
                  )}
                </article>
              );
            }
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="outcome-attestation-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function humanize(
  value: string
) {
  return value
    .toLowerCase()
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}
