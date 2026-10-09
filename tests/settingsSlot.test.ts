import { SlotCore } from "@deepseek-ai/dsh-client-ui-slots";
import { describe, expect, it } from "vitest";
import { registerCreatorSettingsCard, type CompatibleSettingsSlots } from "../src/client/settingsSlot.ts";

describe("settings.plugins.tab compatibility", () => {
  it("registers a labelled tab in the official slot and disposes it", () => {
    const slots = new SlotCore();
    slots.register({
      name: "root",
      children: { "settings.plugins.tab": { kind: "list", scope: "root" } },
    } as never, (() => null) as never);
    const dispose = registerCreatorSettingsCard(slots as unknown as CompatibleSettingsSlots, () => null, {
      namespace: "jacky-creator", legacyId: "jacky-creator", legacyOrder: 40,
      locale: "dsh.jacky.creator", inject: () => ({}),
    });
    expect(slots.entries("settings.plugins.tab")[0]?.options).toMatchObject({
      id: "jacky-creator", order: 40, label: "Jacky Creator",
    });
    dispose();
    expect(slots.entries("settings.plugins.tab")).toHaveLength(0);
  });
});
