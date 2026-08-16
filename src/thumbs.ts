import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type { CoverThumbResult } from "./types.ts";

function thumbName(id: string, sourcePath: string): string {
  const digest = createHash("sha1").update(sourcePath).digest("hex").slice(0, 10);
  return `${id.replace(/[^\w.-]+/g, "_")}-${digest}.jpg`;
}

export async function coverThumb(
  dataDir: string,
  id: string,
  sourcePath: string | undefined,
): Promise<CoverThumbResult> {
  const empty = { found: false, mime: "", base64: "" };
  if (sourcePath === undefined) return empty;
  const source = await stat(sourcePath).catch(() => undefined);
  if (source === undefined || !source.isFile()) return empty;

  const dir = join(dataDir, "thumbs");
  await mkdir(dir, { recursive: true });
  const dest = join(dir, thumbName(id, sourcePath));
  const cached = await stat(dest).catch(() => undefined);
  if (cached === undefined || cached.mtimeMs < source.mtimeMs) {
    const result = spawnSync("sips", [
      "-s",
      "format",
      "jpeg",
      "-Z",
      "360",
      sourcePath,
      "--out",
      dest,
    ], { encoding: "utf8" });
    if (result.status !== 0) return empty;
  }

  try {
    const bytes = await readFile(dest);
    return { found: true, mime: "image/jpeg", base64: bytes.toString("base64") };
  } catch {
    return empty;
  }
}
