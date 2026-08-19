import { SlotCore } from "@deepseek-ai/dsh-client-ui-slots";
import { describe, expect, it, vi } from "vitest";

import { CREATOR_SETTINGS_NAMESPACE } from "../src/settingsContract.ts";
import {
  registerCreatorSettingsCard,
  type CompatibleSettingsSlots,
} from "../src/client/settingsSlot.ts";

const OPTIONS = {
  namespace: CREATOR_SETTINGS_NAMESPACE,
  legacyId: "dsh-oil-creator",
  legacyOrder: 40,
  locale: "dsh.oil.creator",
  inject: () => ({}),
};

function registerWithSlotCore(kind: "keyed" | "list"): SlotCore {
  const slots = new SlotCore();
  const component = () => null;
  slots.register({
    name: "root",
    children: {
      "settings.plugin.item": { kind, scope: "root" },
    },
  } as never, component as never);
  registerCreatorSettingsCard(
    slots as unknown as CompatibleSettingsSlots,
    component,
    OPTIONS,
  );
  return slots;
}

describe("settings.plugin.item compatibility", () => {
  it("passes the rc.7 keyed slot validation", () => {
    const slots = registerWithSlotCore("keyed");
    expect(slots.entries("settings.plugin.item")[0]?.options.key)
      .toBe(CREATOR_SETTINGS_NAMESPACE);
  });

  it("passes the rc.6 list slot validation", () => {
    const slots = registerWithSlotCore("list");
    expect(slots.entries("settings.plugin.item")[0]?.options.id)
      .toBe("dsh-oil-creator");
  });

  it("registers both compatibility coordinates through the public facade", () => {
    const register = vi.fn(() => vi.fn());
    registerCreatorSettingsCard(
      { register },
      "card",
      OPTIONS,
    );
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "settings.plugin.item",
        key: CREATOR_SETTINGS_NAMESPACE,
        id: "dsh-oil-creator",
        order: 40,
      }),
      "card",
    );
  });
});
