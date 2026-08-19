import { describe, expect, it } from "vitest";

import { spawn } from "node:child_process";

import { jobPidMatches, terminateOwnedProcess, waitForPidExit } from "../src/processAlive.ts";

describe("process ownership", () => {
  it("does not treat an unverified command line as ownership", () => {
    expect(jobPidMatches(process.pid, ["not-a-real-oil-creator-process"])).toBe(false);
    expect(jobPidMatches(99999999, ["preview_editor"])).toBe(false);
  });

  it("considers an already exited process stopped", async () => {
    await expect(waitForPidExit(99999999, ["preview_editor"])).resolves.toBe(true);
  });

  it("terminates and waits only for an owned preview process", async () => {
    const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)", "preview_editor.py"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    expect(child.pid).toBeTypeOf("number");
    await expect(terminateOwnedProcess(child.pid, ["preview_editor.py"], 500, 500)).resolves.toBe(true);
    expect(child.pid === undefined ? false : jobPidMatches(child.pid, ["preview_editor.py"])).toBe(false);
  });
});
