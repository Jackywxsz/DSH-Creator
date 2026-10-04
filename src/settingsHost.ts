import type { SettingsForms } from "@deepseek-ai/dsh-settings";

/** The custom Plugins tab owns settings; avoid a second generated config page. */
export function registerCreatorSettingsNamespace(
  settings: Pick<SettingsForms, "configure">,
): () => void {
  return settings.configure({ auto: false });
}
