import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { defaultFindDshSkillDir, defaultFindSkillDir, findExecutable, inspectCreatorSetup } from "../src/capabilities.ts";
import type { LibrarySettings } from "../src/types.ts";

function settings(libraryRoot: string, configured = true): LibrarySettings {
  return {
    libraryRoot,
    profile: { enabledPlatforms: ["xiaohongshu", "douyin", "bilibili", "wechat"] },
    secrets: {
      subtitle: { kind: "subtitle", ref: "subtitle", configured, writable: true },
      cover: { kind: "cover", ref: "cover", configured, writable: true },
    },
  };
}

describe("creator setup inspection", () => {
  it("reports discovered optional capabilities without mutating the workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "oil-capabilities-"));
    const libraryRoot = join(root, "library");
    const subtitleRoot = join(root, "oil-subtitle");
    const coverRoot = join(root, "oil-cover");
    const jackyCoverRoot = join(root, "skills", "jacky-cover");
    const publisherRoot = join(root, "skills", "jacky-video-publisher");
    const publisherConfig = join(root, "publisher-config.json");
    const bin = join(root, "bin");
    await Promise.all([
      mkdir(libraryRoot, { recursive: true }),
      mkdir(join(subtitleRoot, ".venv", "bin"), { recursive: true }),
      mkdir(join(subtitleRoot, "scripts"), { recursive: true }),
      mkdir(join(coverRoot, "scripts"), { recursive: true }),
      mkdir(join(coverRoot, "docs", "showcase"), { recursive: true }),
      mkdir(join(jackyCoverRoot, "references"), { recursive: true }),
      mkdir(join(jackyCoverRoot, "scripts"), { recursive: true }),
      mkdir(join(jackyCoverRoot, "assets"), { recursive: true }),
      mkdir(join(publisherRoot, "scripts", "v2"), { recursive: true }),
      mkdir(bin, { recursive: true }),
    ]);
    await writeFile(join(subtitleRoot, "setup.sh"), "#!/bin/bash\n");
    const files = [
      join(subtitleRoot, ".venv", "bin", "python3"),
      join(subtitleRoot, "scripts", "preview_editor.py"),
      join(subtitleRoot, "scripts", "burn_subtitles.py"),
      join(subtitleRoot, "scripts", "prepare_subtitles.py"),
      join(subtitleRoot, "scripts", "review_subtitles.py"),
      join(coverRoot, "scripts", "generate_oil_cover.py"),
      join(coverRoot, "docs", "showcase", "gallery.png"),
      join(jackyCoverRoot, "references", "visual-system.md"),
      join(jackyCoverRoot, "scripts", "validate_run.py"),
      join(jackyCoverRoot, "assets", "jacky-reference-front.jpg"),
      join(jackyCoverRoot, "assets", "jacky-reference-casual.jpg"),
      join(publisherRoot, "SKILL.md"),
      join(publisherRoot, "scripts", "config.mjs"),
      join(publisherRoot, "scripts", "run-safe-platforms.sh"),
      join(publisherRoot, "scripts", "v2", "publisher.mjs"),
      join(bin, "ego-browser"),
    ];
    await Promise.all(files.map((path) => writeFile(path, "")));
    await chmod(join(bin, "ego-browser"), 0o755);
    await writeFile(publisherConfig, JSON.stringify({
      schemaVersion: 2,
      onboarding: { completed: true },
      availablePlatforms: ["xiaohongshu", "douyin", "bilibili", "wechat_channels"],
      defaultPlatforms: ["xiaohongshu", "douyin", "bilibili", "wechat_channels"],
    }));

    const result = await inspectCreatorSetup({
      libraryRoot,
      dataDir: join(root, "data"),
      subtitleSkillDir: subtitleRoot,
      coverSkillDir: coverRoot,
      settings: settings(libraryRoot),
      platform: "linux",
      env: { PATH: bin },
      findSkillDir: (name) => join(root, "skills", name),
      findDshSkillDir: (name) => join(root, "skills", name),
      publisherConfigPath: publisherConfig,
    });

    expect(result.capabilities.library.state).toBe("ready");
    expect(result.capabilities.subtitleSkill.state).toBe("ready");
    expect(result.capabilities.coverSkill.state).toBe("ready");
    expect(result.capabilities.publishSync.path).toBe(join(bin, "ego-browser"));
    expect(result.capabilities.screenStudio.state).toBe("unsupported");
    expect(result.capabilities.editingSkill.state).toBe("ready");
    expect(result.capabilities.editingSkill.path).toBe(join(root, "skills", "screen-studio-editor"));
    expect(result.capabilities.publishSkill.state).toBe("ready");
    expect(result.capabilities.publishSkill.skillName).toBe("jacky-video-publisher");
    expect(result.capabilities.presentationSkill.state).toBe("ready");
    expect(result.capabilities.articleSkill.state).toBe("ready");
    expect(result.recommendations).toEqual([]);
  });

  it("explains missing optional dependencies instead of failing the whole plugin", async () => {
    const root = await mkdtemp(join(tmpdir(), "oil-capabilities-missing-"));
    const result = await inspectCreatorSetup({
      libraryRoot: join(root, "missing-library"),
      dataDir: join(root, "data"),
      subtitleSkillDir: join(root, "missing-subtitle"),
      coverSkillDir: join(root, "missing-cover"),
      settings: settings(join(root, "missing-library"), false),
      platform: "linux",
      env: { PATH: "" },
      home: root,
      findSkillDir: () => undefined,
      findDshSkillDir: () => undefined,
    });

    expect(result.capabilities.library.state).toBe("missing");
    expect(result.capabilities.subtitleSkill.state).toBe("missing");
    expect(result.capabilities.subtitleSkill.detail).toContain(
      `git clone https://github.com/oil-oil/oil-subtitle '${join(root, "missing-subtitle")}'`,
    );
    expect(result.capabilities.coverCredential.state).toBe("missing");
    expect(result.capabilities.publishSync.state).toBe("missing");
    expect(result.capabilities.editingSkill.state).toBe("missing");
    expect(result.capabilities.publishSkill.state).toBe("missing");
    expect(result.capabilities.articleSkill.state).toBe("ready");
    expect(result.recommendations.length).toBeGreaterThan(3);
  });

  it("distinguishes a cloned subtitle directory that still needs setup", async () => {
    const root = await mkdtemp(join(tmpdir(), "oil-capabilities-unsetup-"));
    const subtitleRoot = join(root, "oil-subtitle");
    await mkdir(subtitleRoot, { recursive: true });
    await writeFile(join(subtitleRoot, "setup.sh"), "#!/bin/bash\n");

    const result = await inspectCreatorSetup({
      libraryRoot: root,
      dataDir: join(root, "data"),
      subtitleSkillDir: subtitleRoot,
      coverSkillDir: join(root, "missing-cover"),
      settings: settings(root),
      platform: "linux",
      env: { PATH: "" },
      home: root,
      findSkillDir: () => undefined,
      findDshSkillDir: () => undefined,
    });

    expect(result.capabilities.subtitleSkill.state).toBe("missing");
    expect(result.capabilities.subtitleSkill.path).toBe(subtitleRoot);
    expect(result.capabilities.subtitleSkill.detail).toContain("尚未完成 setup.sh");
    expect(result.capabilities.subtitleSkill.detail).toContain(`bash "${join(subtitleRoot, "setup.sh")}"`);
    expect(result.recommendations).toContain(`字幕：bash "${join(subtitleRoot, "setup.sh")}"`);
    expect(result.recommendations.join("\n")).not.toContain("git clone https://github.com/oil-oil/oil-subtitle");
  });
});

