import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectResult } from "../src/collectPublish.ts";

const collect = vi.hoisted(() => ({
  calls: [] as Array<{ platforms?: readonly string[] }>,
  run: vi.fn(async (
    _script: string,
    _signal: AbortSignal,
    options: { platforms?: readonly string[] } = {},
  ): Promise<CollectResult> => {
    collect.calls.push(options.platforms === undefined ? {} : { platforms: options.platforms });
    return { collected: [] };
  }),
  open: vi.fn(async () => undefined),
}));

const chained = vi.hoisted(() => ({
  calls: [] as Array<{ script: string; env?: Record<string, string> }>,
}));

const preview = vi.hoisted(() => ({
  nextPid: 41001,
  terminateCalls: [] as number[],
  waitMode: "failure" as "failure" | "abort",
  abortController: undefined as AbortController | undefined,
  ownedCommands: new Map<number, string>(),
}));

vi.mock("../src/collectEgo.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/collectEgo.ts")>();
  return { ...actual, runCollectPublish: collect.run, openCreatorPlatform: collect.open };
});

vi.mock("../src/subtitle.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/subtitle.ts")>();
  return {
    ...actual,
    spawnPython: vi.fn((_python: string, script: string, _args: readonly string[], env?: Record<string, string>) => {
      chained.calls.push({ script, ...(env === undefined ? {} : { env }) });
      return {
        pid: preview.nextPid++,
        stderr: undefined,
        once: (_event: string, listener: (code: number) => void) => {
          queueMicrotask(() => listener(0));
          return undefined;
        },
        unref: vi.fn(),
      } as never;
    }),
    waitHttp: vi.fn(async (_url: string, _timeoutMs: number, _signal: AbortSignal) => {
      if (preview.waitMode === "abort") {
        preview.abortController?.abort(new Error("preview aborted"));
        throw new Error("preview aborted");
      }
      throw new Error("preview did not start");
    }),
  };
});

vi.mock("../src/processAlive.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/processAlive.ts")>();
  return {
    ...actual,
    jobPidMatches: vi.fn((pid: number | undefined, fragments: readonly string[]) => {
      if (pid === undefined || !actual.pidAlive(pid)) return false;
      const command = preview.ownedCommands.get(pid) ?? actual.pidCommand(pid);
      return command !== undefined && fragments.some((fragment) => command.includes(fragment));
    }),
    terminateOwnedProcess: vi.fn(async (pid: number | undefined) => {
      if (pid !== undefined) preview.terminateCalls.push(pid);
      return true;
    }),
  };
});

import { OilCreatorService } from "../src/service.ts";
import { saveCollectCache } from "../src/collectCache.ts";
import { emptyOverlay, loadOverlay, saveOverlay } from "../src/overlay.ts";
import { emptyBurn, emptyPublish } from "../src/publishStatus.ts";
import { loadPreviewRegistry } from "../src/previewServers.ts";
import type { ContentDetail, ContentSummary, CreatorProfile, OverlayItem } from "../src/types.ts";

function item(folderPath: string, videoRaw: string): ContentSummary {
  return {
    id: "2026-08-13_demo",
    folderPath,
    title: "Demo title",
    recordedAt: 1,
    createdMs: 1,
    videoRaw,
    covers: {},
    subtitles: {},
    presentations: {},
    hasPublishPackage: false,
    hasArticle: false,
    waitingForExport: false,
    tags: [],
    pipeline: "raw",
    workflow: "finish",
    publish: emptyPublish(),
    burn: emptyBurn(),
    subtitleJob: emptyBurn(),
    coverJob: emptyBurn(),
  };
}

