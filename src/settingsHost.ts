import Schema from "@deepseek-ai/schemastery";
import { settingsNamespace, type SettingsProvider } from "@deepseek-ai/dsh-settings";

import { CREATOR_SETTINGS_NAMESPACE } from "./settingsContract.ts";

/**
 * Harness rc.7 dispatches settings cards only for Host-registered namespaces.
 * The card's values still live in the plugin overlay and travel through the
 * typed Remote so rc.6 users and AI tools keep one authoritative data source.
 */
export const CREATOR_SETTINGS_DISCOVERY_SCHEMA = Schema.object({});

export function registerCreatorSettingsNamespace(
  settings: Pick<SettingsProvider, "register">,
): void {
  settings.register(
    settingsNamespace(CREATOR_SETTINGS_NAMESPACE),
    CREATOR_SETTINGS_DISCOVERY_SCHEMA,
  );
}