describe("findExecutable", () => {
  it("returns undefined when PATH has no matching executable", async () => {
    expect(await findExecutable("ego-browser", { PATH: "" }, "linux", tmpdir())).toBeUndefined();
  });

  it("finds Windows executables via Path and PATHEXT", async () => {
    const root = await mkdtemp(join(tmpdir(), "oil-win-bin-"));
    const exe = join(root, "ego-browser.EXE");
    await writeFile(exe, "");
    expect(await findExecutable("ego-browser", {
      Path: root,
      PATHEXT: ".EXE;.CMD",
    }, "win32", root)).toBe(exe);
  });

  it("looks in user bin dirs even when they are not on PATH", async () => {
    const home = await mkdtemp(join(tmpdir(), "oil-home-bin-"));
    const bin = join(home, ".local", "bin");
    await mkdir(bin, { recursive: true });
    const cli = join(bin, "ego-browser");
    await writeFile(cli, "");
    await chmod(cli, 0o755);
    expect(await findExecutable("ego-browser", { PATH: "" }, "linux", home)).toBe(cli);
  });
});

describe("defaultFindSkillDir", () => {
  it("requires SKILL.md and searches grok skills", async () => {
    const home = await mkdtemp(join(tmpdir(), "oil-skill-home-"));
    const empty = join(home, ".claude", "skills", "video-publisher");
    const grok = join(home, ".grok", "skills", "video-publisher");
    await mkdir(empty, { recursive: true });
    await mkdir(grok, { recursive: true });
    await writeFile(join(grok, "SKILL.md"), "# video-publisher\n");
    expect(defaultFindSkillDir("video-publisher", home)).toBe(grok);
  });

  it("uses only DSH-supported roots for callable Skills", async () => {
    const home = await mkdtemp(join(tmpdir(), "dsh-skill-home-"));
    const codex = join(home, ".codex", "skills", "video-publisher");
    const agents = join(home, ".agents", "skills", "video-publisher");
    await mkdir(codex, { recursive: true });
    await writeFile(join(codex, "SKILL.md"), "# codex only\n");
    expect(defaultFindDshSkillDir("video-publisher", home)).toBeUndefined();
    await mkdir(agents, { recursive: true });
    await writeFile(join(agents, "SKILL.md"), "# dsh visible\n");
    expect(defaultFindDshSkillDir("video-publisher", home)).toBe(agents);
  });
});

