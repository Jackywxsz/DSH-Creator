import { describe, expect, it, vi } from "vitest";

import { openNativePath, type NativePathHost } from "../src/client/nativePaths.ts";

describe("openNativePath", () => {
  it("uses the Host API so a directory bypasses sidebar file interception", async () => {
    const openPath = vi.fn(async () => ({ result: { ok: true as const } }));
    const fallback = vi.fn(async () => undefined);

    await openNativePath({ openPath } satisfies NativePathHost, fallback, "/tmp/content-folder");

    expect(openPath).toHaveBeenCalledWith(
      { path: "/tmp/content-folder" },
      expect.any(AbortSignal),
    );
    expect(fallback).not.toHaveBeenCalled();
  });

  it("falls back when the Host API is unavailable", async () => {
    const fallback = vi.fn(async () => undefined);

    await openNativePath(undefined, fallback, "/tmp/content-folder");

    expect(fallback).toHaveBeenCalledWith("/tmp/content-folder");
  });

  it("surfaces the Host error", async () => {
    const host: NativePathHost = {
      openPath: vi.fn(async () => ({ result: { ok: false, error: { message: "permission denied" } } })),
    };

    await expect(openNativePath(host, async () => undefined, "/tmp/content-folder"))
      .rejects.toThrow("permission denied");
  });
});
