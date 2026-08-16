import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  applyOrganize,
  inferDateFromName,
  inferTitleFromName,
  proposeOrganizeMoves,
  proposedFolderName,
  remapOverlayItems,
} from "../src/organize.ts";
import { emptyOverlay } from "../src/overlay.ts";
import { scanLibrary } from "../src/catalog.ts";

describe("proposedFolderName", () => {
  it("keeps an existing date and spaces a hyphen title", () => {
    expect(proposedFolderName("2025-09-21_去-ai-味儿", new Date(2026, 7, 15))).toBe(
      "2025-09-21_去 ai 味儿",
    );
  });

  it("reads clipboard and screen-recording dates from the name", () => {
    expect(inferDateFromName("Clipboard-20260808-052928-976", new Date(2020, 0, 1))).toBe("2026-08-08");
    expect(inferTitleFromName("Clipboard-20260808-052928-976")).toBe("Clipboard 052928");
    expect(proposedFolderName("录屏2026-03-27 18.12.42", new Date(2020, 0, 1))).toBe(
      "2026-03-27_录屏 18.12.42",
    );
  });

  it("uses mtime for an undated readable title", () => {
    expect(proposedFolderName("DeepSeek Harness 安装上手和使用心得", new Date(2026, 7, 14))).toBe(
      "2026-08-14_DeepSeek Harness 安装上手和使用心得",
    );
  });
});

describe("proposeOrganizeMoves", () => {
  it("labels undated readable titles as add-date", () => {
    const preview = proposeOrganizeMoves([
      { id: "DeepSeek Harness", recordedAt: new Date(2026, 7, 14).getTime() },
    ]);
    expect(preview.moves).toEqual([
      { from: "DeepSeek Harness", to: "2026-08-14_DeepSeek Harness", reason: "add-date" },
    ]);
  });

  it("skips folders that already match", () => {
    const preview = proposeOrganizeMoves([
      { id: "2026-08-14_DeepSeek Harness", recordedAt: Date.UTC(2026, 7, 14) },
    ]);
    expect(preview.moves).toEqual([]);
    expect(preview.unchanged).toBe(1);
  });

  it("avoids colliding with a folder that stays", () => {
    const preview = proposeOrganizeMoves([
      { id: "去-ai-味儿", recordedAt: new Date(2025, 8, 21).getTime() },
      { id: "2025-09-21_去 ai 味儿", recordedAt: new Date(2025, 8, 21).getTime() },
    ]);
    expect(preview.moves).toHaveLength(1);
    expect(preview.moves[0]?.from).toBe("去-ai-味儿");
    expect(preview.moves[0]?.to).toBe("2025-09-21_去 ai 味儿-2");
  });
});

describe("remapOverlayItems", () => {
  it("keeps later overlay writes that arrived under the old folder id", () => {
    const remapped = remapOverlayItems({
      schemaVersion: 1,
      items: {
        "旧目录": { title: "旧" },
        "另一期": { title: "别动" },
      },
    }, [{ from: "旧目录", to: "2026-08-16_新目录", reason: "add-date" }]);
    expect(remapped.items["2026-08-16_新目录"]?.title).toBe("旧");
    expect(remapped.items["另一期"]?.title).toBe("别动");
    expect(remapped.items["旧目录"]).toBeUndefined();
  });
});

describe("applyOrganize", () => {
  it("renames folders and leaves files inside", async () => {
    const root = await mkdtemp(join(tmpdir(), "oil-organize-"));
    const folder = join(root, "2025-09-21_去-ai-味儿");
    await mkdir(folder);
    await writeFile(join(folder, "clip.mp4"), "video");
    const result = await applyOrganize(root, emptyOverlay());
    expect(result.preview.moves).toEqual([
      { from: "2025-09-21_去-ai-味儿", to: "2025-09-21_去 ai 味儿", reason: "readable-title" },
    ]);
    const names = await readdir(root);
    expect(names).toEqual(["2025-09-21_去 ai 味儿"]);
    const items = await scanLibrary(root, emptyOverlay());
    expect(items[0]?.title).toBe("去 ai 味儿");
    expect(items[0]?.videoRaw?.endsWith("clip.mp4")).toBe(true);
  });
});
