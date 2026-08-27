import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceHome = resolve(process.env.DSH_CREATOR_COCKPIT_SOURCE_HOME ?? join(homedir(), ".dsh"));
const labHome = resolve(process.env.DSH_CREATOR_COCKPIT_LAB_HOME ?? join(repoRoot, ".lab", "dsh-home"));
const sourceProfile = join(sourceHome, "profiles", "web");
const labProfile = join(labHome, "profiles", "web");
const labModules = join(labHome, "profiles", "node_modules");
const labDataDir = resolve(process.env.DSH_CREATOR_COCKPIT_DATA_DIR ?? join(repoRoot, ".lab", "data"));
const labLibraryRoot = resolve(process.env.DSH_CREATOR_COCKPIT_LIBRARY_ROOT ?? join(repoRoot, ".lab", "content-library"));
const labRoot = join(repoRoot, ".lab");
const PACKAGE_NAME = "jacky-creator";
const LEGACY_PACKAGE_NAME = "dsh-oil-creator";

function requirePath(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${path}`);
  return path;
}

function copyIfPresent(source, target) {
  if (!existsSync(source)) return;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function copyTreeIfPresent(source, target) {
  if (!existsSync(source)) return;
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
}

function ensureLink(target, link) {
  mkdirSync(dirname(link), { recursive: true });
  if (existsSync(link) || lstatExists(link)) {
    const stat = lstatSync(link);
    if (stat.isSymbolicLink() && resolve(dirname(link), readlinkSync(link)) === resolve(target)) return;
    throw new Error(`refusing to replace existing lab module path: ${link}`);
  }
  symlinkSync(target, link, "junction");
}

function lstatExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

requirePath(join(sourceProfile, "package.json"), "web profile manifest");
requirePath(join(sourceProfile, "cordis.patch.yml"), "web profile patch");
requirePath(join(repoRoot, "package.json"), "lab package manifest");
requirePath(join(repoRoot, "lib", "index.js"), "local host build");
requirePath(join(repoRoot, "lib", "client.js"), "local client build");

mkdirSync(labRoot, { recursive: true });
const libraryRelative = relative(labRoot, labLibraryRoot);
if (process.env.DSH_CREATOR_COCKPIT_ALLOW_EXTERNAL_LIBRARY !== "1"
  && (libraryRelative === "" || libraryRelative === ".." || libraryRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(libraryRelative))) {
  throw new Error(`lab library must stay inside ${labRoot}`);
}
if (process.env.DSH_CREATOR_COCKPIT_ALLOW_EXTERNAL_LIBRARY !== "1" && lstatSync(labRoot).isSymbolicLink()) {
  throw new Error("lab root must be a real directory, not a symbolic link");
}

mkdirSync(labModules, { recursive: true });
mkdirSync(labProfile, { recursive: true });
const labCredentials = join(labHome, ".credentials.yaml");
if (!existsSync(labCredentials)) {
  writeFileSync(labCredentials, "", { mode: 0o600, flag: "wx" });
}
copyFileSync(join(sourceProfile, "cordis.patch.yml"), join(labProfile, "cordis.patch.yml"));
copyFileSync(join(sourceProfile, "pnpm-workspace.yaml"), join(labProfile, "pnpm-workspace.yaml"));
copyIfPresent(join(sourceHome, "cordis.patch.yml"), join(labHome, "cordis.patch.yml"));
copyIfPresent(join(sourceHome, "settings.yaml"), join(labHome, "settings.yaml"));
copyTreeIfPresent(join(sourceHome, ".agent-presets"), join(labHome, ".agent-presets"));
copyTreeIfPresent(join(sourceHome, "sessions"), join(labHome, "sessions"));
copyTreeIfPresent(join(sourceHome, "storages"), join(labHome, "storages"));
mkdirSync(labDataDir, { recursive: true });
mkdirSync(labLibraryRoot, { recursive: true });
if (process.env.DSH_CREATOR_COCKPIT_ALLOW_EXTERNAL_LIBRARY !== "1") {
  if (lstatSync(labLibraryRoot).isSymbolicLink()) throw new Error("lab library root must not be a symbolic link");
  const realRelative = relative(realpathSync(labRoot), realpathSync(labLibraryRoot));
  if (realRelative === "" || realRelative === ".." || realRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(realRelative)) {
    throw new Error(`real lab library escaped ${realpathSync(labRoot)}`);
  }
}
const fixtureId = "2026-08-20_DeepSeek Harness 上手指南";
const fixtureDir = join(labLibraryRoot, fixtureId);
mkdirSync(fixtureDir, { recursive: true });
if (!existsSync(join(fixtureDir, "topic.md"))) {
  writeFileSync(join(fixtureDir, "topic.md"), "验证 DeepSeek Harness 的内容制作与运营工作流。\n", { flag: "wx" });
}
if (!existsSync(join(fixtureDir, "script.md"))) {
  writeFileSync(join(fixtureDir, "script.md"), "这是隔离实验环境中的示例脚本。\n", { flag: "wx" });
}
const labOverlayPath = join(labDataDir, "overlay.json");
const labOverlay = existsSync(labOverlayPath)
  ? JSON.parse(readFileSync(labOverlayPath, "utf8"))
  : { schemaVersion: 1, items: {} };
labOverlay.libraryRoot = labLibraryRoot;
labOverlay.items ??= {};
labOverlay.items[fixtureId] ??= { readyToRecord: true };
labOverlay.items[fixtureId].publish ??= {
  bilibili: {
    status: "published",
    url: "https://example.invalid/creator-cockpit-lab",
    views: 1280,
    likes: 64,
    comments: 7,
    syncedAt: Date.parse("2026-08-15T12:00:00+08:00"),
  },
};
if (labOverlay.items[fixtureId].publish.bilibili?.status === "published") {
  labOverlay.items[fixtureId].publish.bilibili.publishedAt ??= Date.parse("2026-08-15T12:00:00+08:00");
}
writeFileSync(labOverlayPath, `${JSON.stringify(labOverlay, null, 2)}\n`, { mode: 0o600 });

const manifest = JSON.parse(readFileSync(join(sourceProfile, "package.json"), "utf8"));
manifest.scripts = {};
const profileDependencies = { ...(manifest.dependencies ?? {}) };
delete profileDependencies[LEGACY_PACKAGE_NAME];
manifest.dependencies = {
  ...profileDependencies,
  [PACKAGE_NAME]: `link:${repoRoot}`,
};
manifest.dsh ??= {};
manifest.dsh.profile ??= {};
const bundles = [
  ...(manifest.dsh.profile.bundles ?? [])
    .filter((packageName) => packageName !== LEGACY_PACKAGE_NAME && packageName !== PACKAGE_NAME),
  PACKAGE_NAME,
];
manifest.dsh.profile.bundles = bundles;
writeFileSync(join(labProfile, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const installationBundles = new Set(["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"]);
for (const packageName of bundles) {
  if (installationBundles.has(packageName)) continue;
  const target = packageName === PACKAGE_NAME
    ? repoRoot
    : requirePath(join(sourceProfile, "node_modules", ...packageName.split("/")), `profile bundle ${packageName}`);
  ensureLink(target, join(labModules, ...packageName.split("/")));
}

const metadata = {
  schemaVersion: 1,
  sourceHome,
  sourceProfile,
  localBundle: repoRoot,
  libraryRoot: labLibraryRoot,
  baselineCommit: "03f8d09ce9a298578ba850c0fc5dc3ff44b568ec",
  generatedAt: new Date().toISOString(),
};
writeFileSync(join(labHome, "lab-profile.json"), `${JSON.stringify(metadata, null, 2)}\n`);

process.stdout.write(`${labHome}\n`);
