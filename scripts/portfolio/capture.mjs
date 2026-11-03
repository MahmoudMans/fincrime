#!/usr/bin/env node
// Takes pictures of the running FinCrime Graph app and builds the portfolio/
// folder: screenshots, a description for each, and the project details.
//
//   cd scripts/portfolio && npm install && npx playwright install chromium
//   node capture.mjs            (node capture.mjs --help for options)
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { SHOTS } from "./content.mjs";
import { baseName, inventory, writeDocs } from "./docs.mjs";
import { collectFacts } from "./facts.mjs";
import { prepareData, refreshLedger } from "./prepare.mjs";
import { ensureServices, isUp } from "./services.mjs";

const HELP = `Takes screenshots of FinCrime Graph and writes the portfolio/ folder.

  node capture.mjs [options]

  --only a,b        take only these pictures (ids, e.g. network,alerts)
  --skip-mobile     skip the phone pictures
  --no-start        do not start the app, it must already be running
  --no-prepare      do not add demo data (detection run, a case...) first, only read
  --keep-running    leave anything this script started running afterwards
  --full            tall pictures: the whole scrolling page, not one screen
  --headed          show the browser while it works
  --scale N         pixel density, 1 to 3 (default 2)
  --web URL         web app address (default http://localhost:3000)
  --api URL         backend address (default http://localhost:8080)
  --user EMAIL      account to sign in with (default admin@fincrime.local)
  --password TEXT   its password (default: FINCRIME_ADMIN_PASSWORD or the demo one)
  --out DIR         output folder (default <project>/portfolio)
  --list            list the picture ids and exit
  --help            this text`;

const OPTIONS = {
  only: { type: "string" },
  "skip-mobile": { type: "boolean" },
  "no-start": { type: "boolean" },
  "no-prepare": { type: "boolean" },
  "keep-running": { type: "boolean" },
  full: { type: "boolean" },
  headed: { type: "boolean" },
  scale: { type: "string" },
  web: { type: "string" },
  api: { type: "string" },
  user: { type: "string" },
  password: { type: "string" },
  out: { type: "string" },
  list: { type: "boolean" },
  help: { type: "boolean" },
};

class Fatal extends Error {}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

let opt;
try {
  opt = parseArgs({ options: OPTIONS }).values;
} catch (error) {
  console.error(`${error.message}\n\n${HELP}`);
  process.exit(2);
}

const outDir = path.resolve(opt.out ?? path.join(root, "portfolio"));
const logDir = path.join(outDir, ".logs");
const trim = (url) => url.replace(/\/+$/, "");
const env = {
  web: trim(opt.web ?? "http://localhost:3000"),
  api: trim(opt.api ?? "http://localhost:8080"),
  user: opt.user ?? "admin@fincrime.local",
  password: opt.password ?? process.env.FINCRIME_ADMIN_PASSWORD ?? "FinCrime!Admin2026",
  scale: Math.min(3, Math.max(1, Number(opt.scale) || 2)),
};

// ---------------------------------------------------------------- reporting

const ICON = { ok: "✓", info: "•", warn: "!" };
const tally = { taken: 0, warnings: 0 };

function say(kind, text) {
  const line = `${ICON[kind]} ${text}`;
  console.log(line);
  try {
    appendFileSync(path.join(logDir, "capture.log"), `${line}\n`);
  } catch {
    // the log is a convenience
  }
}

// ----------------------------------------------------------------- the page

const PAGE_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important; animation-delay: 0s !important;
  transition-duration: 0s !important; transition-delay: 0s !important;
  scroll-behavior: auto !important; caret-color: transparent !important;
}
nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }`;

async function addStyle(page) {
  await page.evaluate((css) => {
    if (document.getElementById("portfolio-style")) return;
    const style = document.createElement("style");
    style.id = "portfolio-style";
    style.textContent = css;
    document.head.append(style);
  }, PAGE_CSS);
}

/** Quiet = no spinner and nothing marked busy for half a second in a row. */
async function waitQuiet(page, timeout = 15000) {
  const end = Date.now() + timeout;
  let quietSince = null;
  while (Date.now() < end) {
    const busy = await page.evaluate(() => Boolean(document.querySelector('.spinner, [aria-busy="true"]')));
    if (busy) quietSince = null;
    else if (quietSince === null) quietSince = Date.now();
    else if (Date.now() - quietSince >= 500) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

async function goTo(page, view, param) {
  const hash = param ? `#/${view}/${encodeURIComponent(param)}` : `#/${view}`;
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
  await page.waitForTimeout(250);
  let quiet = await waitQuiet(page);
  const retry = page.locator(".error-state button").first();
  if (await retry.count()) {
    await retry.click().catch(() => {});
    quiet = await waitQuiet(page);
  }
  return quiet;
}

