import type { ClientContext, WorkspaceId } from "@deepseek-ai/dsh-client-runtime/client";
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type {} from "@deepseek-ai/dsh-client-ui-layout/client";
import type {} from "@deepseek-ai/dsh-api-remotes/client";
import type {} from "@deepseek-ai/dsh-client-connection/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client";

import { TYPERT_REMOTE } from "../remote.ts";
import { CREATOR_SETTINGS_NAMESPACE } from "../settingsContract.ts";
import { startLibraryLiveSync } from "./catalogSync.ts";
import { remountPluginCss, releasePluginCss } from "./pluginCss.ts";
import { releaseShellChrome } from "./contentSelection.ts";
import { registerContentTriggers } from "./contentTriggers.ts";
import type {
  ContentDetail,
  ContentFilter,
  CoverThumbResult,
  CreateContentResult,
  CreatorCapabilities,
  CreatorProfile,
  LibrarySettings,
  ListContentsResult,
  PublishMark,
  PublishPlatform,
  SubtitlePreviewResult,
  SyncPublishResult,
  ArticleMediaResult,
  VideoPlaybackResult,
} from "../types.ts";
import { ContentInspector } from "./ContentInspector.tsx";
import {
  bumpLibrary,
  bumpProfile,
  getSelectedContentId,
  setSelectedContentId,
  subscribeSelectedContentId,
} from "./contentSelection.ts";
import type { CredentialsClient } from "./credentialsApi.ts";
import { CreatorSettingsCard } from "./CreatorSettingsCard.tsx";
import type { CreatorViewFace } from "./face.ts";
import { en, NS, type CreatorKey, zh } from "./locales.ts";
import { OilSidebarRoot } from "./sidebar/OilSidebarRoot.tsx";
import type { OilSidebarInjected, OilSidebarSlotProps } from "./sidebar/slots.ts";
import {
  registerCreatorSettingsCard,
  type CompatibleSettingsSlots,
} from "./settingsSlot.ts";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "dsh.oil.creator": CreatorKey;
  }
}

interface RemoteAnswer<T> {
  ok: boolean;
  value?: T;
  error?: { code: string; message: string };
}

interface OilCreatorRemote {
  listContents: (request: { query: string; filter: ContentFilter }) => Promise<RemoteAnswer<ListContentsResult>>;
  getContent: (request: { id: string }) => Promise<RemoteAnswer<ContentDetail>>;
  getCoverThumb: (request: { id: string }) => Promise<RemoteAnswer<CoverThumbResult>>;
  getVideoPlayback: (request: { id: string }) => Promise<RemoteAnswer<VideoPlaybackResult>>;
  getArticleMedia: (request: { id: string }) => Promise<RemoteAnswer<ArticleMediaResult>>;
  getSubtitleText: (request: { id: string }) => Promise<RemoteAnswer<{ text: string; cues: Array<{ text: string; at?: string }> }>>;
  getSettings: (request: Record<string, never>) => Promise<RemoteAnswer<LibrarySettings>>;
  getCapabilities: (request: Record<string, never>) => Promise<RemoteAnswer<{ capabilities: CreatorCapabilities }>>;
  getRevision: (request: Record<string, never>) => Promise<RemoteAnswer<{ revision: number }>>;
  setLibraryRoot: (request: { path: string }) => Promise<RemoteAnswer<LibrarySettings>>;
  setProfile: (request: { profile: CreatorProfile }) => Promise<RemoteAnswer<LibrarySettings>>;
  setScriptRules: (request: { text: string }) => Promise<RemoteAnswer<LibrarySettings>>;
  refreshCatalog: (request: Record<string, never>) => Promise<RemoteAnswer<ListContentsResult>>;
  createContent: (request: { title: string }) => Promise<RemoteAnswer<CreateContentResult>>;
  setContentStage: (request: { id: string; readyToRecord: boolean }) => Promise<RemoteAnswer<ContentDetail>>;
  bindStudio: (request: { id: string; path: string }) => Promise<RemoteAnswer<ContentDetail>>;
  openStudio: (request: { id: string }) => Promise<RemoteAnswer<ContentDetail>>;
  setPublish: (request: {
    id: string;
    platform: PublishPlatform;
    status: PublishMark;
    url?: string;
  }) => Promise<RemoteAnswer<ContentDetail>>;
  syncPublish: (request: { id?: string; platform?: PublishPlatform; force?: boolean }) => Promise<RemoteAnswer<SyncPublishResult>>;
  openSubtitlePreview: (request: { id: string }) => Promise<RemoteAnswer<SubtitlePreviewResult>>;
  startSubtitleBurn: (request: { id: string }) => Promise<RemoteAnswer<ContentDetail>>;
  startSubtitleGenerate: (request: { id: string }) => Promise<RemoteAnswer<ContentDetail>>;
  startCoverGenerate: (request: { id: string }) => Promise<RemoteAnswer<ContentDetail>>;
  setScript: (request: { id: string; text: string }) => Promise<RemoteAnswer<ContentDetail>>;
}

