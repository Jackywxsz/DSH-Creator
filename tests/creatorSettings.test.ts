import { describe, expect, it } from "vitest";

import { CREATOR_SETTINGS_PLATFORMS } from "../src/client/publishPlatforms.ts";
import { PUBLISH_PLATFORM_DEFINITIONS, PUBLISH_PLATFORMS } from "../src/platforms.ts";
import { registerCreatorTools } from "../src/tools.ts";

function registeredTools(): Map<string, { parameters: { properties: Record<string, unknown> } }> {
  const tools: Array<{ name: string; parameters: { properties: Record<string, unknown> } }> = [];
  registerCreatorTools(
    { tools: { register: (tool) => { tools.push(tool as unknown as typeof tools[number]); } } },
    {} as never,
  );
  return new Map(tools.map((tool) => [tool.name, tool]));
}

describe("creator settings platform contract", () => {
  it("exposes every shared platform as a settings option", () => {
    expect(CREATOR_SETTINGS_PLATFORMS.map((platform) => platform.key)).toEqual(PUBLISH_PLATFORMS);
    expect(CREATOR_SETTINGS_PLATFORMS.map((platform) => platform.label)).toEqual(
      PUBLISH_PLATFORMS.map((platform) => PUBLISH_PLATFORM_DEFINITIONS[platform].settingsLabel),
    );
  });

  it("exposes enabled platforms in the registered creator tools", () => {
    const tools = registeredTools();
    const setup = tools.get("oil_creator_setup");
    const profile = tools.get("oil_creator_profile");
    const setupPlatforms = setup?.parameters.properties.enabledPlatforms as { items?: { enum?: readonly string[] } };
    const profilePlatforms = profile?.parameters.properties.enabledPlatforms as { items?: { enum?: readonly string[] } };

    expect(setupPlatforms.items?.enum).toEqual(PUBLISH_PLATFORMS);
    expect(profilePlatforms.items?.enum).toEqual(PUBLISH_PLATFORMS);
    expect(setup?.parameters.properties).not.toHaveProperty("name");
    expect(setup?.parameters.properties).not.toHaveProperty("homepage");
    expect(profile?.parameters.properties).not.toHaveProperty("name");
    expect(profile?.parameters.properties).not.toHaveProperty("homepage");
  });
});