describe("OilCreatorService.startSubtitleGenerate", () => {
  it("always prepares subtitles without resolving or injecting the cover credential", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-service-subtitle-"));
    const video = join(folder, "demo.mp4");
    await writeFile(video, "v");

    let launch: Parameters<OilCreatorService["startChainedJob"]>[2] | undefined;
    const service = Object.create(OilCreatorService.prototype) as OilCreatorService;
    const probe = service as unknown as {
      ctx: { get: (name: string) => unknown };
      find: () => Promise<ContentSummary>;
      subtitleSkill: () => Promise<{ root: string; python: string }>;
      startChainedJob: (
        id: string,
        field: "burn" | "subtitleJob" | "coverJob",
        nextLaunch: Parameters<OilCreatorService["startChainedJob"]>[2],
        signal: AbortSignal,
      ) => Promise<ContentDetail>;
    };
    probe.ctx = {
      get: () => ({
        resolve: async (ref: string) => {
          if (ref === "ZENMUX_API_KEY") throw new Error("cover credential must not be requested");
          return ref === "DASHSCOPE_API_KEY" ? { value: "subtitle-key" } : undefined;
        },
        describe: async () => ({ configured: true, writable: false }),
      }),
    };
    probe.find = async () => item(folder, video);
    probe.subtitleSkill = async () => ({ root: "/tmp/oil-subtitle", python: "/tmp/python" });
    probe.startChainedJob = async (_id, _field, nextLaunch) => {
      launch = nextLaunch;
      return undefined as never;
    };

    await service.startSubtitleGenerate({ id: "2026-08-13_demo" }, new AbortController().signal);

    expect(launch?.steps).toHaveLength(3);
    expect(launch?.steps[0]?.script.endsWith("bailian_transcribe.py")).toBe(true);
    expect(launch?.steps[1]?.script.endsWith("review_subtitles.py")).toBe(true);
    expect(launch?.steps[2]?.script.endsWith("prepare_subtitles.py")).toBe(true);
    expect(launch?.steps.some((step) => step.script.endsWith("burn_subtitles.py"))).toBe(false);
    expect(launch?.env).toEqual({ DASHSCOPE_API_KEY: "subtitle-key" });
  });
});

describe("OilCreatorService.startChainedJob", () => {
  it("passes each step only its declared credential", async () => {
    chained.calls.length = 0;
    const service = Object.create(OilCreatorService.prototype) as OilCreatorService;
    const probe = service as unknown as {
      patchItem: () => Promise<ContentDetail>;
    };
    probe.patchItem = async () => undefined as never;

    await service.startChainedJob("demo", "subtitleJob", {
      python: "/tmp/python",
      env: { DASHSCOPE_API_KEY: "dash", ZENMUX_API_KEY: "zen" },
      steps: [
        { script: "bailian_transcribe.py", args: [], output: "transcript", env: "subtitle" },
        { script: "review_subtitles.py", args: [], output: "reviewed", env: "subtitle" },
        { script: "prepare_subtitles.py", args: [], output: "prepared", env: "none" },
      ],
    }, new AbortController().signal);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(chained.calls).toEqual([
      { script: "bailian_transcribe.py", env: { DASHSCOPE_API_KEY: "dash" } },
      { script: "review_subtitles.py", env: { DASHSCOPE_API_KEY: "dash" } },
      { script: "prepare_subtitles.py" },
    ]);
  });
});

describe("OilCreatorService.openSubtitlePreview", () => {
  async function previewService(folder: string, video: string): Promise<OilCreatorService> {
    const service = Object.create(OilCreatorService.prototype) as OilCreatorService;
    const previewItem = item(folder, video);
    previewItem.subtitles = { srt: join(folder, "demo.srt") };
    const probe = service as unknown as {
      dataDir: string;
      previews: OilCreatorService["previews"];
      find: () => Promise<ContentSummary>;
      subtitleSkill: () => Promise<{ root: string; python: string }>;
    };
    probe.dataDir = folder;
    probe.previews = new Map();
    probe.find = async () => previewItem;
    probe.subtitleSkill = async () => ({ root: "/tmp/oil-subtitle", python: "/tmp/python" });
    return service;
  }

  it.each(["failure", "abort"] as const)("terminates and cleans up after waitHttp %s", async (mode) => {
    const folder = await mkdtemp(join(tmpdir(), "oil-service-preview-"));
    const video = join(folder, "demo.mp4");
    await writeFile(video, "v");
    await writeFile(join(folder, "demo.srt"), "1\n00:00:00,000 --> 00:00:01,000\n字幕\n");
    preview.waitMode = mode;
    preview.abortController = new AbortController();
    preview.terminateCalls.length = 0;
    const service = await previewService(folder, video);

    await expect(service.openSubtitlePreview({ id: "2026-08-13_demo" }, preview.abortController.signal))
      .rejects.toThrow(mode === "failure" ? "preview did not start" : "preview aborted");

    expect(preview.terminateCalls).toHaveLength(1);
    expect(service.previews.size).toBe(0);
    expect(loadPreviewRegistry(join(folder, "preview-servers.json"))).toEqual([]);
  });
});

