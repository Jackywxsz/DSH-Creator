import { cpSync, existsSync, lstatSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import Schema from "@deepseek-ai/schemastery";

export interface Config {
  libraryRoot: string;
  dataDir: string;
  cockpitDataDir: string;
  subtitleSkillDir: string;
  coverSkillDir: string;
}

export function defaultLibraryRoot(platform: NodeJS.Platform = process.platform): string {
  const videos = platform === "darwin" ? "Movies" : "Videos";
  return join(homedir(), videos, "视频项目");
}

export function defaultDataDir(home = homedir()): string {
  return join(home, ".jacky-creator");
}

export function defaultCockpitDataDir(home = homedir()): string {
  return join(defaultDataDir(home), "operations");
}

export function legacyDataDir(home = homedir()): string {
  return join(home, ".dsh-oil-creator");
}

export function legacyCockpitDataDir(home = homedir()): string {
  return join(home, ".dsh-creator-cockpit-lab");
}

export function copyLegacyStateDirectory(source: string, target: string): boolean {
  if (source === target || existsSync(target) || !existsSync(source)) return false;
  const sourceStat = lstatSync(source);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) return false;
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, {
    recursive: true,
    force: false,
    errorOnExist: true,
  });
  return true;
}

export function migrateLegacyDefaultState(config: Config, home = homedir()): string[] {
  const migrated: string[] = [];
  if (resolveDataDir(config) === defaultDataDir(home)
    && copyLegacyStateDirectory(legacyDataDir(home), defaultDataDir(home))) {
    migrated.push(defaultDataDir(home));
  }
  if (resolveCockpitDataDir(config) === defaultCockpitDataDir(home)
    && copyLegacyStateDirectory(legacyCockpitDataDir(home), defaultCockpitDataDir(home))) {
    migrated.push(defaultCockpitDataDir(home));
  }
  return migrated;
}

export function defaultSubtitleSkillDir(): string {
  return join(homedir(), ".claude", "skills", "oil-subtitle");
}

export function defaultCoverSkillDir(): string {
  return join(homedir(), ".claude", "skills", "oil-cover");
}

export function skillDirCandidates(skillName: string, home = homedir()): string[] {
  return [
    join(home, ".dsh", "skills", skillName),
    join(home, ".agents", "skills", skillName),
    join(home, ".claude", "skills", skillName),
    join(home, ".codex", "skills", skillName),
    join(home, ".grok", "skills", skillName),
  ];
}

function joinUnderHome(home: string, rest: string): string {
  return join(home, ...rest.replaceAll("\\", "/").split("/").filter(Boolean));
}

export function expandHomePath(path: string, home = homedir()): string {
  const trimmed = path.trim();
  if (trimmed === "~" || trimmed === "%USERPROFILE%" || trimmed === "%HOME%") return home;
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) return joinUnderHome(home, trimmed.slice(2));
  const windowsHome = /^%(?:USERPROFILE|HOME)%([\\/].*)?$/i.exec(trimmed);
  if (windowsHome !== null) {
    const rest = windowsHome[1];
    return rest === undefined || rest === "" ? home : joinUnderHome(home, rest);
  }
  return trimmed;
}

/** @deprecated Use {@link defaultLibraryRoot}. Kept so existing imports keep working. */
export const DEFAULT_LIBRARY_ROOT = defaultLibraryRoot();

export const Config: Schema<Config> = Schema.object({
  libraryRoot: Schema.string().default(defaultLibraryRoot()),
  dataDir: Schema.string().default(defaultDataDir()),
  cockpitDataDir: Schema.string().default(defaultCockpitDataDir()),
  subtitleSkillDir: Schema.string().default(""),
  coverSkillDir: Schema.string().default(""),
});

export function resolveDataDir(config: Config): string {
  return config.dataDir === "" ? defaultDataDir() : config.dataDir;
}

export function resolveCockpitDataDir(config: Config): string {
  return config.cockpitDataDir === "" ? defaultCockpitDataDir() : config.cockpitDataDir;
}

export function resolveConfiguredPath(configured: string, fallback: string, envValue?: string): string {
  if (configured.trim() !== "") return configured;
  if (envValue !== undefined && envValue.trim() !== "") return envValue;
  return fallback;
}

export function resolveSkillDir(
  configured: string,
  skillName: string,
  envValue?: string,
): string {
  if (configured.trim() !== "") return expandHomePath(configured);
  if (envValue !== undefined && envValue.trim() !== "") return expandHomePath(envValue);
  return skillDirCandidates(skillName).find((candidate) => existsSync(candidate))
    ?? skillDirCandidates(skillName)[0]!;
}
