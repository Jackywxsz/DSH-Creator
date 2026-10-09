import { readFileSync } from "node:fs";
import { evaluatePluginCompatibility } from "@deepseek-ai/dsh-app-boot";
import { RemoteError } from "@deepseek-ai/dsh-typert-protocol";
import { describe, expect, it, vi } from "vitest";
import { credentialsClient } from "../src/client/credentialsApi.ts";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("official Harness compatibility", () => {
  it("passes the real host gate without exemptions and refuses older hosts", () => {
    expect(evaluatePluginCompatibility(manifest, {}, "0.2.0-rc.2")).toBeUndefined();
    expect(evaluatePluginCompatibility(manifest, {}, "0.1.1-rc.2")?.exempted).toBe(false);
  });

  it("reproduces the beta.8 installation refusal", () => {
    const old = { ...manifest, version: "0.1.0-beta.8", peerDependencies: {
      "@deepseek-ai/dsh-client-ui-settings": "0.1.1-rc.2",
    } };
    expect(evaluatePluginCompatibility(old, {}, "0.2.0-rc.2")).toMatchObject({
      exempted: false, peers: old.peerDependencies,
    });
  });

  it("adapts credential calls without exposing secret values in describe", async () => {
    const describe = vi.fn(async () => ({ ok: true as const, value: { TEST_KEY: { configured: true, writable: true } } }));
    const set = vi.fn(async () => ({ ok: true as const, value: undefined }));
    const client = credentialsClient({ describe, set, unset: vi.fn() });
    expect(await client.describe({ refs: ["TEST_KEY"] })).toEqual({ result: {
      ok: true, value: { credentials: { TEST_KEY: { configured: true, writable: true } } },
    } });
    expect(describe).toHaveBeenCalledWith(["TEST_KEY"]);
    expect(await client.set({ ref: "TEST_KEY", value: "fictional-test-value" })).toEqual({ result: { ok: true, value: undefined } });
    expect(set).toHaveBeenCalledWith("TEST_KEY", "fictional-test-value");
    describe.mockImplementationOnce(async () => ({ ok: false, error: new RemoteError("gateway/internal", "unavailable", {}) }) as never);
    expect(await client.describe({ refs: ["TEST_KEY"] })).toEqual({ result: { ok: false } });
  });
});
