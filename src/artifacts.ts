import { readdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";

export const ARTICLE_DIR = "公众号文章";
export const PUBLISH_NAME = "publish-package.json";
export const TOPIC_NAME = "topic.md";
export const SCRIPT_NAME = "script.md";

const DATED = /^(\d{4}-\d{2}-\d{2})_(.+)$/;
const SKIP_TOP = new Set([ARTICLE_DIR, TOPIC_NAME, ".DS_Store"]);

export interface ArtifactMove {
  from: string;
  to: string;
}

export function hyphenatedFolderName(folderName: string): string {
  const matched = DATED.exec(folderName);
  if (matched?.[1] !== undefined && matched[2] !== undefined) {
    return `${matched[1]}_${matched[2].replace(/ /g, "-")}`;
  }
  return folderName.replace(/ /g, "-");
}

export function isPublishPackageName(name: string): boolean {
  if (name.includes("auto-publish")) return false;
  if (name.startsWith("publish-package-")) return false;
  if (name.startsWith("publish_package_")) return false;
  if (name.includes("_test.video-publisher")) return false;
  return name === PUBLISH_NAME
    || name === "publisher-package.json"
    || name === "video-publisher-package.json"
    || name.endsWith(".publish-package.json")
    || name.endsWith("_publish-package.json")
    || name.endsWith(".video-publisher.json")
    || name.endsWith(".publisher-package.json")
    || name.endsWith(".publish.json");
}

export function pickPublishPackage(names: readonly string[]): string | undefined {
  if (names.includes(PUBLISH_NAME)) return PUBLISH_NAME;
  const candidates = names.filter((name) => isPublishPackageName(name));
  if (candidates.length === 0) return undefined;
  const score = (name: string): number => {
    if (name.endsWith(".publish-package.json") || name.endsWith("_publish-package.json")) return 3;
    if (name.includes("publisher-package")) return 2;
    if (name.includes("video-publisher")) return 1;
    return 0;
  };
  return [...candidates].sort((left, right) => score(right) - score(left))[0];
}

export function isDraftArticleName(name: string): boolean {
  return /\.(source|wechat|processed|source-check)(\.|$)/.test(name)
    || /_(source|processed|source-check)\.md$/.test(name);
}

export function pickArticleFile(names: readonly string[]): string | undefined {
  const markdown = names.filter((name) => name.endsWith(".md"));
  const main = markdown.filter((name) => !isDraftArticleName(name));
  return main[0] ?? markdown[0];
}

export function isSubtitledVideoName(name: string): boolean {
  return name.includes("_subtitled") || name.includes("_带字幕") || name.includes("subtitled");
}

export function proposedPrefixRename(folderName: string, name: string): string | undefined {
  if (SKIP_TOP.has(name) || name.startsWith(".")) return undefined;
  const hyphen = hyphenatedFolderName(folderName);
  if (hyphen === folderName) return undefined;
  if (name === hyphen || name.startsWith(`${hyphen}.`) || name.startsWith(`${hyphen}_`)) {
    return `${folderName}${name.slice(hyphen.length)}`;
  }
  return undefined;
}

export function proposeArtifactMoves(folderName: string, names: readonly string[]): ArtifactMove[] {
  const used = new Set(names);
  const moves: ArtifactMove[] = [];
  for (const name of names) {
    const next = proposedPrefixRename(folderName, name);
    if (next === undefined || next === name) continue;
    if (used.has(next)) continue;
    used.delete(name);
    used.add(next);
    moves.push({ from: name, to: next });
  }
  const after = names.map((name) => {
    const move = moves.find((item) => item.from === name);
    return move === undefined ? name : move.to;
  });
  if (!after.includes(PUBLISH_NAME)) {
    const picked = pickPublishPackage(after);
    if (picked !== undefined && picked !== PUBLISH_NAME && !used.has(PUBLISH_NAME)) {
      const original = moves.find((item) => item.to === picked)?.from ?? picked;
      const existing = moves.find((item) => item.from === original);
      if (existing !== undefined) existing.to = PUBLISH_NAME;
      else moves.push({ from: original, to: PUBLISH_NAME });
    }
  }
  return moves;
}

export async function applyArtifactMoves(
  folderPath: string,
  folderName: string,
): Promise<ArtifactMove[]> {
  const names = await readdir(folderPath);
  const moves = proposeArtifactMoves(folderName, names);
  for (const move of moves) {
    await rename(join(folderPath, move.from), join(folderPath, move.to));
  }
  return moves;
}

export async function normalizeLibraryArtifacts(libraryRoot: string): Promise<{
  folders: number;
  moves: number;
}> {
  const entries = await readdir(libraryRoot, { withFileTypes: true });
  let folders = 0;
  let moves = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    if (entry.name === ARTICLE_DIR) continue;
    const applied = await applyArtifactMoves(join(libraryRoot, entry.name), entry.name);
    folders += 1;
    moves += applied.length;
  }
  return { folders, moves };
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
