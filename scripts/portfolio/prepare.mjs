// Gets the demo data into a state that makes good pictures, through the same
// REST API the web app uses. Only adds what is missing and never deletes.
// Every step is optional: a failure is reported and the script carries on.

async function call(api, token, method, route, form) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form).toString();
  }
  const response = await fetch(api + route, { method, headers, body, signal: AbortSignal.timeout(90000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 120)}`);
  return text ? JSON.parse(text) : null;
}

const rows = (data) => (Array.isArray(data) ? data : data?.items ?? data?.content ?? []);

export async function login(api, user, password) {
  const result = await call(api, null, "POST", "/api/v1/auth/login", { username: user, password });
  return result.accessToken;
}

/** Brings the security audit ledger up to date, so its screen shows a valid chain. */
export async function refreshLedger(api, token) {
  await call(api, token, "POST", "/api/v1/security-ledger/refresh");
}

async function openDemoCase(api, token, say, user, write) {
  const cases = rows(await call(api, token, "GET", "/api/v1/cases"));
  if (cases.length) {
    const best = cases.reduce((a, b) => ((b.alertRiskScore ?? 0) > (a.alertRiskScore ?? 0) ? b : a));
    say("info", `Found ${cases.length} existing case(s), using ${best.caseNumber ?? best.id} for the case picture.`);
    return best.id;
  }
  if (!write) throw new Error("no case exists and adding data is turned off");

  const alerts = rows(await call(api, token, "GET", "/api/v1/alerts?size=100"));
  if (!alerts.length) throw new Error("there are no alerts to open a case from");
  const top = alerts.reduce((a, b) => ((b.riskScore ?? 0) > (a.riskScore ?? 0) ? b : a));
  const made = await call(api, token, "POST", `/api/v1/cases/from-alert/${top.id}`);
  const base = `/api/v1/case-workspace/${made.id}`;

  const extras = [
    () => call(api, token, "POST", `${base}/notes`, {
      author: "Portfolio capture",
      body: "Opened from the highest-risk alert. The flow looks circular: funds leave the first account and return through two intermediaries within a day.",
    }),
    () => call(api, token, "POST", `${base}/evidence/alerts/${top.id}`, { actor: user }),
    () => call(api, token, "POST", `${base}/evidence/graph/circular-flows`, { actor: user }),
    () => call(api, token, "POST", `${base}/assign`, { assignee: "senior@fincrime.local", actor: user }),
  ];
  for (const extra of extras) {
    try {
      await extra();
    } catch (error) {
      say("warn", `Case ${made.caseNumber ?? made.id}: one extra (note, evidence or owner) was skipped: ${error.message}`);
    }
  }
  say("ok", `Opened demo case ${made.caseNumber ?? made.id} from alert ${top.code ?? top.id}.`);
  return made.id;
}

/** Runs one optional step: skipped when `needed` says there is already data. */
async function step(say, label, needed, action) {
  if (!needed) return;
  try {
    if (!(await needed())) return say("info", `${label}: already there.`);
    await action();
    say("ok", `${label}: done.`);
  } catch (error) {
    say("warn", `${label}: skipped (${error.message}).`);
  }
}

/** A freshly started backend answers before its demo data is seeded. */
async function waitForSeed(get, say) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if (rows(await get("/api/v1/alerts?size=1")).length) return;
    } catch {
      // not ready yet
    }
    if (attempt === 0) say("info", "Waiting for the demo data to be seeded...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * Signs in through the API and returns what the pictures need (token, a case,
 * an alert code). With write = false it only reads and never adds data.
 */
export async function prepareData({ api, user, password, say, freshStart, write }) {
  const context = {};
  try {
    context.token = await login(api, user, password);
  } catch (error) {
    say("warn", `Could not sign in through the API as ${user} (${error.message}); skipping data preparation.`);
    return context;
  }
  const { token } = context;
  const get = (route) => call(api, token, "GET", route);
  const post = (route) => call(api, token, "POST", route);
  // Passing null as "needed" turns a step off when write is false.
  const empty = (route) => (write ? async () => rows(await get(route)).length === 0 : null);

  if (freshStart) await waitForSeed(get, say);

  await step(say, "AML detection run", empty("/api/v1/detection-runs"), () => post("/api/v1/detection-runs/run"));
  await step(say, "Watchlist screening run", empty("/api/v1/watchlist/runs"), () => post("/api/v1/watchlist/runs"));
  await step(say, "Customer risk assessments", empty("/api/v1/customer-risk/assessments"), () => post("/api/v1/customer-risk/recalculate"));

  try {
    context.caseId = await openDemoCase(api, token, say, user, write);
  } catch (error) {
    say("warn", `Demo case: skipped (${error.message}).`);
  }

  await step(say, "Triage scoring", empty("/api/v1/investigation-triage/runs"), () => post("/api/v1/investigation-triage/recalculate"));
  await step(say, "Compliance SLA clocks", empty("/api/v1/compliance/sla/cases"), () => post("/api/v1/compliance/sla/recalculate"));

  try {
    context.alertCode = rows(await get("/api/v1/alerts?size=1"))[0]?.code;
  } catch {
    // only used to make the command palette picture nicer
  }
  return context;
}
