// Measures the project instead of trusting memory: versions, sizes, endpoints,
// tables, tests and git history. Everything is best effort: a missing file or
// no git simply leaves that fact out.
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "target", "build", "dist", "out",
  "portfolio", ".idea", ".vscode", ".logs",
]);

async function read(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function walk(dir, keep, found = []) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await walk(full, keep, found);
    } else if (keep(full)) {
      found.push(full);
    }
  }
  return found;
}

async function lineCount(files) {
  let lines = 0;
  for (const file of files) {
    const text = await read(file);
    if (text) lines += text.split("\n").length;
  }
  return lines;
}

function match(text, regex) {
  return regex.exec(text)?.[1]?.trim();
}

function count(text, regex) {
  return (text.match(regex) ?? []).length;
}

function humanise(slug) {
  const words = slug
    .replace(/_/g, " ")
    .trim()
    .replace(/\b(aml|sla|csv|json|api|jwt|sar)\b/gi, (word) => word.toUpperCase())
    .replace(/\bfincrime\b/gi, "FinCrime");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Removes any user:password@ part and turns an ssh remote into an https link. */
export function cleanRemote(remote) {
  if (!remote) return undefined;
  const ssh = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(remote);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  try {
    const url = new URL(remote);
    url.username = "";
    url.password = "";
    return url.toString().replace(/\.git$/, "");
  } catch {
    return undefined;
  }
}

async function git(root, ...args) {
  try {
    const { stdout } = await run("git", args, { cwd: root, timeout: 15000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function gitFacts(root) {
  if (!(await git(root, "rev-parse", "--is-inside-work-tree"))) return null;
  const log = (await git(root, "log", "--format=%aI")).split("\n").filter(Boolean);
  return {
    repoUrl: cleanRemote(await git(root, "remote", "get-url", "origin")),
    branch: await git(root, "rev-parse", "--abbrev-ref", "HEAD"),
    commits: log.length,
    firstCommit: log.at(-1)?.slice(0, 10),
    lastCommit: log.at(0)?.slice(0, 10),
    author: await git(root, "config", "user.name"),
  };
}

async function stackFacts(root) {
  const pom = await read(path.join(root, "apps/backend/pom.xml"));
  const web = JSON.parse((await read(path.join(root, "apps/web/package.json"))) || "{}");
  const compose = await read(path.join(root, "compose.yaml"));
  const deps = { ...web.dependencies, ...web.devDependencies };
  const images = [...compose.matchAll(/image:\s*(\S+)/g)].map((m) => m[1]);
  const clean = (v) => (v ? String(v).replace(/^[\^~]/, "") : undefined);

  return {
    springBoot: match(pom, /spring-boot-starter-parent<\/artifactId>\s*<version>([^<]+)</),
    java: match(pom, /<java\.version>([^<]+)</),
    postgres: images.find((i) => i.startsWith("postgres"))?.split(":")[1],
    neo4j: images.find((i) => i.startsWith("neo4j"))?.split(":")[1],
    next: clean(deps.next),
    react: clean(deps.react),
    typescript: clean(deps.typescript),
    cytoscape: clean(deps.cytoscape),
  };
}

async function backendFacts(root) {
  const base = path.join(root, "apps/backend");
  const javaMain = await walk(path.join(base, "src/main"), (f) => f.endsWith(".java"));
  const javaTest = await walk(path.join(base, "src/test"), (f) => f.endsWith(".java"));
  const migrations = await walk(
    path.join(base, "src/main/resources/db/migration"),
    (f) => /V\d+__.+\.sql$/.test(f)
  );

  const controllers = [];
  const entities = [];
  const roles = new Set();
  let services = 0;
  let endpoints = 0;
  for (const file of javaMain) {
    const text = await read(file);
    const name = path.basename(file, ".java");
    for (const m of text.matchAll(/hasA?n?y?Role\(([^)]*)\)/g)) {
      for (const r of m[1].matchAll(/'([A-Z_]+)'/g)) roles.add(r[1]);
    }
    if (/@Entity\b/.test(text)) entities.push(name);
    if (/@Service\b/.test(text)) services += 1;
    if (/@RestController\b/.test(text)) {
      const own = count(text, /@(Get|Post|Put|Patch|Delete)Mapping\b/g);
      endpoints += own;
      controllers.push({
        name,
        path: match(text, /@RequestMapping\(\s*"([^"]+)"/),
        endpoints: own,
      });
    }
  }

  let testMethods = 0;
  for (const file of javaTest) {
    testMethods += count(await read(file), /@(Test|ParameterizedTest)\b/g);
  }

  const tables = new Set();
  const migrationList = [];
  for (const file of migrations.sort()) {
    const text = await read(file);
    for (const m of text.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_0-9]+)/gi)) {
      tables.add(m[1]);
    }
    const [, version, title] = /V(\d+)__(.+)\.sql$/.exec(path.basename(file));
    migrationList.push({ version: Number(version), title: humanise(title) });
  }
  migrationList.sort((a, b) => a.version - b.version);

  return {
    javaFiles: javaMain.length,
    javaLines: await lineCount(javaMain),
    testFiles: javaTest.length,
    testLines: await lineCount(javaTest),
    testMethods,
    controllers: controllers.sort((a, b) => b.endpoints - a.endpoints),
    controllerCount: controllers.length,
    endpoints,
    entities: entities.sort(),
    services,
    roles: [...roles].sort(),
    migrations: migrationList,
    tables: [...tables].sort(),
  };
}

async function webFacts(root) {
  const src = path.join(root, "apps/web/src");
  const code = await walk(src, (f) => /\.(ts|tsx)$/.test(f));
  const css = await walk(src, (f) => f.endsWith(".css"));
  const components = code.filter((f) => f.includes(`${path.sep}components${path.sep}`));
  const nav = await read(path.join(src, "lib/navigation.ts"));
  const views = [...nav.matchAll(/^\s+id: "([a-z-]+)",\s*\n\s+label:/gm)].map((m) => m[1]);

  return {
    sourceFiles: code.length,
    sourceLines: await lineCount(code),
    componentFiles: components.length,
    cssLines: await lineCount(css),
    views,
  };
}

export async function collectFacts(root) {
  const [stack, backend, web, repo] = await Promise.all([
    stackFacts(root),
    backendFacts(root),
    webFacts(root),
    gitFacts(root),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    folder: path.basename(root),
    git: repo,
    stack,
    backend,
    web,
  };
}