function credentialsOf(ctx: ClientContext): CredentialsClient | undefined {
  const connection = ctx.get("connection") as { api?: { credentials?: CredentialsClient } } | undefined;
  return connection?.api?.credentials;
}

function unwrap<T>(answer: RemoteAnswer<T>, fallback: string): T {
  if (!answer.ok || answer.value === undefined) {
    throw new Error(answer.error?.message ?? fallback);
  }
  return answer.value;
}

export const inject = ["slots", "locale", "remote", "workspaces", "layout", "connection"];

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-oil-creator: dictionaries");
  ctx.effect(() => {
    remountPluginCss();
    return () => {
      releasePluginCss();
      releaseShellChrome();
    };
  }, "dsh-oil-creator: chrome");
  const remoteOf = (): OilCreatorRemote | undefined =>
    ctx.get("remote.oilCreator") as OilCreatorRemote | undefined;

  const face = (): CreatorViewFace => ({
    ready: () => remoteOf() !== undefined,
    listContents: async (query, filter) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.listContents({ query, filter }), "list failed");
    },
    getContent: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.getContent({ id }), "content failed");
    },
    getCoverThumb: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) return { found: false, mime: "", base64: "" };
      const answer = await remote.getCoverThumb({ id });
      return answer.ok && answer.value !== undefined
        ? answer.value
        : { found: false, mime: "", base64: "" };
    },
    getVideoPlayback: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) return { found: false, url: "", kind: "raw" };
      const answer = await remote.getVideoPlayback({ id });
      return answer.ok && answer.value !== undefined
        ? answer.value
        : { found: false, url: "", kind: "raw" };
    },
    getArticleMedia: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) return { found: false, origin: "" };
      const answer = await remote.getArticleMedia({ id });
      return answer.ok && answer.value !== undefined
        ? answer.value
        : { found: false, origin: "" };
    },
    getSubtitleText: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) return { text: "", cues: [] };
      const answer = await remote.getSubtitleText({ id });
      return answer.ok && answer.value !== undefined ? answer.value : { text: "", cues: [] };
    },
    pickDirectory: () => ctx.workspaces.pickDirectory(),
    openPath: (path) => ctx.workspaces.openPath(path),
    getSettings: async () => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.getSettings({}), "settings failed");
    },
    getCapabilities: async () => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.getCapabilities({}), "capabilities failed").capabilities;
    },
    getRevision: async () => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.getRevision({}), "revision failed").revision;
    },
    setLibraryRoot: async (path) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      unwrap(await remote.setLibraryRoot({ path }), "set root failed");
      bumpLibrary();
    },
    setProfile: async (profile) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      unwrap(await remote.setProfile({ profile }), "set profile failed");
      bumpProfile();
    },
    setScriptRules: async (text) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      unwrap(await remote.setScriptRules({ text }), "set script rules failed");
      bumpProfile();
    },
    refreshCatalog: async () => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const listed = unwrap(await remote.refreshCatalog({}), "refresh failed");
      bumpLibrary();
      return listed;
    },
    createContent: async (title) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const created = unwrap(await remote.createContent({ title }), "create failed");
      bumpLibrary();
      return created;
    },
    markReadyToRecord: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const next = unwrap(await remote.setContentStage({ id, readyToRecord: true }), "stage failed");
      bumpLibrary();
      return next;
    },
    bindStudio: async (id, path) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const next = unwrap(await remote.bindStudio({ id, path }), "bind failed");
      bumpLibrary();
      return next;
    },
    openStudio: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.openStudio({ id }), "open failed");
    },
    setPublish: async (id, platform, status, url) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const next = unwrap(
        await remote.setPublish(url === undefined ? { id, platform, status } : { id, platform, status, url }),
        "publish failed",
      );
      bumpLibrary();
      return next;
    },
    syncPublish: async (request) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const result = unwrap(
        await remote.syncPublish(request ?? {}),
        "sync failed",
      );
      bumpLibrary();
      return result;
    },
    openSubtitlePreview: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.openSubtitlePreview({ id }), "preview failed");
    },
    startSubtitleBurn: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const next = unwrap(await remote.startSubtitleBurn({ id }), "burn failed");
      bumpLibrary();
      return next;
    },
    startSubtitleGenerate: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const next = unwrap(await remote.startSubtitleGenerate({ id }), "transcribe failed");
      bumpLibrary();
      return next;
    },
    startCoverGenerate: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const next = unwrap(await remote.startCoverGenerate({ id }), "cover failed");
      bumpLibrary();
      return next;
    },
    setScript: async (id, text) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.setScript({ id, text }), "script failed");
    },
  });

  const contentFace = face();

  ctx.effect(() => {
    const triggers = ctx.get("inputTriggers") as
      | Parameters<typeof registerContentTriggers>[0]
      | undefined;
    return registerContentTriggers(
      triggers,
      (id) => contentFace.getContent(id),
      async () => {
        const listed = await contentFace.listContents("", "all");
        return listed.items.map((item) => ({ id: item.id, title: item.title }));
      },
    );
  }, "dsh-oil-creator: content triggers");

  const injectSidebar = (): OilSidebarInjected => ({
    startSession: (workspaceId?: WorkspaceId) => {
      ctx.workspaces.startSession(workspaceId);
    },
    toggleSidebar: () => {
      ctx.layout.toggleSidebar();
    },
  });

  function BoundSidebar(props: OilSidebarSlotProps) {
    const contentT = ctx.locale.bind(NS);
    return (
      <OilSidebarRoot
        {...props}
        tabLabels={{
          sessions: contentT("tab.sessions"),
          content: contentT("tab"),
        }}
        contentFace={contentFace}
        contentT={contentT}
      />
    );
  }

  ctx.slots.inject("sidebar", () =>
    ctx.slots.register({
      name: "sidebar",
      locale: NS,
      priority: -1,
      children: {
        "sidebar.workspaces": { kind: "single", scope: "root" },
        "sidebar.settings": { kind: "single", scope: "root" },
        "sidebar.footer.action": { kind: "list", scope: "root" },
      },
      inject: injectSidebar,
    }, BoundSidebar),
  );

  ctx.effect(async () => {
    const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE);
    // Cordis waits for async effect setup during unload. Do not install new
    // slots after the owner has already entered teardown; release the remote
    // contribution immediately in that race.
    if (ctx.fiber.state >= 5) {
      await disposeRemote();
      return () => {};
    }
    bumpProfile();

    const stopOverlay = ctx.slots.inject("shell.overlay", () => {
      let disposeOccupant: (() => void) | undefined;
      const release = (): void => {
        disposeOccupant?.();
        disposeOccupant = undefined;
      };
      const sync = (): void => {
        if (getSelectedContentId() === null) {
          release();
          return;
        }
        if (disposeOccupant !== undefined) return;
        disposeOccupant = ctx.slots.register({
          name: "shell.overlay",
          id: "oil-creator-inspector",
          order: 20,
          locale: NS,
          inject: () => ({
            ...face(),
            closeDetails: () => {
              setSelectedContentId(null);
            },
          }),
        }, ContentInspector);
      };
      const stop = subscribeSelectedContentId(sync);
      sync();
      return () => {
        stop();
        release();
      };
    });
    const stopSettings = ctx.slots.inject("settings.plugin.item", () =>
      registerCreatorSettingsCard(
        ctx.slots as unknown as CompatibleSettingsSlots,
        CreatorSettingsCard,
        {
          namespace: CREATOR_SETTINGS_NAMESPACE,
          legacyId: "dsh-oil-creator",
          legacyOrder: 40,
          locale: NS,
          inject: () => ({
            ...face(),
            credentials: credentialsOf(ctx),
          }),
        },
      ));
    const stopLive = startLibraryLiveSync(() => contentFace.getRevision());

    return async () => {
      stopLive();
      stopOverlay();
      stopSettings();
      await disposeRemote();
    };
  }, "dsh-oil-creator: remote-view");
}
