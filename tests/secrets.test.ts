import { describe, expect, it } from "vitest";

import {
  emptySecrets,
  missingSecretMessage,
  primaryRef,
  viewFromDescribe,
} from "../src/secrets.ts";

describe("viewFromDescribe", () => {
  it("marks configured when any listed ref exists", () => {
    expect(viewFromDescribe("subtitle", {
      BAILIAN_API_KEY: { configured: true, writable: true, source: "file" },
    })).toEqual({
      kind: "subtitle",
      ref: "BAILIAN_API_KEY",
      configured: true,
      writable: true,
      source: "file",
    });
  });

  it("stays missing when no ref is configured", () => {
    expect(viewFromDescribe("cover", {
      ZENMUX_API_KEY: { configured: false, writable: true },
    })).toEqual({
      kind: "cover",
      ref: "ZENMUX_API_KEY",
      configured: false,
      writable: true,
    });
  });
});

describe("emptySecrets", () => {
  it("starts both keys unconfigured", () => {
    const secrets = emptySecrets();
    expect(secrets.subtitle.configured).toBe(false);
    expect(secrets.cover.ref).toBe(primaryRef("cover"));
  });
});

describe("missingSecretMessage", () => {
  it("points at the plugin settings card", () => {
    expect(missingSecretMessage("subtitle")).toContain("百炼");
    expect(missingSecretMessage("cover")).toContain("ZenMux");
  });
});
