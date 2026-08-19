import { PUBLISH_PLATFORM_DEFINITIONS, PUBLISH_PLATFORMS } from "../platforms.ts";
import type { PublishPlatform } from "../types.ts";
import type { CreatorKey } from "./locales.ts";
import type { PlatformId } from "./PlatformMark.tsx";

export const PUBLISH_UI_PLATFORMS = PUBLISH_PLATFORMS.map((key) => ({
  key,
  id: PUBLISH_PLATFORM_DEFINITIONS[key].icon as PlatformId,
  label: PUBLISH_PLATFORM_DEFINITIONS[key].inspectorLabel as CreatorKey,
}));

export const CREATOR_SETTINGS_PLATFORMS = PUBLISH_PLATFORMS.map((key) => ({
  key,
  label: PUBLISH_PLATFORM_DEFINITIONS[key].settingsLabel as CreatorKey,
}));

export function selectEnabledPublishPlatforms(
  enabledPlatforms: readonly PublishPlatform[],
): ReadonlyArray<(typeof PUBLISH_UI_PLATFORMS)[number]> {
  const enabled = new Set(enabledPlatforms);
  return PUBLISH_UI_PLATFORMS.filter((platform) => enabled.has(platform.key));
}

export function isPublishSyncDisabled(
  busy: string | undefined,
  platformSettingsPending: boolean,
  enabledPlatforms: readonly PublishPlatform[],
): boolean {
  return busy !== undefined || platformSettingsPending || selectEnabledPublishPlatforms(enabledPlatforms).length === 0;
}
