import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  defaultCoverSkillDir,
  defaultCockpitDataDir,
  defaultDataDir,
  defaultLibraryRoot,
  defaultSubtitleSkillDir,
  expandHomePath,
  legacyCockpitDataDir,
  legacyDataDir,
  migrateLegacyDefaultState,
  resolveConfiguredPath,
  resolveCockpitDataDir,
  resolveDataDir,
  resolveSkillDir,
  skillDirCandidates,
} from "../src/config.ts";

describe("portable config defaults", () => {
  it("puts the library under Movies on macOS and Videos elsewhere", () => {
    expect(defaultLibraryRoot("darwin")).toBe(join(homedir(), "Movies", "视频项目"));
    expect(defaultLibraryRoot("win32")).toBe(join(homedir(), "Videos", "视频项目"));
    expect(defaultLibraryRoot("linux")).toBe(join(homedir(), "Videos", "视频项目"));
  });

  it("resolves empty dataDir to the home-local store", () => {
    expect(resolveDataDir({
      libraryRoot: defaultLibraryRoot(),
      dataDir: "",
      cockpitDataDir: "",
      subtitleSkillDir: "",
      coverSkillDir: "",
    })).toBe(defaultDataDir());
    expect(resolveCockpitDataDir({
      libraryRoot: defaultLibraryRoot(),
      dataDir: "",
      cockpitDataDir: "",
      subtitleSkillDir: "",
      coverSkillDir: "",
    })).toBe(defaultCockpitDataDir());
    expect(defaultDataDir("/home/jacky")).toBe(join("/home/jacky", ".jacky-creator"));
    expect(defaultCockpitDataDir("/home/jacky")).toBe(
      join("/home/jacky", ".jacky-creator", "operations"),
    );
  });

  it("copies legacy state into Jacky Creator directories without deleting the source", () => {
    const home = mkdtempSync(join(tmpdir(), "jacky-creator-migration-"));
    try {
      mkdirSync(legacyDataDir(home), { recursive: true });
      mkdirSync(legacyCockpitDataDir(home), { recursive: true });
      writeFileSync(join(legacyDataDir(home), "overlay.json"), "legacy overlay\n");
      writeFileSync(join(legacyCockpitDataDir(home), "state.json"), "legacy operations\n");

      const migrated = migrateLegacyDefaultState({
        libraryRoot: defaultLibraryRoot(),
        dataDir: defaultDataDir(home),
        cockpitDataDir: defaultCockpitDataDir(home),
        subtitleSkillDir: "",
        coverSkillDir: "",
      }, home);

      expect(migrated).toEqual([
        defaultDataDir(home),
        defaultCockpitDataDir(home),
      ]);
      expect(readFileSync(join(defaultDataDir(home), "overlay.json"), "utf8"))
        .toBe("legacy overlay\n");
      expect(readFileSync(join(defaultCockpitDataDir(home), "state.json"), "utf8"))
        .toBe("legacy operations\n");
      expect(existsSync(join(legacyDataDir(home), "overlay.json"))).toBe(true);
      expect(existsSync(join(legacyCockpitDataDir(home), "state.json"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("does not overwrite an existing Jacky Creator state directory", () => {
    const home = mkdtempSync(join(tmpdir(), "jacky-creator-existing-"));
    try {
      mkdirSync(legacyDataDir(home), { recursive: true });
      mkdirSync(defaultDataDir(home), { recursive: true });
      writeFileSync(join(legacyDataDir(home), "overlay.json"), "legacy\n");
      writeFileSync(join(defaultDataDir(home), "overlay.json"), "current\n");

      expect(migrateLegacyDefaultState({
        libraryRoot: defaultLibraryRoot(),
        dataDir: defaultDataDir(home),
        cockpitDataDir: join(home, "custom-operations"),
        subtitleSkillDir: "",
        coverSkillDir: "",
      }, home)).toEqual([]);
      expect(readFileSync(join(defaultDataDir(home), "overlay.json"), "utf8"))
        .toBe("current\n");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("lets config and env override skill directories", () => {
    expect(resolveConfiguredPath("", defaultSubtitleSkillDir())).toBe(defaultSubtitleSkillDir());
    expect(resolveConfiguredPath("", defaultCoverSkillDir(), "/tmp/from-env")).toBe("/tmp/from-env");
    expect(resolveConfiguredPath("/opt/oil-cover", defaultCoverSkillDir(), "/tmp/from-env")).toBe("/opt/oil-cover");
  });

  it("discovers common skill roots without overriding explicit choices", () => {
    expect(skillDirCandidates("oil-cover")).toEqual([
      join(homedir(), ".claude", "skills", "oil-cover"),
      join(homedir(), ".codex", "skills", "oil-cover"),
      join(homedir(), ".agents", "skills", "oil-cover"),
      join(homedir(), ".grok", "skills", "oil-cover"),
    ]);
    expect(resolveSkillDir("/opt/custom-skill", "oil-cover", "/opt/from-env")).toBe("/opt/custom-skill");
    expect(resolveSkillDir("", "oil-cover", "/opt/from-env")).toBe("/opt/from-env");
    expect(expandHomePath("~/Movies/content")).toBe(join(homedir(), "Movies", "content"));
    expect(expandHomePath("%USERPROFILE%\\Videos\\content")).toBe(join(homedir(), "Videos", "content"));
  });
});
