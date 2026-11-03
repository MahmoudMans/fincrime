// Makes sure the app is running while the pictures are taken. If something is
// missing it starts it (docker compose, backend, web) and stops it again
// afterwards. Databases started by docker compose are left running.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when anything answers on the address, whatever the status code. */
export async function isUp(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000), redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

function isLocal(url) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
}

function launch(name, command, args, { cwd, env, logDir }) {
  mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `${name}.log`);
  const log = openSync(logFile, "w");
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.logFile = logFile;
  child.once("error", (error) => {
    child.failed = `could not run ${command}: ${error.message}`;
  });
  return child;
}

async function waitFor(label, url, child, seconds) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    if (await isUp(url)) return;
    if (child.failed) throw new Error(`${label}: ${child.failed}`);
    if (child.exitCode !== null) {
      throw new Error(`${label} stopped while starting. Details: ${child.logFile}`);
    }
    await sleep(2000);
  }
  throw new Error(`${label} did not answer on ${url} within ${seconds} seconds. Details: ${child.logFile}`);
}

function stopProcess(child) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // already gone
  }
}

/**
 * Starts whatever is not answering yet. Returns { stop }.
 * Only local addresses are ever started; a remote URL must already be up.
 */
export async function ensureServices({ root, web, api, logDir, say }) {
  const started = [];
  const stop = async () => {
    const running = started.filter((child) => child.pid);
    for (const child of running) stopProcess(child);
    if (running.length) say("info", `Stopped ${running.length} process(es) this script started.`);
  };

  try {
    if (!(await isUp(`${api}/actuator/health`)) && isLocal(api)) {
      say("info", "Backend is not running, starting it (PostgreSQL and Neo4j first)...");
      const docker = spawnSync("docker", ["compose", "up", "-d", "--wait"], {
        cwd: root,
        encoding: "utf8",
        timeout: 600000,
      });
      if (docker.error || docker.status !== 0) {
        say("warn", "docker compose did not start cleanly. Assuming PostgreSQL and Neo4j are already running.");
      }
      const backend = path.join(root, "apps/backend");
      const command = existsSync(path.join(backend, "mvnw")) ? "./mvnw" : "mvn";
      const child = launch("backend", command, ["spring-boot:run"], { cwd: backend, logDir });
      started.push(child);
      await waitFor("Backend", `${api}/actuator/health`, child, 300);
      say("ok", "Backend is up.");
    }

    if (!(await isUp(web)) && isLocal(web)) {
      say("info", "Web app is not running, starting it...");
      const dir = path.join(root, "apps/web");
      if (!existsSync(path.join(dir, "node_modules"))) {
        say("info", "Installing web dependencies first (npm install)...");
        spawnSync("npm", ["install"], { cwd: dir, stdio: "ignore" });
      }
      const port = new URL(web).port || "3000";
      const child = launch("web", "npm", ["run", "dev", "--", "--port", port], {
        cwd: dir,
        env: { NEXT_PUBLIC_API_BASE_URL: api },
        logDir,
      });
      started.push(child);
      await waitFor("Web app", web, child, 180);
      say("ok", "Web app is up.");
    }
  } catch (error) {
    await stop();
    throw error;
  }

  return { stop, startedAny: started.length > 0 };
}
