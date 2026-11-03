// Turns the captured pictures, the story in content.mjs and the measured facts
// into the files that fill the portfolio/ folder. Pure text work: no browser.
import { promises as fs } from "node:fs";
import path from "node:path";
import { PROJECT, SHOTS } from "./content.mjs";

const TODO = "_not set yet (edit scripts/portfolio/profile.json)_";

const n = (value) => Number(value ?? 0).toLocaleString("en-US");
const bullets = (items) => items.map((item) => `- ${item}`).join("\n");
const major = (version) => (version ? version.split(".").slice(0, 2).join(".") : "");
const pad = (value) => String(value).padStart(2, "0");

async function write(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text.endsWith("\n") ? text : `${text}\n`);
}

/** Width and height of a PNG, read from its header. */
async function pngSize(file) {
  const handle = await fs.open(file, "r");
  try {
    const head = Buffer.alloc(24);
    await handle.read(head, 0, 24, 0);
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  } finally {
    await handle.close();
  }
}

/** File name without extension, e.g. "05-cases". The number is the shot's place in content.mjs. */
export const baseName = (shot) => `${pad(SHOTS.indexOf(shot) + 1)}-${shot.id}`;

/**
 * Pairs every planned shot with the picture on disk (if there is one), so a
 * partial run (--only) still documents the pictures taken earlier.
 */
export async function inventory(outDir) {
  const result = [];
  for (const shot of SHOTS) {
    const base = baseName(shot);
    const number = base.slice(0, 2);
    const image = path.join(outDir, "screenshots", `${base}.png`);
    const entry = { ...shot, number, base, file: `screenshots/${base}.png`, exists: false };
    try {
      const stat = await fs.stat(image);
      Object.assign(entry, await pngSize(image), {
        exists: true,
        bytes: stat.size,
        capturedAt: stat.mtime.toISOString(),
      });
    } catch {
      // not captured yet
    }
    result.push(entry);
  }
  return result;
}

function route(shot) {
  if (shot.kind === "login" || (shot.kind === "mobile" && shot.mobile === "login")) return "Sign-in screen";
  if (shot.kind === "palette") return "Press Ctrl or Cmd + K on any screen";
  if (shot.kind === "case") return "Cases, then open a case (`#/cases/<id>`)";
  if (shot.kind === "mobile" && shot.mobile === "menu") return "Menu button in the top bar (phone width)";
  const view = shot.view ?? shot.mobile;
  return `Sidebar: ${shot.label} (\`#/${view}\`)`;
}

function shotNote(shot) {
  return [
    `# ${shot.title}`,
    "",
    `![${shot.alt}](${shot.base}.png)`,
    "",
    `**Caption:** ${shot.caption}`,
    "",
    `**Alt text:** ${shot.alt}`,
    "",
    `**Where in the app:** ${route(shot)}`,
    "",
    `**Image:** ${shot.base}.png, ${n(shot.width)} x ${n(shot.height)} px, ${(shot.bytes / 1024).toFixed(0)} KB, captured ${shot.capturedAt.slice(0, 10)}`,
    "",
    "## Description",
    "",
    shot.description,
    "",
    "## Talking points",
    "",
    bullets(shot.points),
  ].join("\n");
}

function numbers(facts) {
  const { backend: b, web: w, git } = facts;
  return {
    modules: w.views.length,
    endpoints: b.endpoints,
    controllers: b.controllerCount,
    migrations: b.migrations.length,
    tests: b.testMethods,
    tables: b.tables.length,
    entities: b.entities.length,
    javaLines: b.javaLines,
    javaFiles: b.javaFiles,
    testFiles: b.testFiles,
    webLines: w.sourceLines,
    webFiles: w.sourceFiles,
    cssLines: w.cssLines,
    commits: git?.commits,
    boot: first(facts.stack.springBoot),
    java: first(facts.stack.java),
    next: first(facts.stack.next),
    react: first(facts.stack.react),
    postgres: first(facts.stack.postgres),
  };
}

function fill(text, values) {
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    if (value === undefined) return `{${key}}`;
    return typeof value === "number" ? n(value) : value;
  });
}

const first = (version) => (version ? String(version).split(/[.\-]/)[0] : undefined);

