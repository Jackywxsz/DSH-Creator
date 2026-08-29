import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const execFileAsync = promisify(execFile);

describe("Jacky Cover ZenMux adapter", () => {
  it("keeps the integration project-local and sends identity references to image edits", async () => {
    const source = await readFile(`${root}/scripts/generate_jacky_cover.py`, "utf8");
    const main = source.slice(source.indexOf("def main()"), source.indexOf('if __name__ == "__main__"'));

    expect(source).toContain("JACKY_COVER_SKILL_DIR");
    expect(source).toContain("jacky-reference-front.jpg");
    expect(source).toContain("STYLE_REFERENCE_LABEL = \"Oil Cover style reference gallery\"");
    expect(source).toContain('f"{STYLE_REFERENCE_LABEL} (Jacky Cover brand)"');
    expect(source).toContain("Input images: {STYLE_REFERENCE_LABEL} (Jacky Cover brand);");
    expect(source).toContain("/images/edits");
    expect(source).toContain("validate_jacky_run(args, work_dir, sidecars, refs)");
    expect(source).toContain('mode": "integrated_image_edit');
    expect(main).not.toContain("apply_creator_portrait_composites(");
  });

  it("ships the adapter in the npm package", async () => {
    const manifest = JSON.parse(await readFile(`${root}/package.json`, "utf8")) as { files?: string[] };
    expect(manifest.files).toContain("scripts/generate_jacky_cover.py");
  });

  it("does not let harmless canvas-edge wording trip the hand-contact validator", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "jacky-cover-adapter-"));
    const oilRoot = join(fixtureRoot, "oil-cover");
    const jackyRoot = join(fixtureRoot, "jacky-cover");
    await Promise.all([
      mkdir(join(oilRoot, "references"), { recursive: true }),
      mkdir(join(jackyRoot, "references"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(oilRoot, "references", "cover-rules.md"), "fixture"),
      writeFile(join(jackyRoot, "references", "visual-system.md"), "fixture"),
    ]);

    try {
      const script = join(root, "scripts", "generate_jacky_cover.py");
      const probe = [
        "import importlib.util, sys",
        "spec = importlib.util.spec_from_file_location('jacky_cover_adapter', sys.argv[1])",
        "module = importlib.util.module_from_spec(spec)",
        "spec.loader.exec_module(module)",
        "print(module.sanitize_canvas_edge_contact_language(sys.argv[2]))",
      ].join("; ");
      const unsafe = "Portrait integration guard: the outer shoulder or body may touch the right edge; the torso can naturally rest on the left canvas edge. A hand may touch the right canvas edge. Default to no hand contact with any panel edge.";
      const { stdout } = await execFileAsync("python3", ["-c", probe, script, unsafe], {
        env: {
          ...process.env,
          OIL_COVER_SKILL_DIR: oilRoot,
          JACKY_COVER_SKILL_DIR: jackyRoot,
          OIL_COVER_CONFIG: join(fixtureRoot, "missing-config.json"),
        },
      });

      expect(stdout).toContain("may align with the right canvas boundary");
      expect(stdout).toContain("may align with the left canvas boundary");
      expect(stdout).toContain("A hand may touch the right canvas edge");
      expect(stdout).not.toContain("may touch the right edge");
      expect(stdout).not.toContain("can naturally rest on the left canvas edge");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
