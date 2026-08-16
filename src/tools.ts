import { defineTool, type ToolDefinition } from "@deepseek-ai/dsh-tools";

import { isPublishMark, isPublishPlatform } from "./publishStatus.ts";
import type { OilCreatorService } from "./service.ts";
import type { CreatorProfile } from "./types.ts";

interface ToolsContext {
  tools: { register: (tool: ToolDefinition) => void };
}

function signalOf(exec: { signal: AbortSignal }): AbortSignal {
  return exec.signal;
}

function compactText(title: string, detail: string): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text: `${title}: ${detail}` }];
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as never;
}

function present(title: string, rawInput: unknown): { card: "generic"; title: string; kind: "other"; rawInput: unknown } {
  return { card: "generic", title, kind: "other", rawInput };
}

const JSON_VALUE = { type: "json" } as const;

export function registerCreatorTools(ctx: ToolsContext, service: OilCreatorService): void {
  ctx.tools.register(defineTool({
    name: "oil_create_content",
    description:
      "Create an empty dated library folder named YYYY-MM-DD_title using today's date and a readable title.",
    parameters: {
      title: { type: "string", required: true, description: "Episode title. Hyphens become spaces." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", required: true },
          folderPath: { type: "string", required: true },
        },
      },
      render: (_args, value) => compactText("Created", value.id),
    },
    presentCall: (args) => present("Create content", args),
    execute: (args, exec) => {
      if (args.title.trim() === "") throw new Error("title is required");
      return service.createContent({ title: args.title }, signalOf(exec));
    },
  }));

  ctx.tools.register(defineTool({
    name: "oil_update_content",
    description:
      "Write overlay-only marks for one episode: readyToRecord, bind a Screen Studio project, "
      + "or set a platform publish status. To change topic.md or script.md, write those files "
      + "in the episode folder with the built-in file tools.",
    parameters: {
      id: { type: "string", required: true, description: "Folder id." },
      readyToRecord: { type: "boolean", description: "True moves idle content to 待录制." },
      studioPath: { type: "string", description: "Bind a .screenstudio project to this episode." },
      publishPlatform: {
        type: "string",
        enum: ["xiaohongshu", "douyin", "bilibili", "wechat"],
        description: "Platform to mark. Pair with publishStatus.",
      },
      publishStatus: {
        type: "string",
        enum: ["unpublished", "draft", "published"],
        description: "Per-platform publish mark stored in the plugin overlay.",
      },
      publishUrl: { type: "string", description: "Optional live URL when status is published." },
    },
    output: {
      schema: JSON_VALUE,
      render: (_args, value) => {
        const record = value as { title?: string; id?: string };
        return compactText("Updated", record.title || record.id || "");
      },
    },
    presentCall: (args) => present("Update content", args),
    async execute(args, exec) {
      const signal = signalOf(exec);
      if (args.id === "") throw new Error("id is required");
      if (args.readyToRecord !== undefined) {
        await service.setContentStage({ id: args.id, readyToRecord: args.readyToRecord }, signal);
      }
      if (args.studioPath !== undefined && args.studioPath !== "") {
        await service.bindStudio({ id: args.id, path: args.studioPath }, signal);
      }
      const hasPlatform = args.publishPlatform !== undefined;
      const hasStatus = args.publishStatus !== undefined;
      if (hasPlatform !== hasStatus) {
        throw new Error("publishPlatform and publishStatus must be sent together");
      }
      if (isPublishPlatform(args.publishPlatform) && isPublishMark(args.publishStatus)) {
        await service.setPublish(
          args.publishUrl === undefined
            ? { id: args.id, platform: args.publishPlatform, status: args.publishStatus }
            : { id: args.id, platform: args.publishPlatform, status: args.publishStatus, url: args.publishUrl },
          signal,
        );
      }
      return asJson(await service.getContent({ id: args.id }, signal));
    },
  }));

  ctx.tools.register(defineTool({
    name: "oil_creator_profile",
    description:
      "Read or update oil's creator homepage links. "
      + "Omit fields to read. Send any field to merge-update.",
    parameters: {
      xiaohongshu: { type: "string", description: "Xiaohongshu handle or homepage." },
      douyin: { type: "string" },
      bilibili: { type: "string" },
      wechat: { type: "string", description: "WeChat Channels handle or homepage." },
      youtube: { type: "string" },
    },
    output: {
      schema: JSON_VALUE,
      render: () => compactText("Profile", "saved"),
    },
    presentCall: (args) => present("Creator profile", args),
    async execute(args, exec) {
      const signal = signalOf(exec);
      const current = (await service.getSettings({}, signal)).profile;
      const keys = [
        "xiaohongshu",
        "douyin",
        "bilibili",
        "wechat",
        "youtube",
      ] as const;
      const touched = keys.some((key) => typeof args[key] === "string");
      if (!touched) return asJson(current);
      const next: CreatorProfile = {
        platforms: { ...current.platforms },
      };
      for (const key of keys) {
        const value = args[key];
        if (typeof value !== "string") continue;
        if (value.trim() === "") delete next.platforms[key];
        else next.platforms[key] = value.trim();
      }
      return asJson((await service.setProfile({ profile: next }, signal)).profile);
    },
  }));

  ctx.tools.register(defineTool({
    name: "oil_organize_library",
    description:
      "Preview or apply library folder cleanup to YYYY-MM-DD_readable title. "
      + "Adds a date from the recording/folder time when missing, and turns hyphens/underscores in titles into spaces. "
      + "Never deletes files. apply=false (default) only previews. Pass ids to limit the batch.",
    parameters: {
      apply: { type: "boolean", description: "False previews. True renames folders." },
      ids: {
        type: "array",
        items: { type: "string" },
        description: "Optional folder ids to organize. Empty means the whole library.",
      },
    },
    output: {
      schema: JSON_VALUE,
      render: (_args, value) => {
        const record = value as { moves?: unknown[] };
        const moves = Array.isArray(record.moves) ? record.moves : [];
        return compactText("Organize", `${moves.length} moves`);
      },
    },
    presentCall: (args) => present("Organize library", args),
    execute: async (args, exec) => asJson(await service.organizeLibrary({
      apply: args.apply === true,
      ids: args.ids ?? [],
    }, signalOf(exec))),
  }));

  ctx.tools.register(defineTool({
    name: "oil_sync_publish",
    description:
      "Sync published titles, URLs, and counts from logged-in creator dashboards. "
      + "Pass id to update one episode only and stop paging once that title is found. "
      + "Omit id to match the whole library and collect every page. "
      + "Requires Ego Lite and an already-logged-in creator session. "
      + "Repeats within 90 seconds reuse the last snapshot.",
    parameters: {
      id: {
        type: "string",
        description: "Folder id of one episode. Omit to sync the whole library.",
      },
      platform: {
        type: "string",
        enum: ["xiaohongshu", "douyin", "bilibili", "wechat"],
        description: "Collect only this platform. Omit to visit all four.",
      },
      force: {
        type: "boolean",
        description: "Skip the 90-second cache and open creator pages again.",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          matched: { type: "integer", required: true },
          platforms: { type: "json", required: true },
          cached: { type: "boolean" },
        },
      },
      render: (_args, value) => compactText("Sync publish", `${value.matched} matched`),
    },
    presentCall: (args) => present("Sync publish", args),
    execute: (args, exec) => {
      const request: {
        id?: string;
        platform?: "xiaohongshu" | "douyin" | "bilibili" | "wechat";
        force?: boolean;
      } = {};
      if (args.id !== undefined && args.id !== "") request.id = args.id;
      if (isPublishPlatform(args.platform)) request.platform = args.platform;
      if (args.force === true) request.force = true;
      return service.syncPublish(request, signalOf(exec));
    },
  }));

  ctx.tools.register(defineTool({
    name: "oil_open_studio",
    description:
      "Open the bound Screen Studio project for this episode so the user can review and export.",
    parameters: {
      id: { type: "string", required: true, description: "Folder id." },
    },
    output: {
      schema: JSON_VALUE,
      render: (_args, value) => {
        const record = value as { title?: string; id?: string };
        return compactText("Open Studio", record.title || record.id || "");
      },
    },
    presentCall: (args) => present("Open Studio", args),
    execute: async (args, exec) => {
      if (args.id === "") throw new Error("id is required");
      return asJson(await service.openStudio({ id: args.id }, signalOf(exec)));
    },
  }));

  ctx.tools.register(defineTool({
    name: "oil_wait_export",
    description:
      "Start watching the episode folder for a finished MP4/MOV (Screen Studio export) and return immediately. "
      + "When the file is stable, the folder has the video and waitingForExport clears. "
      + "If the wait times out, waitingForExport stays and exportTimedOut is true. "
      + "Do not block this call. After starting, poll files or getContent instead of waiting here.",
    parameters: {
      id: { type: "string", required: true, description: "Folder id." },
      timeoutMs: { type: "integer", description: "Give up after this many milliseconds. Default 2 hours." },
    },
    output: {
      schema: JSON_VALUE,
      render: (_args, value) => {
        const record = value as {
          videoRaw?: string;
          videoSubtitled?: string;
          waitingForExport?: boolean;
          exportTimedOut?: boolean;
        };
        const video = record.videoRaw || record.videoSubtitled;
        return compactText(
          "Export",
          video ? "ready" : record.exportTimedOut === true ? "timed out" : record.waitingForExport ? "watching" : "still waiting",
        );
      },
    },
    presentCall: (args) => present("Wait for export", args),
    execute: async (args, exec) => {
      if (args.id === "") throw new Error("id is required");
      return asJson(await service.waitForExport(
        args.timeoutMs === undefined ? { id: args.id } : { id: args.id, timeoutMs: args.timeoutMs },
        signalOf(exec),
      ));
    },
  }));

  ctx.tools.register(defineTool({
    name: "oil_open_subtitle_preview",
    description:
      "Open the oil-subtitle preview editor in the browser for this episode (video + editable cues).",
    parameters: {
      id: { type: "string", required: true, description: "Folder id." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string", required: true },
          port: { type: "integer", required: true },
        },
      },
      render: (_args, value) => compactText("Subtitle preview", value.url),
    },
    presentCall: (args) => present("Subtitle preview", args),
    execute: (args, exec) => {
      if (args.id === "") throw new Error("id is required");
      return service.openSubtitlePreview({ id: args.id }, signalOf(exec));
    },
  }));

  ctx.tools.register(defineTool({
    name: "oil_burn_subtitles",
    description:
      "Start burning the current subtitle draft onto the raw video with oil-subtitle. "
      + "Returns immediately. When finished, the episode folder has a *_subtitled.mp4.",
    parameters: {
      id: { type: "string", required: true, description: "Folder id." },
    },
    output: {
      schema: JSON_VALUE,
      render: (_args, value) => {
        const record = value as { burn?: { status?: string } };
        return compactText("Burn", record.burn?.status || "started");
      },
    },
    presentCall: (args) => present("Burn subtitles", args),
    execute: async (args, exec) => {
      if (args.id === "") throw new Error("id is required");
      return asJson(await service.startSubtitleBurn({ id: args.id }, signalOf(exec)));
    },
  }));

  ctx.tools.register(defineTool({
    name: "oil_generate_subtitles",
    description:
      "Run the oil-subtitle workflow on the episode video: transcribe, lay out, and burn. "
      + "Requires DASHSCOPE_API_KEY (and ZENMUX_API_KEY for layout) in Settings → Plugins → 内容工作台. "
      + "Does not wait for chat review. Returns immediately. When finished, the folder has *_subtitled.mp4.",
    parameters: {
      id: { type: "string", required: true, description: "Folder id." },
    },
    output: {
      schema: JSON_VALUE,
      render: (_args, value) => {
        const record = value as { subtitleJob?: { status?: string } };
        return compactText("Subtitles", record.subtitleJob?.status || "started");
      },
    },
    presentCall: (args) => present("Generate subtitles", args),
    execute: async (args, exec) => {
      if (args.id === "") throw new Error("id is required");
      return asJson(await service.startSubtitleGenerate({ id: args.id }, signalOf(exec)));
    },
  }));

  ctx.tools.register(defineTool({
    name: "oil_generate_cover",
    description:
      "Generate 3x4 / 4x3 / 16x9 covers with oil-cover. "
      + "Requires ZENMUX_API_KEY in Settings → Plugins → 内容工作台. "
      + "Returns immediately. When finished, the episode folder has *_3x4.png / *_4x3.png / *_16x9.png.",
    parameters: {
      id: { type: "string", required: true, description: "Folder id." },
    },
    output: {
      schema: JSON_VALUE,
      render: (_args, value) => {
        const record = value as { coverJob?: { status?: string } };
        return compactText("Cover", record.coverJob?.status || "started");
      },
    },
    presentCall: (args) => present("Generate cover", args),
    execute: async (args, exec) => {
      if (args.id === "") throw new Error("id is required");
      return asJson(await service.startCoverGenerate({ id: args.id }, signalOf(exec)));
    },
  }));
}
