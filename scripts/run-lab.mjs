import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const labHome = resolve(process.env.DSH_CREATOR_COCKPIT_LAB_HOME ?? join(repoRoot, ".lab", "dsh-home"));
const cliEntry = resolve(
  process.env.DSH_CREATOR_COCKPIT_CLI_ENTRY
    ?? "/Applications/DSH Desktop.app/Contents/Resources/app.asar.unpacked/node_modules/@deepseek-ai/dsh/lib/bin.js",
);
const patchPath = join(repoRoot, "lab", "cordis.test.patch.yml");
const libraryRoot = resolve(
  process.env.DSH_CREATOR_COCKPIT_LIBRARY_ROOT ?? join(repoRoot, ".lab", "content-library"),
);
const dataDir = resolve(process.env.DSH_CREATOR_COCKPIT_DATA_DIR ?? join(repoRoot, ".lab", "data"));
const cockpitDataDir = resolve(
  process.env.DSH_CREATOR_COCKPIT_STATE_DIR ?? join(repoRoot, ".lab", "cockpit-data"),
);

for (const [label, path] of [
  ["DSH CLI", cliEntry],
  ["lab profile", join(labHome, "profiles", "web", "package.json")],
  ["test patch", patchPath],
]) {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${path}`);
}

const labRoot = join(repoRoot, ".lab");
const libraryRelative = relative(labRoot, libraryRoot);
if (process.env.DSH_CREATOR_COCKPIT_ALLOW_EXTERNAL_LIBRARY !== "1"
  && (libraryRelative === ".." || libraryRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(libraryRelative))) {
  throw new Error(`lab library must stay inside ${labRoot}; set DSH_CREATOR_COCKPIT_ALLOW_EXTERNAL_LIBRARY=1 only for an explicit read/write test`);
}
mkdirSync(labRoot, { recursive: true });
mkdirSync(libraryRoot, { recursive: true });
if (process.env.DSH_CREATOR_COCKPIT_ALLOW_EXTERNAL_LIBRARY !== "1") {
  if (lstatSync(labRoot).isSymbolicLink() || lstatSync(libraryRoot).isSymbolicLink()) {
    throw new Error("lab root and library root must be real directories, not symbolic links");
  }
  const realRelative = relative(realpathSync(labRoot), realpathSync(libraryRoot));
  if (realRelative === "" || realRelative === ".." || realRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(realRelative)) {
    throw new Error(`real lab library escaped ${realpathSync(labRoot)}`);
  }
}
mkdirSync(dataDir, { recursive: true });
const overlayPath = join(dataDir, "overlay.json");
const overlay = existsSync(overlayPath)
  ? JSON.parse(readFileSync(overlayPath, "utf8"))
  : { schemaVersion: 1, items: {} };
overlay.libraryRoot = libraryRoot;
writeFileSync(overlayPath, `${JSON.stringify(overlay, null, 2)}\n`, { mode: 0o600 });

const args = [cliEntry, "--profile", "web", "--patch", patchPath, ...process.argv.slice(2)];
if (!args.includes("--dump-config") && !args.includes("--dump-default-config") && !args.includes("--help")) {
  args.push("--port", process.env.DSH_CREATOR_COCKPIT_PORT ?? "51873");
}

const result = spawnSync(process.execPath, args, {
  cwd: repoRoot,
  env: {
    ...process.env,
    DSH_HOME: labHome,
    CHOKIDAR_USEPOLLING: process.env.CHOKIDAR_USEPOLLING ?? "1",
    DSH_CREATOR_COCKPIT_DATA_DIR: dataDir,
    DSH_CREATOR_COCKPIT_STATE_DIR: cockpitDataDir,
    DSH_CREATOR_COCKPIT_LIBRARY_ROOT: libraryRoot,
  },
  stdio: "inherit",
});

if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