function stackRows(facts) {
  const s = facts.stack;
  return [
    ["Backend", "Spring Boot", s.springBoot],
    ["Backend", "Java", s.java],
    ["Backend", "Spring Security, JWT (HS256), Spring Data JPA, Spring Data Neo4j, Flyway", ""],
    ["Data", "PostgreSQL", s.postgres],
    ["Data", "Neo4j (graph)", s.neo4j],
    ["Frontend", "Next.js", s.next],
    ["Frontend", "React", major(s.react)],
    ["Frontend", "TypeScript", major(s.typescript)],
    ["Frontend", "Cytoscape.js (network graph)", s.cytoscape],
    ["Tooling", "Docker Compose, Maven, npm, ESLint", ""],
  ].filter((row) => row[1]);
}

function profileTable(profile, facts) {
  const repo = profile.repoUrl || facts.git?.repoUrl;
  const rows = [
    ["Project", PROJECT.name],
    ["Type", "Full-stack web application"],
    ["Author", profile.author || facts.git?.author || TODO],
    ["Role", profile.role || TODO],
    ["Team", profile.team || TODO],
    ["Timeline", profile.timeline || TODO],
    ["Status", profile.status || "Working prototype on synthetic data"],
    ["Source code", repo ? repo : TODO],
    ["Live demo", profile.liveDemoUrl || TODO],
  ];
  return ["| | |", "|---|---|", ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join("\n");
}

function numbersList(facts, shotCount) {
  const x = numbers(facts);
  const lines = [
    `${n(x.modules)} modules in the app, grouped into five areas`,
    `${n(x.endpoints)} REST endpoints in ${n(x.controllers)} controllers`,
    `${n(x.javaLines)} lines of Java in ${n(x.javaFiles)} files, with ${n(x.tests)} unit tests in ${n(x.testFiles)} test files`,
    `${n(x.webLines)} lines of TypeScript in ${n(x.webFiles)} files, plus ${n(x.cssLines)} lines of CSS`,
    `${n(x.tables)} database tables created by ${n(x.migrations)} Flyway migrations, ${n(x.entities)} JPA entities`,
  ];
  const git = facts.git;
  if (git?.commits) {
    const span = git.firstCommit === git.lastCommit ? `on ${git.lastCommit}` : `from ${git.firstCommit} to ${git.lastCommit}`;
    lines.push(`${n(git.commits)} ${git.commits === 1 ? "commit" : "commits"}, ${span}`);
  }
  lines.push(`${n(shotCount)} screenshots in this folder`);
  return bullets(lines);
}

function apiTable(facts) {
  const rows = facts.backend.controllers.map(
    (c) => `| ${c.name.replace(/Controller$/, "").replace(/([a-z])([A-Z])/g, "$1 $2")} | \`${c.path ?? ""}\` | ${c.endpoints} |`
  );
  return ["| Area | Base path | Endpoints |", "|---|---|---:|", ...rows].join("\n");
}

function featuresMd() {
  return PROJECT.features.map((f) => `### ${f.area}\n\n${bullets(f.items)}`).join("\n\n");
}

export function projectMd({ facts, profile, shotCount }) {
  const x = numbers(facts);
  const b = facts.backend;
  return [
    `# ${PROJECT.name}`,
    "",
    `**${PROJECT.tagline}**`,
    "",
    profileTable(profile, facts),
    "",
    "## Pitch",
    "",
    `**One sentence.** ${PROJECT.pitch.short}`,
    "",
    `**Short paragraph.** ${PROJECT.pitch.medium}`,
    "",
    `**Full paragraph.** ${PROJECT.pitch.long}`,
    "",
    "## The problem",
    "",
    bullets(PROJECT.problem),
    "",
    "## The solution",
    "",
    bullets(PROJECT.solution),
    "",
    "## Features",
    "",
    featuresMd(),
    "",
    "## By the numbers",
    "",
    "_Measured from the code when this folder was generated._",
    "",
    numbersList(facts, shotCount),
    "",
    "## Architecture",
    "",
    "```text",
    fill(PROJECT.architecture.diagram.join("\n"), x),
    "```",
    "",
    bullets(PROJECT.architecture.notes),
    "",
    "## Tech stack",
    "",
    ["| Layer | Technology | Version |", "|---|---|---|", ...stackRows(facts).map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`)].join("\n"),
    "",
    "## API surface",
    "",
    `${n(b.endpoints)} endpoints in ${n(b.controllerCount)} controllers. Roles: ${b.roles.join(", ")}.`,
    "",
    apiTable(facts),
    "",
    "## Data model",
    "",
    `${n(b.tables.length)} PostgreSQL tables: ${b.tables.map((t) => `\`${t}\``).join(", ")}.`,
    "",
    "The Neo4j graph holds accounts and customers as nodes and `TRANSFERRED_TO` relationships for transfers. It is rebuilt from PostgreSQL.",
    "",
    "### Migration history",
    "",
    ["| Version | Change |", "|---:|---|", ...b.migrations.map((m) => `| V${m.version} | ${m.title} |`)].join("\n"),
    "",
    "## Engineering decisions",
    "",
    PROJECT.decisions.map((d) => `### ${d.title}\n\n${d.text}`).join("\n\n"),
    "",
    "## Challenges",
    "",
    bullets(PROJECT.challenges),
    "",
    "## What I learned",
    "",
    bullets(PROJECT.learnings),
    "",
    "## Known limitations",
    "",
    bullets(PROJECT.limitations),
    "",
    "## What is next",
    "",
    bullets(PROJECT.roadmap),
    "",
    "## Run it locally",
    "",
    "```bash",
    "docker compose up -d                 # PostgreSQL and Neo4j",
    "cd apps/backend && mvn spring-boot:run",
    "cd apps/web && npm install && npm run dev",
    "# open http://localhost:3000",
    "```",
    "",
    "Demo identities: `analyst@fincrime.local`, `senior@fincrime.local` and `admin@fincrime.local`. Their passwords are set in `apps/backend/src/main/resources/application.yml` and can be overridden with the `FINCRIME_*_PASSWORD` environment variables.",
    "",
    "## Text you can paste",
    "",
    "### CV bullets",
    "",
    bullets(PROJECT.resumeBullets.map((line) => fill(line, x))),
    "",
    "### Keywords",
    "",
    PROJECT.keywords.join(", "),
  ].join("\n");
}

function figure(shots, id, heading) {
  const shot = shots.find((s) => s.id === id && s.exists);
  if (!shot) return "";
  return [`![${shot.alt}](${shot.file})`, "", `*${heading ?? shot.caption}*`, ""].join("\n");
}

export function caseStudyMd({ facts, profile, shots }) {
  const x = numbers(facts);
  const lead = [profile.role, profile.timeline, profile.team].filter(Boolean).join(" · ");
  const stack = stackRows(facts).filter((r) => r[2]).map((r) => `${r[1]} ${r[2]}`).join(", ");
  return [
    `# ${PROJECT.name}: case study`,
    "",
    lead ? `*${lead}*` : "*Add your role and timeline in scripts/portfolio/profile.json*",
    "",
    figure(shots, "overview"),
    "## Overview",
    "",
    PROJECT.pitch.long,
    "",
    "## The problem",
    "",
    bullets(PROJECT.problem),
    "",
    "## The approach",
    "",
    bullets(PROJECT.solution),
    "",
    figure(shots, "alerts"),
    figure(shots, "network", "A circular flow found on the money-movement graph."),
    figure(shots, "case-workspace"),
    "## How it works",
    "",
    "```text",
    fill(PROJECT.architecture.diagram.join("\n"), x),
    "```",
    "",
    bullets(PROJECT.architecture.notes),
    "",
    figure(shots, "decisions"),
    "## Decisions that shaped it",
    "",
    PROJECT.decisions.map((d) => `**${d.title}.** ${d.text}`).join("\n\n"),
    "",
    "## Challenges",
    "",
    bullets(PROJECT.challenges),
    "",
    "## Result",
    "",
    `The platform runs end to end on synthetic data: ${n(x.modules)} modules, ${n(x.endpoints)} REST endpoints, ${n(x.migrations)} database migrations and ${n(x.tests)} automated unit tests.`,
    "",
    `Built with ${stack}.`,
    "",
    figure(shots, "audit"),
    "## What I learned",
    "",
    bullets(PROJECT.learnings),
    "",
    "## What is next",
    "",
    bullets(PROJECT.roadmap),
    "",
    figure(shots, "mobile-overview", "The same product on a phone."),
  ].join("\n");
}

export function galleryMd(shots) {
  const taken = shots.filter((s) => s.exists);
  return [
    "# Screenshots",
    "",
    `${taken.length} pictures. Each has a caption, a longer description and talking points; the same text is in \`screenshots.json\` and next to each image in \`screenshots/\`.`,
    "",
    ...taken.flatMap((s) => [
      `## ${s.number}. ${s.title}`,
      "",
      `![${s.alt}](${s.file})`,
      "",
      `**${s.caption}**`,
      "",
      s.description,
      "",
      bullets(s.points),
      "",
    ]),
  ].join("\n");
}

function readmeMd({ facts, shots }) {
  const taken = shots.filter((s) => s.exists);
  const missing = shots.filter((s) => !s.exists);
  return [
    `# Portfolio kit: ${PROJECT.name}`,
    "",
    `Generated on ${facts.generatedAt.slice(0, 10)} by \`scripts/portfolio\`. Everything here comes from your running app and your code, so run the script again after you change the project.`,
    "",
    "## What is in this folder",
    "",
    "| Path | What it is |",
    "|---|---|",
    "| `screenshots/` | One PNG per screen, plus a `.md` note with the caption, description and talking points for each |",
    "| `screenshots.md` | All pictures with their text in one page, ready to copy from |",
    "| `screenshots.json` | The same information for a script or a portfolio site |",
    "| `project.md` | The project in full: pitch, features, architecture, stack, numbers, decisions, CV bullets |",
    "| `project.json` | The same, as data |",
    "| `case-study.md` | A readable write-up with the key pictures embedded |",
    "",
    "## Pictures",
    "",
    "| # | Picture | Caption |",
    "|---:|---|---|",
    ...taken.map((s) => `| ${s.number} | [${s.title}](${s.file}) | ${s.caption} |`),
    ...(missing.length
      ? ["", `Not captured yet: ${missing.map((s) => s.id).join(", ")}. Run the script again, for example \`node capture.mjs --only ${missing[0].id}\`.`]
      : []),
    "",
    "## Before you publish",
    "",
    bullets([
      "Fill in your role, timeline and links in `scripts/portfolio/profile.json`, then run the script again so `project.md` and `case-study.md` pick them up.",
      "Look at every picture once. The data is synthetic, but check that nothing unexpected is on screen.",
      "Pick three to five pictures for the portfolio page: usually the overview, the network graph, the case workspace and one governance screen.",
      "Pictures are 2x resolution. Resize or convert them to WebP if your portfolio site wants smaller files.",
    ]),
    "",
    "## Take the pictures again",
    "",
    "```bash",
    "cd scripts/portfolio",
    "node capture.mjs                 # everything",
    "node capture.mjs --only network  # just one or more pictures (comma separated ids)",
    "node capture.mjs --help          # all options",
    "```",
  ].join("\n");
}

function shotJson(s) {
  return {
    number: s.number,
    id: s.id,
    title: s.title,
    file: s.file,
    alt: s.alt,
    caption: s.caption,
    description: s.description,
    talkingPoints: s.points,
    device: s.kind === "mobile" ? "phone" : "desktop",
    width: s.width,
    height: s.height,
    bytes: s.bytes,
    capturedAt: s.capturedAt,
  };
}

export async function writeDocs({ outDir, facts, profile, shots }) {
  const taken = shots.filter((s) => s.exists);

  for (const s of taken) {
    await write(path.join(outDir, "screenshots", `${s.base}.md`), shotNote(s));
  }
  await write(path.join(outDir, "screenshots.md"), galleryMd(shots));
  await write(path.join(outDir, "screenshots.json"), JSON.stringify(taken.map(shotJson), null, 2));

  await write(path.join(outDir, "project.md"), projectMd({ facts, profile, shotCount: taken.length }));
  await write(path.join(outDir, "case-study.md"), caseStudyMd({ facts, profile, shots }));
  await write(path.join(outDir, "README.md"), readmeMd({ facts, shots }));

  const x = numbers(facts);
  const data = {
    generatedAt: facts.generatedAt,
    name: PROJECT.name,
    tagline: PROJECT.tagline,
    profile: { ...profile, repoUrl: profile.repoUrl || facts.git?.repoUrl || "" },
    pitch: PROJECT.pitch,
    problem: PROJECT.problem,
    solution: PROJECT.solution,
    features: PROJECT.features,
    architecture: { ...PROJECT.architecture, diagram: PROJECT.architecture.diagram.map((line) => fill(line, x)) },
    decisions: PROJECT.decisions,
    challenges: PROJECT.challenges,
    learnings: PROJECT.learnings,
    limitations: PROJECT.limitations,
    roadmap: PROJECT.roadmap,
    keywords: PROJECT.keywords,
    resumeBullets: PROJECT.resumeBullets.map((line) => fill(line, x)),
    numbers: x,
    stack: facts.stack,
    git: facts.git,
    api: { endpoints: facts.backend.endpoints, roles: facts.backend.roles, controllers: facts.backend.controllers },
    data: { tables: facts.backend.tables, migrations: facts.backend.migrations },
    views: facts.web.views,
    screenshots: taken.map(shotJson),
  };
  await write(path.join(outDir, "project.json"), JSON.stringify(data, null, 2));

  return taken.length;
}
