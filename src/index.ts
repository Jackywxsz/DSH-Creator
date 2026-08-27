import type { Context } from "@deepseek-ai/cordis";

import { Config, migrateLegacyDefaultState, resolveCockpitDataDir } from "./config.ts";
import { CreatorCockpitService } from "./cockpit/service.ts";
import { registerCockpitTools } from "./cockpit/tools.ts";
import { registerCreatorWorkbenchSkill } from "./creatorSkill.ts";
import { registerLibraryPrompt } from "./libraryPrompt.ts";
import { OilCreatorService } from "./service.ts";
import { registerCreatorSettingsNamespace } from "./settingsHost.ts";
import { registerCreatorTools } from "./tools.ts";

export const name = "jacky-creator";
export { Config };
export type { Config as ConfigType } from "./config.ts";

export function apply(ctx: Context, config: Config): void {
  migrateLegacyDefaultState(config);
  const service = new OilCreatorService(ctx, config);
  const cockpit = new CreatorCockpitService(ctx, resolveCockpitDataDir(config), service);
  ctx.inject(["settings"], (settingsCtx) => {
    registerCreatorSettingsNamespace(settingsCtx.settings);
  });
  ctx.inject(["tools"], (toolsCtx) => {
    registerCreatorTools(toolsCtx as never, service);
    registerCockpitTools(toolsCtx as never, cockpit);
  });
  ctx.inject(["systemPrompt"], (promptCtx) => {
    registerLibraryPrompt(promptCtx as never, service);
  });
  ctx.inject(["skills"], (skillsCtx) => {
    registerCreatorWorkbenchSkill(skillsCtx as never);
  });
}