async function syncService(profile: CreatorProfile): Promise<OilCreatorService> {
  const dataDir = await mkdtemp(join(tmpdir(), "oil-service-sync-"));
  const overlay = emptyOverlay();
  overlay.profile = profile;
  await saveOverlay(dataDir, overlay);
  const service = Object.create(OilCreatorService.prototype) as OilCreatorService;
  const probe = service as unknown as {
    dataDir: string;
    scanned: () => Promise<{ items: ContentSummary[] }>;
    invalidateCatalog: () => void;
  };
  probe.dataDir = dataDir;
  probe.scanned = async () => ({ items: [] });
  probe.invalidateCatalog = () => undefined;
  return service;
}

describe("OilCreatorService.syncPublish", () => {
  beforeEach(() => {
    collect.calls.length = 0;
    collect.run.mockClear();
  });

  it("passes the enabled platforms to the collector by default", async () => {
    const service = await syncService({ enabledPlatforms: ["douyin", "wechat"] });

    await service.syncPublish({}, new AbortController().signal);

    expect(collect.calls).toEqual([{ platforms: ["douyin", "wechat"] }]);
  });

  it("rejects an explicitly requested disabled platform", async () => {
    const service = await syncService({ enabledPlatforms: ["douyin"] });

    await expect(service.syncPublish({ platform: "wechat" }, new AbortController().signal))
      .rejects.toThrow("publish platform is disabled: wechat");
    expect(collect.calls).toEqual([]);
  });

  it("returns without invoking the collector when all platforms are disabled", async () => {
    const service = await syncService({ enabledPlatforms: [] });

    await expect(service.syncPublish({}, new AbortController().signal)).resolves.toEqual({
      matched: 0,
      platforms: [],
    });
    expect(collect.calls).toEqual([]);
  });

  it("does not use a fresh cache that omits an enabled platform", async () => {
    const service = await syncService({ enabledPlatforms: ["douyin", "wechat"] });
    const dataDir = (service as unknown as { dataDir: string }).dataDir;
    await saveCollectCache(dataDir, {
      collected: [{ platform: "douyin", items: [] }],
    }, { scope: "library" });

    await service.syncPublish({}, new AbortController().signal);

    expect(collect.calls).toEqual([{ platforms: ["douyin", "wechat"] }]);
  });

  it("checks a requested content id before the empty-platform early return", async () => {
    const service = await syncService({ enabledPlatforms: [] });

    await expect(service.syncPublish({ id: "missing" }, new AbortController().signal))
      .rejects.toThrow("content not found: missing");
    expect(collect.calls).toEqual([]);
  });
});