describe("publisher capability", () => {
  it("accepts the compatible publisher only when onboarding matches enabled platforms", async () => {
    const root = await mkdtemp(join(tmpdir(), "publisher-capability-"));
    const configPath = join(root, "config.json");
    const publisherRoot = join(root, "video-publisher");
    await mkdir(join(publisherRoot, "scripts", "v2"), { recursive: true });
    await Promise.all([
      writeFile(join(publisherRoot, "SKILL.md"), "# publisher\n"),
      writeFile(join(publisherRoot, "scripts", "config.mjs"), ""),
      writeFile(join(publisherRoot, "scripts", "run-safe-platforms.sh"), ""),
      writeFile(join(publisherRoot, "scripts", "v2", "publisher.mjs"), ""),
    ]);
    await writeFile(configPath, JSON.stringify({
      schemaVersion: 2,
      onboarding: { completed: true },
      availablePlatforms: ["douyin"],
      defaultPlatforms: ["douyin"],
    }));
    const configured = settings(root);
    configured.profile.enabledPlatforms = ["douyin"];
    const inspect = () => inspectCreatorSetup({
      libraryRoot: root,
      dataDir: join(root, "data"),
      subtitleSkillDir: join(root, "missing-subtitle"),
      coverSkillDir: join(root, "missing-cover"),
      settings: configured,
      platform: "linux",
      env: { PATH: "" },
      home: root,
      findSkillDir: () => undefined,
      findDshSkillDir: (name) => name === "video-publisher" ? publisherRoot : undefined,
      publisherConfigPath: configPath,
    });

    const ready = await inspect();
    expect(ready.capabilities.publishSkill.state).toBe("ready");
    expect(ready.capabilities.publishSkill.skillName).toBe("video-publisher");

    configured.profile.enabledPlatforms = ["bilibili"];
    const stale = await inspect();
    expect(stale.capabilities.publishSkill.state).toBe("missing");
    expect(stale.capabilities.publishSkill.detail).toContain("当前启用平台不一致");
  });

  it("does not report an incomplete publisher directory as ready", async () => {
    const root = await mkdtemp(join(tmpdir(), "publisher-incomplete-"));
    const publisherRoot = join(root, "video-publisher");
    const configPath = join(root, "config.json");
    await mkdir(publisherRoot, { recursive: true });
    await writeFile(join(publisherRoot, "SKILL.md"), "# incomplete\n");
    await writeFile(configPath, JSON.stringify({
      schemaVersion: 2,
      onboarding: { completed: true },
      availablePlatforms: ["douyin"],
      defaultPlatforms: ["douyin"],
    }));
    const configured = settings(root);
    configured.profile.enabledPlatforms = ["douyin"];

    const result = await inspectCreatorSetup({
      libraryRoot: root,
      dataDir: join(root, "data"),
      subtitleSkillDir: join(root, "missing-subtitle"),
      coverSkillDir: join(root, "missing-cover"),
      settings: configured,
      platform: "linux",
      env: { PATH: "" },
      home: root,
      findSkillDir: () => undefined,
      findDshSkillDir: (name) => name === "video-publisher" ? publisherRoot : undefined,
      publisherConfigPath: configPath,
    });

    expect(result.capabilities.publishSkill.state).toBe("missing");
    expect(result.capabilities.publishSkill.detail).toContain("安装不完整");
    expect(result.capabilities.publishSkill.detail).toContain("scripts/config.mjs");
  });

  it("falls back to a complete compatible publisher when the branded directory is incomplete", async () => {
    const root = await mkdtemp(join(tmpdir(), "publisher-fallback-"));
    const jackyRoot = join(root, "jacky-video-publisher");
    const compatibleRoot = join(root, "video-publisher");
    const configPath = join(root, "config.json");
    await mkdir(jackyRoot, { recursive: true });
    await writeFile(join(jackyRoot, "SKILL.md"), "# incomplete branded publisher\n");
    await mkdir(join(compatibleRoot, "scripts", "v2"), { recursive: true });
    await Promise.all([
      writeFile(join(compatibleRoot, "SKILL.md"), "# compatible publisher\n"),
      writeFile(join(compatibleRoot, "scripts", "config.mjs"), ""),
      writeFile(join(compatibleRoot, "scripts", "run-safe-platforms.sh"), ""),
      writeFile(join(compatibleRoot, "scripts", "v2", "publisher.mjs"), ""),
      writeFile(configPath, JSON.stringify({
        schemaVersion: 2,
        onboarding: { completed: true },
        availablePlatforms: ["douyin"],
        defaultPlatforms: ["douyin"],
      })),
    ]);
    const configured = settings(root);
    configured.profile.enabledPlatforms = ["douyin"];

    const result = await inspectCreatorSetup({
      libraryRoot: root,
      dataDir: join(root, "data"),
      subtitleSkillDir: join(root, "missing-subtitle"),
      coverSkillDir: join(root, "missing-cover"),
      settings: configured,
      platform: "linux",
      env: { PATH: "" },
      home: root,
      findSkillDir: () => undefined,
      findDshSkillDir: (name) => name === "jacky-video-publisher"
        ? jackyRoot
        : name === "video-publisher"
          ? compatibleRoot
          : undefined,
      publisherConfigPath: configPath,
    });

    expect(result.capabilities.publishSkill.state).toBe("ready");
    expect(result.capabilities.publishSkill.skillName).toBe("video-publisher");
    expect(result.capabilities.publishSkill.path).toBe(compatibleRoot);
  });
});

