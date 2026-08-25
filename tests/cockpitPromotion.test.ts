import { mkdir, mkdtemp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateCreatedContentPath } from "../src/cockpit/promotion.ts";

describe("Creator Cockpit promotion path validation", () => {
  it("accepts a real child and rejects traversal outside the library root", async () => {
    const parent = await mkdtemp(join(tmpdir(), "cockpit-promotion-"));
    const root = join(parent, "library");
    const child = join(root, "2026-08-24_demo");
    const outside = join(parent, "outside");
    await Promise.all([mkdir(child, { recursive: true }), mkdir(outside)]);
    await expect(validateCreatedContentPath(root, child)).resolves.toBeUndefined();
    await expect(validateCreatedContentPath(root, outside)).rejects.toThrow("escaped");
  });

  it("rejects a symlink directory even when its target is inside the library", async () => {
    const root = await mkdtemp(join(tmpdir(), "cockpit-promotion-symlink-"));
    const target = join(root, "target");
    const link = join(root, "link");
    await mkdir(target);
    await symlink(target, link);
    await expect(validateCreatedContentPath(root, link)).rejects.toThrow("real directory");
  });
});
