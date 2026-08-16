import { mkdir, rename, rmdir } from "node:fs/promises";
import { join } from "node:path";

import { pathExists } from "./artifacts.ts";
import { formatDay, readableTitle, scanLibrary } from "./catalog.ts";
import type {
  OrganizeMove,
  OrganizePreview,
  OrganizeReason,
  OverlayStore,
} from "./types.ts";

const DATED = /^(\d{4}-\d{2}-\d{2})_(.+)$/;
const CLIPBOARD = /^Clipboard-(\d{4})(\d{2})(\d{2})-(\d{6})(?:-(\d+))?$/i;
const SCREEN = /^录屏(\d{4})-(\d{2})-(\d{2})(?:[ _.-](.+))?$/;
const FEISHU = /^飞书(\d{4})(\d{2})(\d{2})(?:-(\d+))?$/;
const CN_DATE = /^(\d{1,2})月(\d{1,2})日$/;
const STAGING = ".oil-organize-tmp";

export function inferDateFromName(folderName: string, recordedAt: Date): string {
  const dated = DATED.exec(folderName);
  if (dated?.[1] !== undefined) return dated[1];
  const clip = CLIPBOARD.exec(folderName);
  if (clip !== null && clip[1] !== undefined && clip[2] !== undefined && clip[3] !== undefined) {
    return `${clip[1]}-${clip[2]}-${clip[3]}`;
  }
  const rec = SCREEN.exec(folderName);
  if (rec !== null && rec[1] !== undefined && rec[2] !== undefined && rec[3] !== undefined) {
    return `${rec[1]}-${rec[2]}-${rec[3]}`;
  }
  const feishu = FEISHU.exec(folderName);
  if (feishu !== null && feishu[1] !== undefined && feishu[2] !== undefined && feishu[3] !== undefined) {
    return `${feishu[1]}-${feishu[2]}-${feishu[3]}`;
  }
  const cn = CN_DATE.exec(folderName);
  if (cn !== null && cn[1] !== undefined && cn[2] !== undefined) {
    return `${recordedAt.getFullYear()}-${cn[1].padStart(2, "0")}-${cn[2].padStart(2, "0")}`;
  }
  return formatDay(recordedAt);
}

export function inferTitleFromName(folderName: string): string {
  const dated = DATED.exec(folderName);
  if (dated?.[2] !== undefined) return readableTitle(dated[2]);
  const clip = CLIPBOARD.exec(folderName);
  if (clip !== null && clip[4] !== undefined) return readableTitle(`Clipboard ${clip[4]}`);
  const rec = SCREEN.exec(folderName);
  if (rec !== null) {
    return rec[4] === undefined ? "录屏" : readableTitle(`录屏 ${rec[4]}`);
  }
  const feishu = FEISHU.exec(folderName);
  if (feishu !== null) {
    return feishu[4] === undefined ? "飞书" : readableTitle(`飞书 ${feishu[4]}`);
  }
  return readableTitle(folderName);
}

export function proposedFolderName(folderName: string, recordedAt: Date): string {
  const date = inferDateFromName(folderName, recordedAt);
  const title = inferTitleFromName(folderName);
  return `${date}_${title === "" ? "未命名" : title}`;
}

function reasonOf(from: string, to: string): OrganizeReason {
  const dated = DATED.exec(from);
  const dateChanged = dated?.[1] !== to.slice(0, 10);
  const fromTitle = dated?.[2] ?? from;
  const toTitle = to.slice(11);
  const titleChanged = readableTitle(fromTitle) !== fromTitle || fromTitle !== toTitle;
  if (dateChanged && titleChanged) return "both";
  if (dateChanged) return "add-date";
  return "readable-title";
}

function uniqueName(base: string, used: Set<string>): string {
  let suffix = 2;
  let next = `${base}-${suffix}`;
  while (used.has(next)) {
    suffix += 1;
    next = `${base}-${suffix}`;
  }
  return next;
}

export function proposeOrganizeMoves(
  items: ReadonlyArray<{ id: string; recordedAt: number }>,
  ids: readonly string[] = [],
): OrganizePreview {
  const selected = ids.length === 0 ? items : items.filter((item) => ids.includes(item.id));
  const used = new Set(items.map((item) => item.id));
  const moves: OrganizeMove[] = [];
  let unchanged = items.length - selected.length;

  for (const item of selected) {
    const target = proposedFolderName(item.id, new Date(item.recordedAt));
    if (target !== item.id) used.delete(item.id);
  }

  for (const item of selected) {
    let target = proposedFolderName(item.id, new Date(item.recordedAt));
    if (target === item.id) {
      unchanged += 1;
      continue;
    }
    if (used.has(target)) target = uniqueName(target, used);
    used.add(target);
    moves.push({ from: item.id, to: target, reason: reasonOf(item.id, target) });
  }

  return { moves, unchanged };
}

export function remapOverlayItems(overlay: OverlayStore, moves: readonly OrganizeMove[]): OverlayStore {
  if (moves.length === 0) return overlay;
  const map = new Map(moves.map((move) => [move.from, move.to]));
  const items: OverlayStore["items"] = {};
  for (const [id, item] of Object.entries(overlay.items)) {
    items[map.get(id) ?? id] = item;
  }
  return { ...overlay, items };
}

export async function previewOrganize(
  libraryRoot: string,
  overlay: OverlayStore,
  ids: readonly string[] = [],
): Promise<OrganizePreview> {
  const items = await scanLibrary(libraryRoot, overlay);
  return proposeOrganizeMoves(items, ids);
}

export async function applyOrganize(
  libraryRoot: string,
  overlay: OverlayStore,
  ids: readonly string[] = [],
): Promise<{ preview: OrganizePreview; overlay: OverlayStore }> {
  const preview = await previewOrganize(libraryRoot, overlay, ids);
  if (preview.moves.length === 0) {
    return { preview, overlay };
  }

  const staging = join(libraryRoot, STAGING);
  await mkdir(staging, { recursive: true });
  try {
    for (const move of preview.moves) {
      await rename(join(libraryRoot, move.from), join(staging, move.from));
    }
    for (const move of preview.moves) {
      await rename(join(staging, move.from), join(libraryRoot, move.to));
    }
  } catch (cause) {
    for (const move of preview.moves) {
      const staged = join(staging, move.from);
      const original = join(libraryRoot, move.from);
      if (await pathExists(staged) && !(await pathExists(original))) {
        await rename(staged, original).catch(() => undefined);
      }
    }
    throw cause;
  } finally {
    await rmdir(staging).catch(() => undefined);
  }

  return { preview, overlay: remapOverlayItems(overlay, preview.moves) };
}
