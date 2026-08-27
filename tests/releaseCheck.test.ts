import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const releaseCheck = resolve(root, "scripts/check-release.mjs");
const buildScript = "tsdown && node scripts/copy-inplace.mjs scripts/collect-publish.mjs lib/collect-publish.mjs";
const REQUIRED_CHAIN_FILES = [
  "src/creatorSkill.ts",
  "src/capabilities.ts",
  "src/guide.ts",
  "src/platforms.ts",
  "src/client/publishPlatforms.ts",
  "src/settingsContract.ts",
  "src/settingsHost.ts",
  "src/client/settingsSlot.ts",
  "src/client/nativePaths.ts",
  "src/client/presentationInstruction.ts",
  "tests/creatorSkill.test.ts",
  "tests/capabilities.test.ts",
  "tests/guide.test.ts",
  "tests/platforms.test.ts",
  "tests/creatorSettings.test.ts",
  "tests/contentInspector.test.ts",
  "tests/settingsHost.test.ts",
  "tests/settingsSlot.test.ts",
  "tests/nativePaths.test.ts",
  "tests/presentationInstruction.test.ts",
];

function git(repository: string, ...args: string[]) {
  execFileSync("git", args, { cwd: repository, stdio: "ignore" });
}

function createRepository() {
  const repository = mkdtempSync(join(tmpdir(), "jacky-creator-release-"));
  const version = "0.1.0";
  const installUrl = `https://github.com/Jackywxsz/DSH-Creator/releases/download/v${version}/jacky-creator-${version}.tgz`;
  const files = new Map<string, string>([
    ["package.json", JSON.stringify({
      name: "jacky-creator",
      version,
      repository: {
        type: "git",
        url: "git+https://github.com/Jackywxsz/DSH-Creator.git",
      },
      bugs: { url: "https://github.com/Jackywxsz/DSH-Creator/issues" },
      homepage: "https://github.com/Jackywxsz/DSH-Creator#readme",
      packageManager: "pnpm@10.16.1",
      main: "./lib/index.js",
      exports: { ".": "./lib/index.js" },
      files: [
        "lib/index.js",
        "lib/client.js",
        "lib/typert.host.js",
        "lib/collect-publish.mjs",
        "cordis.patch.yml",
        "README.md",
        "assets/readme/hero.png",
        "docs/installation.md",
        "docs/usage.md",
        "docs/files.md",
        "BRAND_ASSETS.md",
        "CONTRIBUTING.md",
        "SECURITY.md",
      ],
      dsh: { bundle: { patch: "./cordis.patch.yml" } },
      scripts: {
        build: buildScript,
        prepare: "npm run build",
        typecheck: "tsc --noEmit",
        check: "pnpm typecheck && pnpm test && pnpm build",
        test: "vitest run",
        "release:check": "node scripts/check-release.mjs",
      },
    }, null, 2)],
    ["pnpm-lock.yaml", "lockfileVersion: '9.0'\n"],
    ["cordis.patch.yml", "- id: ui-sidebar\n  disabled: true\n- insert:\n    - id: jacky-creator\n      name: jacky-creator\n"],
    ["tsdown.config.ts", "export default {};\n"],
    ["vitest.config.ts", "export default {};\n"],
    ["scripts/collect-publish.mjs", "export {};\n"],
    ["scripts/copy-inplace.mjs", readFileSync(resolve(root, "scripts/copy-inplace.mjs"), "utf8")],
    ["scripts/check-release.mjs", readFileSync(releaseCheck, "utf8")],
    [".gitignore", "node_modules\n"],
    ["lib/index.js", "export {};\n"],
    ["lib/client.js", "module.exports = {};\n"],
    ["lib/typert.host.js", "export {};\n"],
    ["lib/collect-publish.mjs", "export {};\n"],
    ["src/index.ts", "export {};\n"],
    ["src/client/index.tsx", "export {};\n"],
    ...REQUIRED_CHAIN_FILES.map((file) => [file, "export {};\n"] as const),
    ["CHANGELOG.md", `# changes\n\n## [${version}]\n`],
    ["README.md", `# test\n\n${installUrl}\n`],
    ["assets/readme/hero.png", "png\n"],
    ["docs/installation.md", `# install\n\n${installUrl}\n`],
    ["docs/usage.md", "# usage\n"],
    ["docs/files.md", "# files\n"],
    ["docs/distribution.md", `# distribute\n\n${installUrl}\n`],
    ["BRAND_ASSETS.md", "# brand\n"],
    ["CONTRIBUTING.md", "# contributing\n"],
    ["SECURITY.md", "# security\n"],
    ["LICENSE", "MIT\n"],
  ]);

  for (const [file, contents] of files) {
    const path = join(repository, file);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, contents);
  }
  for (const command of ["tsc", "vitest", "tsdown"]) {
    const path = join(repository, "node_modules/.bin", command);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  }

  git(repository, "init", "-q");
  git(repository, "config", "user.email", "release-check@example.test");
  git(repository, "config", "user.name", "release-check");
  git(repository, "add", "--all");
  git(repository, "commit", "-qm", "initial");
  git(repository, "remote", "add", "origin", "git@github.com:Jackywxsz/DSH-Creator.git");
  return repository;
}

