import { describe, expect, it, vi } from "vitest";

import { CREATOR_SETTINGS_NAMESPACE } from "../src/settingsContract.ts";
import {
  CREATOR_SETTINGS_DISCOVERY_SCHEMA,
  registerCreatorSettingsNamespace,
} from "../src/settingsHost.ts";

describe("creator settings namespace", () => {
  it("registers the namespace that rc.7 uses to dispatch the settings card", () => {
    const register = vi.fn();

    registerCreatorSettingsNamespace({ register } as never);

    expect(register).toHaveBeenCalledOnce();
    expect(String(register.mock.calls[0]?.[0])).toBe(CREATOR_SETTINGS_NAMESPACE);
    expect(register.mock.calls[0]?.[1]).toBe(CREATOR_SETTINGS_DISCOVERY_SCHEMA);
  });
});
