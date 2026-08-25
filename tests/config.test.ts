import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  defaultCoverSkillDir,
  defaultCockpitDataDir,
  defaultDataDir,
  defaultLibraryRoot,
  defaultSubtitleSkillDir,
  expandHomePath,
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