describe("OilCreatorService platform login setup", () => {
  beforeEach(() => {
    collect.run.mockClear();
    collect.open.mockClear();
  });

  it("does not claim authentication from an empty but reachable creator page", async () => {
    collect.run.mockResolvedValueOnce({
      collected: [
        { platform: "xiaohongshu", items: [{ platform: "xiaohongshu", title: "demo" }] },
        { platform: "douyin", items: [] },
        { platform: "bilibili", items: [], loginRequired: true },
        { platform: "wechat", items: [], error: "page failed" },
      ],
    });
    const service = Object.create(OilCreatorService.prototype) as OilCreatorService;
    (service as unknown as { dataDir: string }).dataDir = await mkdtemp(join(tmpdir(), "login-check-"));
    const result = await service.checkPlatformLogins({
      platforms: ["xiaohongshu", "douyin", "bilibili", "wechat"],
    }, new AbortController().signal);

    expect(result.platforms).toEqual([
      { platform: "xiaohongshu", state: "authenticated" },
      { platform: "douyin", state: "unknown", detail: expect.stringContaining("无法") },
      { platform: "bilibili", state: "loginRequired" },
      { platform: "wechat", state: "error", detail: "page failed" },
    ]);
    expect(collect.run.mock.calls[0]?.[2]).toMatchObject({
      platforms: ["xiaohongshu", "douyin", "bilibili", "wechat"],
      maxPages: 1,
      xhsScrollSteps: 1,
      cleanupStale: false,
    });
  });

  it("opens only the requested creator backend and leaves publishing untouched", async () => {
    const signal = new AbortController().signal;
    await expect(serviceOfPrototype().openPlatformLogin({ platform: "douyin" }, signal))
      .resolves.toEqual({ opened: true });
    expect(collect.open).toHaveBeenCalledWith("douyin", signal);
    expect(collect.run).not.toHaveBeenCalled();
  });
});

function serviceOfPrototype(): OilCreatorService {
  return Object.create(OilCreatorService.prototype) as OilCreatorService;
}

describe("OilCreatorService.setPublish", () => {
  it("forwards an explicit publication date when updating a published item", async () => {
    const service = await syncService({ enabledPlatforms: ["bilibili"] });
    const overlayItem: OverlayItem = {
      publish: { bilibili: { status: "published", publishedAt: 1_000 } },
    };
    const probe = service as unknown as {
      patchItem: (
        id: string,
        mutate: (item: OverlayItem) => void,
        signal: AbortSignal,
      ) => Promise<ContentDetail>;
    };
    probe.patchItem = async (_id, mutate) => {
      mutate(overlayItem);
      return undefined as never;
    };

    await service.setPublish({
      id: "2026-08-13_demo",
      platform: "bilibili",
      status: "published",
      publishedAt: 2_000,
    }, new AbortController().signal);

    expect(overlayItem.publish?.bilibili?.publishedAt).toBe(2_000);
  });
});

describe("OilCreatorService subtitle job reconcile", () => {
  async function overlayService(item: OverlayItem) {
    const dataDir = await mkdtemp(join(tmpdir(), "oil-service-job-"));
    const libraryRoot = await mkdtemp(join(tmpdir(), "oil-service-lib-"));
    const overlay = emptyOverlay();
    overlay.libraryRoot = libraryRoot;
    overlay.items.demo = item;
    await saveOverlay(dataDir, overlay);
    const service = Object.create(OilCreatorService.prototype) as OilCreatorService;
    const probe = service as unknown as {
      dataDir: string;
      libraryRoot: string;
      cache: undefined;
      watchedRoot: string;
      watchClose: () => void;
      catalogRevision: number;
      exportWaiters: Map<string, AbortController>;
    };
    probe.dataDir = dataDir;
    probe.libraryRoot = libraryRoot;
    probe.cache = undefined;
    probe.watchedRoot = libraryRoot;
    probe.watchClose = () => undefined;
    probe.catalogRevision = 0;
    probe.exportWaiters = new Map();
    return { dataDir, service };
  }

  function liveScript(script: string) {
    const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)", script], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    if (child.pid !== undefined) preview.ownedCommands.set(child.pid, script);
    return child;
  }

  it("keeps subtitleJob running while prepare_subtitles.py is still the pid", async () => {
    const child = liveScript("prepare_subtitles.py");
    expect(child.pid).toBeTypeOf("number");
    try {
      const { dataDir, service } = await overlayService({
        subtitleJob: {
          status: "running",
          startedAt: 1,
          output: join(tmpdir(), "missing-transcript.json"),
          pid: child.pid as number,
        },
      });
      await service.scanned();
      const overlay = await loadOverlay(dataDir);
      expect(overlay.items.demo?.subtitleJob?.status).toBe("running");
    } finally {
      if (child.pid !== undefined) {
        preview.ownedCommands.delete(child.pid);
        process.kill(child.pid);
      }
    }
  });

  it("recovers a false process-exited error while burn_subtitles.py is still running", async () => {
    const child = liveScript("burn_subtitles.py");
    expect(child.pid).toBeTypeOf("number");
    try {
      const { dataDir, service } = await overlayService({
        burn: {
          status: "running",
          startedAt: 1,
          output: join(tmpdir(), "missing-subtitled.mp4"),
          pid: child.pid as number,
        },
        subtitleJob: {
          status: "error",
          startedAt: 1,
          output: join(tmpdir(), "missing-subtitled.mp4"),
          error: "subtitleJob process exited",
        },
      });
      await service.scanned();
      const overlay = await loadOverlay(dataDir);
      expect(overlay.items.demo?.subtitleJob).toMatchObject({
        status: "running",
        pid: child.pid,
      });
    } finally {
      if (child.pid !== undefined) {
        preview.ownedCommands.delete(child.pid);
        process.kill(child.pid);
      }
    }
  });
});