function runReleaseCheck(repository: string) {
  try {
    return {
      code: 0,
      output: execFileSync(process.execPath, [releaseCheck, "--root", repository], {
        encoding: "utf8",
      }),
    };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      code: failure.status ?? 1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
    };
  }
}

describe("release:check", () => {
  it("accepts a clean repository with origin and tracked release files", () => {
    const repository = createRepository();
    try {
      const result = runReleaseCheck(repository);
      expect(result.code).toBe(0);
      expect(result.output).toContain("release:check 通过");
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  }, 15_000);

  it("rejects dirty and untracked work trees with explicit reasons", () => {
    const dirty = createRepository();
    const untracked = createRepository();
    try {
      writeFileSync(join(dirty, "src/index.ts"), "export const dirty = true;\n");
      const dirtyResult = runReleaseCheck(dirty);
      expect(dirtyResult.code).not.toBe(0);
      expect(dirtyResult.output).toContain("工作树不干净");

      writeFileSync(join(untracked, "release-note.txt"), "not committed\n");
      const untrackedResult = runReleaseCheck(untracked);
      expect(untrackedResult.code).not.toBe(0);
      expect(untrackedResult.output).toContain("未跟踪发布文件");
      expect(untrackedResult.output).toContain("release-note.txt");
    } finally {
      rmSync(dirty, { recursive: true, force: true });
      rmSync(untracked, { recursive: true, force: true });
    }
  });

  it("rejects missing origin and missing files", () => {
    const noOrigin = createRepository();
    const wrongOrigin = createRepository();
    const missing = createRepository();
    try {
      git(noOrigin, "remote", "remove", "origin");
      const noOriginResult = runReleaseCheck(noOrigin);
      expect(noOriginResult.output).toContain("缺少 origin");

      git(wrongOrigin, "remote", "set-url", "origin", "git@github.com:example/wrong.git");
      const wrongOriginResult = runReleaseCheck(wrongOrigin);
      expect(wrongOriginResult.output).toContain("origin 必须指向 Jackywxsz/DSH-Creator");

      rmSync(join(missing, "assets/readme/hero.png"));
      const missingResult = runReleaseCheck(missing);
      expect(missingResult.output).toContain("关键文件缺失：assets/readme/hero.png");

    } finally {
      rmSync(noOrigin, { recursive: true, force: true });
      rmSync(wrongOrigin, { recursive: true, force: true });
      rmSync(missing, { recursive: true, force: true });
    }
  });

  it("rejects official DSH runtime packages bundled as regular dependencies", () => {
    const repository = createRepository();
    try {
      const manifestPath = join(repository, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.dependencies = { "@deepseek-ai/dsh-tools": "0.1.1-rc.2" };
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const result = runReleaseCheck(repository);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain("官方 DSH 运行时组件必须声明为 peerDependencies");
      expect(result.output).toContain("@deepseek-ai/dsh-tools");
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it("rejects the legacy package identity", () => {
    const repository = createRepository();
    try {
      const manifestPath = join(repository, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.name = "dsh-oil-creator";
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const result = runReleaseCheck(repository);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain("package name 必须为 jacky-creator");
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it("rejects version and install URL drift", () => {
    const repository = createRepository();
    try {
      const manifestPath = join(repository, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.version = "0.1.1";
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const result = runReleaseCheck(repository);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain(
        "README.md 未指向当前版本的 jacky-creator 安装包",
      );
      expect(result.output).toContain("CHANGELOG.md 缺少 0.1.1 条目");
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it("rejects packaging every internal document", () => {
    const repository = createRepository();
    try {
      const manifestPath = join(repository, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.files.push("docs/*.md");
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const result = runReleaseCheck(repository);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain(
        "npm tarball 不应打包内部 docs/*.md，只允许显式用户文档",
      );
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it("rejects runtime artifacts that leak the build machine path", () => {
    const repository = createRepository();
    try {
      writeFileSync(
        join(repository, "lib", "client.js"),
        `//#region ${repository}/src/client/index.tsx\n`,
      );
      const result = runReleaseCheck(repository);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain("运行产物泄露构建机绝对路径：lib/client.js");
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it.each(REQUIRED_CHAIN_FILES)("rejects an untracked critical chain file: %s", (file) => {
    const repository = createRepository();
    try {
      git(repository, "rm", "--cached", "--quiet", file);
      const result = runReleaseCheck(repository);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain(`关键文件未跟踪：${file}`);
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });
});