describe("inspectCreatorSetup windows and mac paths", () => {
  it("accepts a Windows subtitle venv and does not claim Screen Studio", async () => {
    const root = await mkdtemp(join(tmpdir(), "oil-win-setup-"));
    const libraryRoot = join(root, "library");
    const subtitleRoot = join(root, "oil-subtitle");
    const coverRoot = join(root, "oil-cover");
    const jackyCoverRoot = join(root, "skills", "jacky-cover");
    const bin = join(root, "bin");
    await Promise.all([
      mkdir(libraryRoot, { recursive: true }),
      mkdir(join(subtitleRoot, ".venv", "Scripts"), { recursive: true }),
      mkdir(join(subtitleRoot, "scripts"), { recursive: true }),
      mkdir(join(coverRoot, "scripts"), { recursive: true }),
      mkdir(join(coverRoot, "docs", "showcase"), { recursive: true }),
      mkdir(join(jackyCoverRoot, "references"), { recursive: true }),
      mkdir(join(jackyCoverRoot, "scripts"), { recursive: true }),
      mkdir(join(jackyCoverRoot, "assets"), { recursive: true }),
      mkdir(bin, { recursive: true }),
    ]);
    await writeFile(join(subtitleRoot, "setup.sh"), "#!/bin/bash\n");
    await Promise.all([
      writeFile(join(subtitleRoot, ".venv", "Scripts", "python.exe"), ""),
      writeFile(join(subtitleRoot, "scripts", "preview_editor.py"), ""),
      writeFile(join(subtitleRoot, "scripts", "burn_subtitles.py"), ""),
      writeFile(join(subtitleRoot, "scripts", "prepare_subtitles.py"), ""),
      writeFile(join(subtitleRoot, "scripts", "review_subtitles.py"), ""),
      writeFile(join(coverRoot, "scripts", "generate_oil_cover.py"), ""),
      writeFile(join(coverRoot, "docs", "showcase", "gallery.png"), ""),
      writeFile(join(jackyCoverRoot, "references", "visual-system.md"), ""),
      writeFile(join(jackyCoverRoot, "scripts", "validate_run.py"), ""),
      writeFile(join(jackyCoverRoot, "assets", "jacky-reference-front.jpg"), ""),
      writeFile(join(jackyCoverRoot, "assets", "jacky-reference-casual.jpg"), ""),
      writeFile(join(bin, "ego-browser.EXE"), ""),
    ]);

    const result = await inspectCreatorSetup({
      libraryRoot,
      dataDir: join(root, "data"),
      subtitleSkillDir: subtitleRoot,
      coverSkillDir: coverRoot,
      settings: settings(libraryRoot),
      platform: "win32",
      env: { Path: bin, PATHEXT: ".EXE" },
      home: root,
      findSkillDir: (name) => name === "jacky-cover" ? jackyCoverRoot : undefined,
      findDshSkillDir: () => undefined,
    });

    expect(result.capabilities.subtitleSkill.state).toBe("ready");
    expect(result.capabilities.coverSkill.state).toBe("ready");
    expect(result.capabilities.publishSync.state).toBe("ready");
    expect(result.capabilities.screenStudio.state).toBe("unsupported");
  });

  it("does not treat an Ego app without the CLI as ready", async () => {
    const home = await mkdtemp(join(tmpdir(), "oil-ego-app-"));
    const app = join(home, "Applications", "ego lite.app");
    await mkdir(app, { recursive: true });
    const result = await inspectCreatorSetup({
      libraryRoot: home,
      dataDir: join(home, "data"),
      subtitleSkillDir: join(home, "missing-subtitle"),
      coverSkillDir: join(home, "missing-cover"),
      settings: settings(home),
      platform: "darwin",
      env: { PATH: "" },
      home,
      findSkillDir: () => undefined,
      findDshSkillDir: () => undefined,
    });
    expect(result.capabilities.publishSync.state).toBe("missing");
    expect(result.capabilities.publishSync.path).toBe(app);
    expect(result.capabilities.publishSync.detail).toContain("PATH");
  });
});