describe("OilCreatorService.bindStudio", () => {
  it("resolves the only Screen Studio project inside a selected directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "oil-service-studio-"));
    const project = join(root, "Area 2026-08-24.screenstudio");
    await mkdir(project);
    await writeFile(join(project, "project.json"), "{}");

    const service = Object.create(OilCreatorService.prototype) as OilCreatorService;
    let boundPath: string | undefined;
    const probe = service as unknown as {
      patchItem: (
        id: string,
        mutate: (item: OverlayItem) => void,
        signal: AbortSignal,
      ) => Promise<ContentDetail>;
    };
    probe.patchItem = async (_id, mutate) => {
      const item: OverlayItem = {};
      mutate(item);
      boundPath = item.studioPath;
      return undefined as never;
    };

    try {
      await service.bindStudio({ id: "demo", path: root }, new AbortController().signal);
      expect(boundPath).toBe(project);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("OilCreatorService.setContentSkip", () => {
  it("adds and removes only the requested optional step", async () => {
    const service = Object.create(OilCreatorService.prototype) as OilCreatorService;
    const overlayItem: OverlayItem = { skippedSteps: ["subtitle"] };
    const probe = service as unknown as {
      find: () => Promise<ContentSummary | undefined>;
      patchItem: (
        id: string,
        mutate: (item: OverlayItem) => void,
        signal: AbortSignal,
      ) => Promise<ContentDetail>;
    };
    probe.find = async () => ({} as ContentSummary);
    probe.patchItem = async (_id, mutate) => {
      mutate(overlayItem);
      return undefined as never;
    };

    const signal = new AbortController().signal;
    await service.setContentSkip({ id: "demo", step: "presentation", skipped: true }, signal);
    expect(overlayItem.skippedSteps).toEqual(["subtitle", "presentation"]);

    await service.setContentSkip({ id: "demo", step: "subtitle", skipped: false }, signal);
    expect(overlayItem.skippedSteps).toEqual(["presentation"]);
  });

  it("does not create overlay state for content that no longer exists", async () => {
    const service = Object.create(OilCreatorService.prototype) as OilCreatorService;
    const patchItem = vi.fn();
    const probe = service as unknown as {
      find: () => Promise<ContentSummary | undefined>;
      patchItem: typeof patchItem;
    };
    probe.find = async () => undefined;
    probe.patchItem = patchItem;

    await expect(service.setContentSkip(
      { id: "missing", step: "article", skipped: true },
      new AbortController().signal,
    )).rejects.toThrow("content not found: missing");
    expect(patchItem).not.toHaveBeenCalled();
  });
});
