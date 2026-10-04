import { describe, expect, it, vi } from "vitest";
import { RemoteError } from "@deepseek-ai/dsh-typert-protocol";
import { openNativePath } from "../src/client/nativePaths.ts";

describe("openNativePath", () => {
  it("opens directories through the official session Remote", async () => {
    const openWorkspacePath = vi.fn(async () => ({ ok: true as const, value: { opened: true as const } }));
    await openNativePath({ openWorkspacePath }, "/tmp/content-folder");
    expect(openWorkspacePath).toHaveBeenCalledWith({ path: "/tmp/content-folder" });
  });

  it("surfaces the Host error", async () => {
    const openWorkspacePath = vi.fn(async () => ({ ok: false as const, error: new RemoteError("gateway/internal", "permission denied", {}) }));
    await expect(openNativePath({ openWorkspacePath }, "/tmp/content-folder"))
      .rejects.toThrow("permission denied");
  });
});
