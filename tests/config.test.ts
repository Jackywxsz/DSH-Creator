import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  defaultCoverSkillDir,
  defaultDataDir,
  defaultLibraryRoot,
  defaultSubtitleSkillDir,
  resolveConfiguredPath,
  resolveDataDir,
} from "../src/config.ts";

describe("portable config defaults", () => {
  it("puts the library under the current home Movies folder", () => {
    expect(defaultLibraryRoot()).toBe(join(homedir(), "Movies", "视频项目"));
  });

  it("resolves empty dataDir to the home-local store", () => {
    expect(resolveDataDir({
      libraryRoot: defaultLibraryRoot(),
      dataDir: "",
      subtitleSkillDir: "",
      coverSkillDir: "",
    })).toBe(defaultDataDir());
  });

  it("lets config and env override skill directories", () => {
    expect(resolveConfiguredPath("", defaultSubtitleSkillDir())).toBe(defaultSubtitleSkillDir());
    expect(resolveConfiguredPath("", defaultCoverSkillDir(), "/tmp/from-env")).toBe("/tmp/from-env");
    expect(resolveConfiguredPath("/opt/oil-cover", defaultCoverSkillDir(), "/tmp/from-env")).toBe("/opt/oil-cover");
  });
});
