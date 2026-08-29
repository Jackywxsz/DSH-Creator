import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  configurePublisher,
  dshSkillRoot,
  installCreatorCapability,
  runCommand,
} from "../src/capabilityInstall.ts";

type Runner = typeof runCommand;

async function isDirectory(path: string): Promise<boolean> {
  return stat(path).then((info) => info.isDirectory(), () => false);
}

function checkoutRunner(source = "root"): ReturnType<typeof vi.fn<Runner>> {
  return vi.fn<Runner>(async (command, args) => {
    if (command !== "git" || args[0] !== "clone") return;
    const checkout = args.at(-1)!;
    const skillRoot = source === "root" ? checkout : join(checkout, source);
    await mkdir(skillRoot, { recursive: true });
    await writeFile(join(skillRoot, "SKILL.md"), "# test\n");
  });
}

describe("creator capability installer", () => {
  it("installs a pinned public Skill into the DSH-discoverable root", async () => {
    const home = await mkdtemp(join(tmpdir(), "jacky-install-home-"));
    const run = checkoutRunner();

    const result = await installCreatorCapability("editing", { home, run });

    expect(result.changed).toBe(true);
    expect(result.path).toBe(join(dshSkillRoot(home), "screen-studio-editor"));
    expect(await readFile(join(result.path, "SKILL.md"), "utf8")).toBe("# test\n");
    expect(run).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["checkout", "--detach", "1b747a0e1f5a4005d37207be3891800dd1b37a42"]),
      undefined,
      undefined,
    );
  });

  it("never overwrites an existing Skill directory", async () => {
    const home = await mkdtemp(join(tmpdir(), "jacky-existing-home-"));
    const destination = join(dshSkillRoot(home), "screen-studio-editor");
    await mkdir(destination, { recursive: true });
    await writeFile(join(destination, "SKILL.md"), "# keep me\n");
    const run = vi.fn<Runner>();

    const result = await installCreatorCapability("editing", { home, run });

    expect(result.changed).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(await readFile(join(destination, "SKILL.md"), "utf8")).toBe("# keep me\n");
  });

  it("installs the compatible publisher subdirectory from Jacky's pinned fork", async () => {
    const home = await mkdtemp(join(tmpdir(), "jacky-publisher-home-"));
    const run = checkoutRunner("video-publisher");

    const result = await installCreatorCapability("publisher", { home, run });

    expect(result.path).toBe(join(dshSkillRoot(home), "video-publisher"));
    expect(await isDirectory(result.path)).toBe(true);
    expect(run.mock.calls[0]?.[1]).toContain("https://github.com/Jackywxsz/Jacky-video-publisher");
    expect(run.mock.calls[1]?.[1]).toContain("9d2805373af7b969f1e49309215bd6eadc35aa14");
  });

  it("maps saved platform ids into publisher onboarding without shell interpolation", async () => {
    const run = vi.fn<Runner>();
    await configurePublisher(
      "/skills/video-publisher",
      "/Movies/视频项目",
      ["xiaohongshu", "wechat"],
      run,
    );

    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]).toEqual([
      process.execPath,
      [
        "/skills/video-publisher/scripts/config.mjs",
        "onboard",
        "--source-dir",
        "/Movies/视频项目",
        "--available-platform",
        "xiaohongshu",
        "--platform",
        "xiaohongshu",
        "--available-platform",
        "wechat_channels",
        "--platform",
        "wechat_channels",
        "--originality-policy",
        "ask_each_run",
      ],
      "/skills/video-publisher",
      undefined,
    ]);
  });

  it("surfaces stdout-only command failures instead of returning a blank error", async () => {
    await expect(runCommand(process.execPath, [
      "-e",
      "console.log('publisher configuration failed'); process.exit(7)",
    ])).rejects.toThrow(/publisher configuration failed/);
  });
});
