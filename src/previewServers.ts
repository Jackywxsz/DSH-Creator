import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { jobPidStillOurs, pidAlive } from "./processAlive.ts";

export interface PreviewServerRecord {
  id: string;
  url: string;
  port: number;
  pid: number;
  startedAt: number;
}

export function previewRegistryPath(root = homedir()): string {
  return join(root, ".dsh-oil-creator", "preview-servers.json");
}

export function previewRegistryPathForDataDir(dataDir: string): string {
  return join(dataDir, "preview-servers.json");
}

export function parsePreviewRegistry(raw: string): PreviewServerRecord[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const record = row as Record<string, unknown>;
      if (typeof record.id !== "string" || record.id.trim() === "") return [];
      if (typeof record.url !== "string" || typeof record.port !== "number") return [];
      if (!Number.isInteger(record.pid)) return [];
      return [{
        id: record.id,
        url: record.url,
        port: record.port,
        pid: record.pid as number,
        startedAt: typeof record.startedAt === "number" ? record.startedAt : 0,
      }];
    });
  } catch {
    return [];
  }
}

export function loadPreviewRegistry(filePath: string): PreviewServerRecord[] {
  try {
    return parsePreviewRegistry(readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

export function savePreviewRegistry(filePath: string, records: PreviewServerRecord[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, filePath);
}

export function livePreviewRecord(records: readonly PreviewServerRecord[], id: string): PreviewServerRecord | undefined {
  return records.find((row) => row.id === id && jobPidStillOurs(row.pid, "preview_editor"));
}

export function upsertPreviewRecord(filePath: string, record: PreviewServerRecord): void {
  const next = loadPreviewRegistry(filePath).filter((row) => row.id !== record.id && pidAlive(row.pid));
  next.push(record);
  savePreviewRegistry(filePath, next);
}

export function removePreviewRecord(filePath: string, id: string): void {
  savePreviewRegistry(filePath, loadPreviewRegistry(filePath).filter((row) => row.id !== id));
}
