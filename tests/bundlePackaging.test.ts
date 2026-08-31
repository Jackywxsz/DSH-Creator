import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

function parsePackMetadata(output: string) {
  const jsonMatch = output.match(/(?:^|\n)\[\s*\{/);
  if (!jsonMatch || jsonMatch.index === undefined) {
    throw new Error(`npm pack did not return JSON:\n${output}`);
  }
  const jsonStart = jsonMatch.index + (output[jsonMatch.index] === "\n" ? 1 : 0);
  return JSON.parse(output.slice(jsonStart)) as Array<{
    filename?: string;
    files?: Array<{ path: string }>;
  }>;
}

describe("DeepSeek Harness bundle packaging", () => {
  it("owns the sidebar replacement in the bundle layer", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf8"),
    ) as {
      name?: string;
      version?: string;
      files?: string[];
      scripts?: Record<string, string>;
      engines?: { node?: string };
      dsh?: {
        bundle?: { patch?: string };
        client?: { inject?: string[] };
      };
      peerDependencies?: Record<string, string>;
      repository?: { type?: string; url?: string };
      bugs?: { url?: string };
      homepage?: string;
    };
    const patch = readFileSync(resolve(root, "cordis.patch.yml"), "utf8");
    const copyInplace = readFileSync(
      resolve(root, "scripts/copy-inplace.mjs"),
      "utf8",
    );
    const releaseCheck = readFileSync(
      resolve(root, "scripts/check-release.mjs"),
      "utf8",
    );

    expect(manifest.name).toBe("jacky-creator");
    expect(manifest.version).toBe("0.1.0-beta.6");
    expect(manifest.dsh?.bundle?.patch).toBe("./cordis.patch.yml");
    expect(manifest.files).toContain("cordis.patch.yml");
    expect(manifest.files).toContain("README.md");
    expect(manifest.files).toContain("assets/readme/hero.png");
    expect(manifest.files).toContain("BRAND_ASSETS.md");
    expect(manifest.files).toContain("SECURITY.md");
    expect(manifest.files).toContain("LICENSE");
    expect(manifest.files).toEqual(expect.arrayContaining([
      "docs/installation.md",
      "docs/usage.md",
      "docs/files.md",
    ]));
    expect(manifest.files).not.toContain("docs/*.md");
    expect(manifest.scripts?.prepare).toBe("npm run build");
    expect(manifest.scripts?.["release:check"]).toBe(
      "node scripts/check-release.mjs",
    );
    expect(manifest.engines?.node).toBe(">=22.19.0");
    expect(manifest.repository).toEqual({
      type: "git",
      url: "git+https://github.com/Jackywxsz/DSH-Creator.git",
    });
    expect(manifest.bugs?.url).toBe(
      "https://github.com/Jackywxsz/DSH-Creator/issues",
    );
    expect(manifest.homepage).toBe(
      "https://github.com/Jackywxsz/DSH-Creator#readme",
    );
    expect(manifest.dsh?.client?.inject).toEqual(expect.arrayContaining([
      "@deepseek-ai/dsh-client-ui-settings",
      "@deepseek-ai/dsh-client-ui-settings-plugins",
    ]));
    expect(manifest.peerDependencies?.["@deepseek-ai/dsh-settings"])
      .toContain("0.1.1-rc.2");
    expect(manifest.peerDependencies?.["@deepseek-ai/dsh-client-ui-settings-plugins"])
      .toContain("0.1.1-rc.2");
    expect(patch).toMatch(/^- id: ui-sidebar\n  disabled: true$/m);
    expect(patch).toMatch(/^- insert:\n    - id: jacky-creator\n      name: jacky-creator$/m);
    expect(copyInplace).not.toContain(".dsh/profiles");
    expect(copyInplace).toContain("libDirectory");
    expect(releaseCheck).toContain('run(root, "pnpm", ["check"])');
    expect(releaseCheck).toContain(
      '"pack", "--dry-run", "--ignore-scripts", "--json"',
    );
  });

  it("documents installation through dsh plugin instead of profile edits", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    const installation = readFileSync(
      resolve(root, "docs/installation.md"),
      "utf8",
    );
    const implementation = readFileSync(
      resolve(root, "docs/implementation.md"),
      "utf8",
    );

    for (const document of [readme, installation, implementation]) {
      expect(document).toContain(
        "dsh plugin --profile web add jacky-creator",
      );
    }
    expect(readme).toContain("dsh plugin --profile web add dsh-plugin");
    expect(readme).toContain(
      "dsh plugin --profile web add https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.6/jacky-creator-0.1.0-beta.6.tgz",
    );
    expect(readme).not.toContain("dsh plugin remove dsh-oil-creator");
    expect(implementation).toContain("dsh.bundle.patch");
    expect(implementation).not.toContain(
      "`~/.dsh/profiles/web/package.json` 里的 `file:` 依赖",
    );
  });

  it("keeps README assets and runtime files in the real npm tarball", () => {
    const packDirectory = mkdtempSync(join(tmpdir(), "jacky-creator-pack-"));
    const npmCache = mkdtempSync(join(tmpdir(), "jacky-creator-npm-cache-"));
    const runtimeFiles = [
      "lib/index.js",
      "lib/client.js",
      "lib/typert.host.js",
      "lib/collect-publish.mjs",
    ];

    try {
      const output = execFileSync(
        "npm",
        [
          "pack",
          "--json",
          "--pack-destination",
          packDirectory,
        ],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, npm_config_cache: npmCache },
        },
      );
      const metadata = parsePackMetadata(output);
      const filename = metadata[0]?.filename;
      expect(filename).toBe("jacky-creator-0.1.0-beta.6.tgz");

      const tarball = resolve(packDirectory, filename!);
      expect(existsSync(tarball)).toBe(true);

      const entries = execFileSync("tar", ["-tzf", tarball], {
        encoding: "utf8",
      })
        .trim()
        .split("\n")
        .map((entry) => entry.replace(/^package\//, ""));
      const packedFiles = new Set(entries);

      expect([...packedFiles]).toEqual(expect.arrayContaining([
        "README.md",
        "assets/readme/hero.png",
        "docs/installation.md",
        "docs/usage.md",
        "docs/files.md",
        "BRAND_ASSETS.md",
        "CONTRIBUTING.md",
        "SECURITY.md",
        "LICENSE",
        "cordis.patch.yml",
        "lib/index.js",
        "lib/client.js",
        "lib/typert.host.js",
        "lib/collect-publish.mjs",
        "scripts/generate_jacky_cover.py",
      ]));
      expect(
        [...packedFiles].some((entry) => entry.startsWith("assets/readme/source/")),
      ).toBe(false);
      expect([...packedFiles].some((entry) => entry.endsWith(".map"))).toBe(false);
      expect(readFileSync(resolve(root, "lib/client.js"), "utf8"))
        .not.toContain("sourceMappingURL=");
      const internalDocs = [
        "docs/adversarial-review.md",
        "docs/cockpit-design.md",
        "docs/creator-cockpit.md",
        "docs/distribution.md",
        "docs/implementation.md",
        "docs/lab-development.md",
      ];
      expect(
        [...packedFiles].filter((entry) => internalDocs.includes(entry)),
      ).toEqual([]);
    } finally {
      rmSync(packDirectory, { recursive: true, force: true });
      rmSync(npmCache, { recursive: true, force: true });
    }
  });
});
