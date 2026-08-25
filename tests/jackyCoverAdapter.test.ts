import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("Jacky Cover ZenMux adapter", () => {
  it("keeps the integration project-local and sends identity references to image edits", async () => {
    const source = await readFile(`${root}/scripts/generate_jacky_cover.py`, "utf8");
    const main = source.slice(source.indexOf("def main()"), source.indexOf('if __name__ == "__main__"'));

    expect(source).toContain("JACKY_COVER_SKILL_DIR");
    expect(source).toContain("jacky-reference-front.jpg");
    expect(source).toContain("Oil Cover style reference gallery");
    expect(source).toContain("/images/edits");
    expect(source).toContain("validate_jacky_run(args, work_dir, sidecars, refs)");
    expect(source).toContain('mode": "integrated_image_edit');
    expect(main).not.toContain("apply_creator_portrait_composites(");
  });

  it("ships the adapter in the npm package", async () => {
    const manifest = JSON.parse(await readFile(`${root}/package.json`, "utf8")) as { files?: string[] };
    expect(manifest.files).toContain("scripts/generate_jacky_cover.py");
  });
});
