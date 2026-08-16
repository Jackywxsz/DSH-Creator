import { closeSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const LEGACY_COLLECT_SPACE = "oil-collect-publish";

export interface CollectSpaceRecord {
  name: string;
  pid: number;
  startedAt: number;
}

export function defaultCollectSpaceName(): string {
  return `oil-collect-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function collectRegistryPath(root = homedir()): string {
  return join(root, ".dsh-oil-creator", "collect-spaces.json");
}

export function pidIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function parseCollectRegistry(raw: string): CollectSpaceRecord[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const record = row as { name?: unknown; pid?: unknown; startedAt?: unknown };
      if (typeof record.name !== "string" || record.name.trim() === "") return [];
      if (!Number.isInteger(record.pid)) return [];
      return [{
        name: record.name.trim(),
        pid: record.pid as number,
        startedAt: typeof record.startedAt === "number" ? record.startedAt : 0,
      }];
    });
  } catch {
    return [];
  }
}

export function loadCollectRegistry(filePath: string): CollectSpaceRecord[] {
  try {
    return parseCollectRegistry(readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

export function saveCollectRegistry(filePath: string, records: CollectSpaceRecord[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, filePath);
}

function acquireRegistryFileLock(filePath: string): () => void {
  const lockPath = `${filePath}.lock`;
  mkdirSync(dirname(filePath), { recursive: true });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const fd = openSync(lockPath, "wx");
      writeFileSync(fd, `${process.pid}\n`);
      return () => {
        try { closeSync(fd); } catch { /* already closed */ }
        try { unlinkSync(lockPath); } catch { /* already removed */ }
      };
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "EEXIST") throw cause;
      try {
        const pid = Number(readFileSync(lockPath, "utf8").trim());
        if (Number.isInteger(pid) && pid > 0 && !pidIsAlive(pid)) unlinkSync(lockPath);
      } catch {
        // retry
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  throw new Error(`collect space registry is busy: ${lockPath}`);
}

function withRegistryLock<T>(filePath: string, work: () => T): T {
  const release = acquireRegistryFileLock(filePath);
  try {
    return work();
  } finally {
    release();
  }
}

export function registerCollectSpace(filePath: string, record: CollectSpaceRecord): string[] {
  return withRegistryLock(filePath, () => {
    const existing = loadCollectRegistry(filePath);
    const stale = existing.filter((row) => row.name !== record.name && !pidIsAlive(row.pid));
    const live = existing.filter((row) => row.name !== record.name && pidIsAlive(row.pid));
    saveCollectRegistry(filePath, [...live, record]);
    return stale.map((row) => row.name);
  });
}

export function unregisterCollectSpace(filePath: string, name: string): void {
  withRegistryLock(filePath, () => {
    saveCollectRegistry(
      filePath,
      loadCollectRegistry(filePath).filter((row) => row.name !== name),
    );
  });
}

export function collectCleanupNames(options: {
  stale?: readonly string[];
  extra?: readonly string[];
  includeLegacy?: boolean;
}): string[] {
  const names = [
    ...(options.includeLegacy === false ? [] : [LEGACY_COLLECT_SPACE]),
    ...(options.stale ?? []),
    ...(options.extra ?? []),
  ];
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}
