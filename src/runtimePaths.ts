import { homedir } from "node:os";
import { join } from "node:path";

import { pathExists } from "./artifacts.ts";

export function venvPythonCandidates(
  skillDir: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  if (platform === "win32") {
    return [
      join(skillDir, ".venv", "Scripts", "python.exe"),
      join(skillDir, ".venv", "Scripts", "python3.exe"),
    ];
  }
  return [
    join(skillDir, ".venv", "bin", "python3"),
    join(skillDir, ".venv", "bin", "python"),
  ];
}

export function systemPythonCommand(platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? "python" : "python3";
}

export async function resolveVenvPython(
  skillDir: string,
  platform: NodeJS.Platform = process.platform,
): Promise<string | undefined> {
  for (const path of venvPythonCandidates(skillDir, platform)) {
    if (await pathExists(path)) return path;
  }
  return undefined;
}

export function pathEnvValue(env: NodeJS.ProcessEnv): string {
  const path = env.PATH ?? env.Path;
  return typeof path === "string" ? path : "";
}

export function extraBinDirs(
  platform: NodeJS.Platform,
  home = homedir(),
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const dirs = [join(home, ".local", "bin"), join(home, "bin")];
  if (platform === "win32") {
    const local = env.LOCALAPPDATA ?? env.LocalAppData ?? join(home, "AppData", "Local");
    dirs.push(join(local, "Programs"));
    return dirs;
  }
  if (home === homedir()) {
    dirs.push("/usr/local/bin", "/opt/homebrew/bin");
  }
  return dirs;
}

export function egoInstallCandidates(
  platform: NodeJS.Platform,
  home = homedir(),
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (platform === "darwin") {
    const local = [
      join(home, "Applications", "ego lite.app"),
      join(home, "Applications", "Ego Lite.app"),
    ];
    if (home !== homedir()) return local;
    return [
      "/Applications/ego lite.app",
      "/Applications/Ego Lite.app",
      ...local,
    ];
  }
  if (platform === "win32") {
    const local = env.LOCALAPPDATA ?? env.LocalAppData ?? join(home, "AppData", "Local");
    const programFiles = env.ProgramFiles ?? "C:\\Program Files";
    const programFilesX86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    return [
      join(local, "Programs", "ego lite", "ego-browser.exe"),
      join(local, "Programs", "Ego Lite", "ego-browser.exe"),
      join(programFiles, "ego lite", "ego-browser.exe"),
      join(programFiles, "Ego Lite", "ego-browser.exe"),
      join(programFilesX86, "ego lite", "ego-browser.exe"),
    ];
  }
  return [];
}
