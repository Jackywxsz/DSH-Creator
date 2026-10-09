import { describe, expect, it, vi } from "vitest";
import { registerCreatorSettingsNamespace } from "../src/settingsHost.ts";

describe("creator settings presentation", () => {
  it("disables the generated form and returns the lifecycle disposer", () => {
    const dispose = vi.fn();
    const configure = vi.fn(() => dispose);
    expect(registerCreatorSettingsNamespace({ configure })).toBe(dispose);
    expect(configure).toHaveBeenCalledExactlyOnceWith({ auto: false });
  });
});
