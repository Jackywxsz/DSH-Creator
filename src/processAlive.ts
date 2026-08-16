import { execFileSync } from "node:child_process";

export function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function pidCommand(pid: number): string | undefined {
  if (!pidAlive(pid)) return undefined;
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
      timeout: 500,
    }).trim();
  } catch {
    return undefined;
  }
}

export function pidLooksLike(pid: number, fragment: string): boolean {
  const command = pidCommand(pid);
  if (command === undefined) return false;
  return command.includes(fragment);
}

export function jobPidMatches(pid: number | undefined, fragments: readonly string[]): boolean {
  if (pid === undefined) return false;
  if (!pidAlive(pid)) return false;
  const command = pidCommand(pid);
  if (command === undefined) return true;
  return fragments.some((fragment) => command.includes(fragment));
}

export function jobPidStillOurs(pid: number | undefined, fragment: string): boolean {
  return jobPidMatches(pid, [fragment]);
}