async function openApp(page) {
  await page.goto(env.web, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.locator(".login-card").waitFor({ timeout: 90000 });
  await addStyle(page);
  await page.evaluate(() => document.fonts?.ready);
}

async function signIn(page) {
  await page.getByLabel("Email").fill(env.user);
  await page.getByLabel("Password").fill(env.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const outcome = await Promise.race([
    page.locator(".sidebar-nav").waitFor({ state: "attached", timeout: 30000 }).then(() => "in", () => "timeout"),
    page.locator('.login-card [role="alert"]').waitFor({ timeout: 30000 }).then(() => "rejected", () => "timeout"),
  ]);
  if (outcome !== "in") {
    const why = outcome === "rejected"
      ? await page.locator('.login-card [role="alert"]').first().innerText()
      : "the app did not open";
    throw new Fatal(`Could not sign in as ${env.user}: ${why.replace(/\s+/g, " ").replace(/\.$/, "")}. Use --user and --password, or set FINCRIME_ADMIN_PASSWORD.`);
  }
  await waitQuiet(page);
}

function watch(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message.slice(0, 100)}`));
  page.on("response", (response) => {
    if (response.url().startsWith(env.api) && response.status() >= 400) {
      problems.push(`${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`);
    }
  });
  return problems;
}

// ------------------------------------------------------------ one screenshot

// Things to do just before a particular picture.
const BEFORE = {
  // Sign-ins add audit events; bring the ledger up to date so its chain shows as valid.
  audit: (ctx) => (ctx.token ? refreshLedger(env.api, ctx.token) : undefined),
};

const isLogin = (shot) => shot.kind === "login" || shot.mobile === "login";

/** Gets the app into the state the picture needs. Returns an optional clean-up. */
async function arrange(page, shot, ctx) {
  const key = shot.kind === "mobile" ? shot.mobile : shot.kind;

  if (key === "login") return undefined;

  if (key === "palette") {
    await goTo(page, "overview");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Search and jump to" });
    await dialog.waitFor({ timeout: 10000 });
    await dialog.getByRole("combobox").fill(ctx.alertCode ? ctx.alertCode.slice(0, 4) : "net");
    await page.waitForTimeout(900);
    return () => page.keyboard.press("Escape");
  }

  if (key === "menu") {
    await goTo(page, "overview");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.waitForTimeout(500);
    return () => page.keyboard.press("Escape");
  }

  if (key === "case") {
    if (!ctx.caseId) throw new Error("there is no case to open (data preparation was skipped or failed)");
    await goTo(page, "cases", ctx.caseId);
  } else {
    try {
      await BEFORE[shot.id]?.(ctx);
    } catch (error) {
      say("warn", `${shot.id}: preparation step failed (${error.message})`);
    }
    if (!(await goTo(page, shot.view ?? shot.mobile))) say("warn", `${shot.id}: still loading after 15 seconds`);
  }
  for (const name of [].concat(shot.click ?? [])) {
    await page.getByRole("button", { name }).click({ timeout: 10000 });
    await page.waitForTimeout(300);
    await waitQuiet(page);
    await page.waitForTimeout(shot.settleMs ?? 600);
  }
  await page.waitForTimeout(shot.settleMs ?? 600);
  return undefined;
}

async function problemsOnScreen(page, shot) {
  const issues = [];
  if (shot.label) {
    const title = await page.title();
    if (!title.startsWith(shot.label)) issues.push(`expected the "${shot.label}" screen but the tab says "${title}"`);
  }
  const error = await page.locator(".error-state").first().innerText({ timeout: 500 }).catch(() => "");
  if (error) issues.push(`the screen shows an error: ${error.replace(/\s+/g, " ").slice(0, 110)}`);
  return issues;
}

/** Scrolls so the heading with this exact text sits just under the top bar. */
async function scrollToHeading(page, text) {
  const target = page.getByText(text, { exact: true }).first();
  if (!(await target.count())) return false;
  const top = await target.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 110)), top);
  await page.waitForTimeout(200);
  return true;
}

async function snap(page, shot) {
  const issues = [];
  await addStyle(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur?.();
  });
  if (shot.scrollTo && !(await scrollToHeading(page, shot.scrollTo))) {
    issues.push(`could not find "${shot.scrollTo}" to scroll to`);
  }
  const size = page.viewportSize();
  await page.mouse.move(size.width - 2, size.height - 2);
  const file = path.join(outDir, "screenshots", `${baseName(shot)}.png`);
  await page.screenshot({ path: file, fullPage: Boolean(opt.full) && ["view", "case"].includes(shot.kind) });
  return issues;
}

async function runShot(page, shot, ctx, problems) {
  problems.length = 0;
  const normal = page.viewportSize();
  try {
    if (shot.height) await page.setViewportSize({ width: normal.width, height: shot.height });
    const after = await arrange(page, shot, ctx);
    const issues = [...(await problemsOnScreen(page, shot))];
    issues.push(...(await snap(page, shot)));
    await after?.();
    issues.push(...problems);
    tally.taken += 1;
    if (issues.length) {
      tally.warnings += 1;
      say("warn", `${shot.id}: taken, but ${[...new Set(issues)].join("; ")}`);
    } else {
      say("ok", `${shot.id}`);
    }
  } catch (error) {
    if (error instanceof Fatal) throw error;
    tally.warnings += 1;
    say("warn", `${shot.id}: not taken (${error.message.split("\n")[0]})`);
  } finally {
    if (shot.height) await page.setViewportSize(normal).catch(() => {});
  }
}

// ------------------------------------------------------------------ browsers

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Fatal("Playwright is not installed. Run this once, inside scripts/portfolio:  npm install && npx playwright install chromium");
  }
}

async function launchBrowser(chromium) {
  const headless = !opt.headed;
  try {
    return await chromium.launch({ headless });
  } catch (error) {
    if (!/Executable doesn't exist/.test(error.message)) throw error;
    say("info", "Playwright's Chromium is not installed, trying Google Chrome instead.");
    try {
      return await chromium.launch({ channel: "chrome", headless });
    } catch {
      throw new Fatal("No browser to use. Run this once, inside scripts/portfolio:  npx playwright install chromium");
    }
  }
}

async function takeSet(browser, shots, ctx, device) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.scale,
    isMobile: device.mobile,
    hasTouch: device.mobile,
    reducedMotion: "reduce",
    locale: "en-US",
  });
  try {
    const page = await context.newPage();
    const problems = watch(page);
    await openApp(page);

    const rest = [...shots];
    if (isLogin(rest[0])) await runShot(page, rest.shift(), ctx, problems);
    if (!rest.length) return;

    await signIn(page);
    for (const shot of rest) await runShot(page, shot, ctx, problems);
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------- main

function readProfile() {
  try {
    return JSON.parse(readFileSync(path.join(here, "profile.json"), "utf8"));
  } catch {
    return {};
  }
}

function pickShots() {
  if (!opt.only) return SHOTS;
  const wanted = opt.only.split(",").map((id) => id.trim()).filter(Boolean);
  const unknown = wanted.filter((id) => !SHOTS.some((shot) => shot.id === id));
  if (unknown.length) {
    throw new Fatal(`Unknown picture id: ${unknown.join(", ")}. Valid ids: ${SHOTS.map((s) => s.id).join(", ")}`);
  }
  return SHOTS.filter((shot) => wanted.includes(shot.id));
}

let activeServices;

async function capture(planned) {
  let services = { stop: async () => {}, startedAny: false };
  let browser;
  try {
    if (!opt["no-start"]) {
      try {
        services = await ensureServices({ root, web: env.web, api: env.api, logDir, say });
      } catch (error) {
        throw new Fatal(`${error.message}\n  You can start the app yourself and run this again with --no-start.`);
      }
      activeServices = services;
    }
    if (!(await isUp(env.web))) throw new Fatal(`The web app is not answering on ${env.web}. Start it, or remove --no-start.`);
    if (!(await isUp(`${env.api}/actuator/health`))) throw new Fatal(`The backend is not answering on ${env.api}. Start it, or remove --no-start.`);

    const ctx = await prepareData({
      api: env.api,
      user: env.user,
      password: env.password,
      say,
      freshStart: services.startedAny,
      write: !opt["no-prepare"],
    });

    const { chromium } = await loadPlaywright();
    browser = await launchBrowser(chromium);

    const desktop = planned.filter((shot) => shot.kind !== "mobile");
    const phone = opt["skip-mobile"] ? [] : planned.filter((shot) => shot.kind === "mobile");
    if (desktop.length) await takeSet(browser, desktop, ctx, { width: 1440, height: 900, scale: env.scale, mobile: false });
    if (phone.length) await takeSet(browser, phone, ctx, { width: 390, height: 844, scale: Math.min(3, env.scale + 1), mobile: true });
  } finally {
    await browser?.close();
    if (!opt["keep-running"]) await services.stop();
  }
}

async function main() {
  if (opt.help) return console.log(HELP);
  if (opt.list) return console.log(SHOTS.map((s) => `${baseName(s)}  ${s.title}`).join("\n"));

  const planned = pickShots();
  mkdirSync(path.join(outDir, "screenshots"), { recursive: true });
  mkdirSync(logDir, { recursive: true });
  await fs.writeFile(path.join(outDir, ".gitignore"), ".logs/\n");

  say("info", `Taking ${planned.length} picture(s) of ${env.web} into ${path.relative(process.cwd(), outDir) || "."}`);
  await capture(planned);

  const facts = await collectFacts(root);
  const shots = await inventory(outDir);
  const count = await writeDocs({ outDir, facts, profile: readProfile(), shots });

  say("ok", `Wrote the descriptions and project details (${count} picture(s) in total).`);
  if (tally.warnings) say("warn", `${tally.warnings} picture(s) need a look, see the lines marked ! above.`);
  say("info", `Open ${path.join(outDir, "README.md")} to see what you have.`);
  if (!tally.taken) process.exitCode = 1;
}

process.on("SIGINT", async () => {
  await activeServices?.stop();
  process.exit(130);
});

try {
  await main();
} catch (error) {
  console.error(`✗ ${error instanceof Fatal ? error.message : error.stack}`);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
