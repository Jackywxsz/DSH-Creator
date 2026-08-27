import type { ClientContext, WorkspaceId } from "@deepseek-ai/dsh-client-runtime/client";
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type {} from "@deepseek-ai/dsh-client-ui-layout/client";
import type {} from "@deepseek-ai/dsh-api-remotes/client";
import type { IApiClient } from "@deepseek-ai/dsh-client-connection/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client";

import { TYPERT_REMOTE } from "../remote.ts";
import { CREATOR_SETTINGS_NAMESPACE } from "../settingsContract.ts";
import { startLibraryLiveSync } from "./catalogSync.ts";
import {
  mountJackyBrandScope,
  remountPluginCss,
  releasePluginCss,
} from "./pluginCss.ts";
import { releaseShellChrome } from "./contentSelection.ts";
import { registerContentTriggers } from "./contentTriggers.ts";
import type {
  ContentDetail,
  ContentFilter,
  ContentOptionalStep,
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
import { openNativePath } from "./nativePaths.ts";
import {
  bumpLibrary,
  bumpProfile,
  getSelectedContentId,
  getSidebarTab,
  setSelectedContentId,
  setSidebarTab,
  subscribeSelectedContentId,
  subscribeSidebarChrome,
} from "./contentSelection.ts";
import type { CredentialsClient } from "./credentialsApi.ts";
import type {
  CockpitState,
  CreateFollowerSnapshotRequest,
  CreateGoalRequest,
  CreateIdeaRequest,
  CreateScheduleItemRequest,
  SetContentMetaRequest,
  UpdateGoalRequest,
  UpdateIdeaRequest,
  UpdateCockpitSettingsRequest,
  UpdateKnowledgeRequest,
  UpdateScheduleItemRequest,
  KnowledgeRequest,
  PromoteIdeaRequest,
  PromotionResult,
  RestoreCockpitStateRequest,
} from "../cockpit/schemas.ts";
import type { CreatorCockpitFace } from "./operations/face.ts";
import { CreatorSettingsCard } from "./CreatorSettingsCard.tsx";
import type { CreatorViewFace } from "./face.ts";
import { en, NS, type CreatorKey, zh } from "./locales.ts";
import { OilSidebarRoot } from "./sidebar/OilSidebarRoot.tsx";
import { OperationsWorkspace } from "./operations/OperationsWorkspace.tsx";
import { CockpitSessionBridge } from "./operations/sessionBridge.tsx";
import type { OilSidebarInjected, OilSidebarSlotProps } from "./sidebar/slots.ts";
import {
  registerCreatorSettingsCard,
  type CompatibleSettingsSlots,
} from "./settingsSlot.ts";
import { JackyConversationHero } from "./brand/JackyConversationHero.tsx";
import "./brand/JackyBrand.css";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "dsh.jacky.creator": CreatorKey;
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
  setContentSkip: (request: { id: string; step: ContentOptionalStep; skipped: boolean }) => Promise<RemoteAnswer<ContentDetail>>;
  bindStudio: (request: { id: string; path: string }) => Promise<RemoteAnswer<ContentDetail>>;
  openStudio: (request: { id: string }) => Promise<RemoteAnswer<ContentDetail>>;
  waitForExport: (request: { id: string }) => Promise<RemoteAnswer<ContentDetail>>;
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
  setTopicNote: (request: { id: string; text: string }) => Promise<RemoteAnswer<ContentDetail>>;
}

interface CreatorCockpitRemote {
  getState: (request: Record<string, never>) => Promise<RemoteAnswer<CockpitState>>;
  getRevision: (request: Record<string, never>) => Promise<RemoteAnswer<{ revision: number }>>;
  restoreState: (request: RestoreCockpitStateRequest) => Promise<RemoteAnswer<CockpitState>>;
  createIdea: (request: CreateIdeaRequest) => Promise<RemoteAnswer<CockpitState>>;
  updateIdea: (request: UpdateIdeaRequest) => Promise<RemoteAnswer<CockpitState>>;
  deleteIdea: (request: { id: string }) => Promise<RemoteAnswer<CockpitState>>;
  setContentMeta: (request: SetContentMetaRequest) => Promise<RemoteAnswer<CockpitState>>;
  deleteContentMeta: (request: { id: string }) => Promise<RemoteAnswer<CockpitState>>;
  createGoal: (request: CreateGoalRequest) => Promise<RemoteAnswer<CockpitState>>;
  updateGoal: (request: UpdateGoalRequest) => Promise<RemoteAnswer<CockpitState>>;
  deleteGoal: (request: { id: string }) => Promise<RemoteAnswer<CockpitState>>;
  createFollowerSnapshot: (request: CreateFollowerSnapshotRequest) => Promise<RemoteAnswer<CockpitState>>;
  deleteFollowerSnapshot: (request: { id: string }) => Promise<RemoteAnswer<CockpitState>>;
  createScheduleItem: (request: CreateScheduleItemRequest) => Promise<RemoteAnswer<CockpitState>>;
  updateScheduleItem: (request: UpdateScheduleItemRequest) => Promise<RemoteAnswer<CockpitState>>;
  deleteScheduleItem: (request: { id: string }) => Promise<RemoteAnswer<CockpitState>>;
  updateSettings: (request: UpdateCockpitSettingsRequest) => Promise<RemoteAnswer<CockpitState>>;
  confirmReview: (request: { contentId: string; id: string }) => Promise<RemoteAnswer<CockpitState>>;
  saveRule: (request: KnowledgeRequest) => Promise<RemoteAnswer<{ state: CockpitState; path: string; entryId: string }>>;
  saveTemplate: (request: KnowledgeRequest) => Promise<RemoteAnswer<{ state: CockpitState; path: string; entryId: string }>>;
  updateKnowledge: (request: UpdateKnowledgeRequest) => Promise<RemoteAnswer<CockpitState>>;
  promoteIdea: (request: PromoteIdeaRequest) => Promise<RemoteAnswer<PromotionResult>>;
}

function credentialsOf(ctx: ClientContext): CredentialsClient | undefined {
  const connection = ctx.get("connection") as { api?: { credentials?: CredentialsClient } } | undefined;
  return connection?.api?.credentials;
}

function hostOf(ctx: ClientContext): IApiClient["host"] | undefined {
  const connection = ctx.get("connection") as { api?: Pick<IApiClient, "host"> } | undefined;
  return connection?.api?.host;
}

function unwrap<T>(answer: RemoteAnswer<T>, fallback: string): T {
  if (!answer.ok || answer.value === undefined) {
    throw new Error(answer.error?.message ?? fallback);
  }
  return answer.value;
}

export const inject = ["slots", "locale", "remote", "workspaces", "layout", "connection"];

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "jacky-creator: dictionaries");
  ctx.effect(() => {
    remountPluginCss();
    const releaseBrandScope = mountJackyBrandScope();
    return () => {
      releaseBrandScope();
      releasePluginCss();
      releaseShellChrome();
    };
  }, "jacky-creator: chrome");
  const remoteOf = (): OilCreatorRemote | undefined =>
    ctx.get("remote.oilCreator") as OilCreatorRemote | undefined;
  const cockpitRemoteOf = (): CreatorCockpitRemote | undefined =>
    ctx.get("remote.creatorCockpit") as CreatorCockpitRemote | undefined;

  const cockpitFace = (): CreatorCockpitFace => ({
    cockpitReady: () => cockpitRemoteOf() !== undefined,
    getCockpitState: async () => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.getState({}), "cockpit state failed");
    },
    getCockpitRevision: async () => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.getRevision({}), "cockpit revision failed").revision;
    },
    restoreState: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.restoreState(request), "restore cockpit state failed");
    },
    createIdea: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.createIdea(request), "create idea failed");
    },
    updateIdea: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.updateIdea(request), "update idea failed");
    },
    deleteIdea: async (id) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.deleteIdea({ id }), "delete idea failed");
    },
    setContentMeta: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.setContentMeta(request), "content metadata failed");
    },
    deleteContentMeta: async (id) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.deleteContentMeta({ id }), "delete content metadata failed");
    },
    createGoal: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.createGoal(request), "create goal failed");
    },
    updateGoal: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.updateGoal(request), "update goal failed");
    },
    deleteGoal: async (id) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.deleteGoal({ id }), "delete goal failed");
    },
    createFollowerSnapshot: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.createFollowerSnapshot(request), "create follower snapshot failed");
    },
    deleteFollowerSnapshot: async (id) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.deleteFollowerSnapshot({ id }), "delete follower snapshot failed");
    },
    createScheduleItem: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.createScheduleItem(request), "create schedule item failed");
    },
    updateScheduleItem: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.updateScheduleItem(request), "update schedule item failed");
    },
    deleteScheduleItem: async (id) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.deleteScheduleItem({ id }), "delete schedule item failed");
    },
    updateSettings: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.updateSettings(request), "update cockpit settings failed");
    },
    confirmReview: async (contentId, id) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.confirmReview({ contentId, id }), "confirm review failed");
    },
    saveRule: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.saveRule(request), "save rule failed");
    },
    saveTemplate: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.saveTemplate(request), "save template failed");
    },
    updateKnowledge: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.updateKnowledge(request), "update knowledge failed");
    },
    promoteIdea: async (request) => {
      const remote = cockpitRemoteOf();
      if (remote === undefined) throw new Error("Jacky Creator operations service unavailable");
      return unwrap(await remote.promoteIdea(request), "promote idea failed");
    },
  });

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
    openFolder: (path) => openNativePath(hostOf(ctx), (next) => ctx.workspaces.openPath(next), path),
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
    setContentSkip: async (id, step, skipped) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const next = unwrap(await remote.setContentSkip({ id, step, skipped }), "skip failed");
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
    waitForExport: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const next = unwrap(await remote.waitForExport({ id }), "wait export failed");
      bumpLibrary();
      return next;
    },
    setPublish: async (id, platform, status, url, publishedAt) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const next = unwrap(
        await remote.setPublish({ id, platform, status, ...(url === undefined ? {} : { url }), ...(publishedAt === undefined ? {} : { publishedAt }) }),
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
    setTopicNote: async (id, text) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const next = unwrap(await remote.setTopicNote({ id, text }), "topic failed");
      bumpLibrary();
      return next;
    },
  });

  const contentFace = face();
  const operationsFace = cockpitFace();

  const conversationSlots = ctx.slots as unknown as {
    inject: (name: string, setup: () => () => void) => () => void;
    register: (
      options: Record<string, unknown>,
      component: typeof CockpitSessionBridge | typeof JackyConversationHero,
    ) => () => void;
  };
  ctx.effect(() => conversationSlots.inject(
    "conversation.hero.brand.mark",
    () => conversationSlots.register({
      name: "conversation.hero.brand.mark",
      id: "jacky-creator-paper-growth-hero",
      priority: -1,
    }, JackyConversationHero),
  ), "jacky-creator: conversation hero brand");
  ctx.effect(() => conversationSlots.inject("conversation.input.dock", () => conversationSlots.register({
    name: "conversation.input.dock",
    id: "creator-cockpit-session-bridge",
    order: 1000,
  }, CockpitSessionBridge)), "jacky-creator: session input bridge");

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
  }, "jacky-creator: content triggers");

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
          operations: contentT("tab.operations"),
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
      let occupantKey = "";
      const release = (): void => {
        disposeOccupant?.();
        disposeOccupant = undefined;
        occupantKey = "";
      };
      const sync = (): void => {
        const selectedId = getSelectedContentId();
        const nextKey = getSidebarTab() === "operations"
          ? "operations"
          : selectedId === null
            ? ""
            : `content:${selectedId}`;
        if (nextKey === occupantKey) return;
        release();
        if (nextKey === "") {
          return;
        }
        occupantKey = nextKey;
        if (nextKey === "operations") {
          disposeOccupant = ctx.slots.register({
            name: "shell.overlay",
            id: "creator-cockpit-operations",
            order: 20,
            locale: NS,
            inject: () => ({
              ...face(),
              ...operationsFace,
              t: ctx.locale.bind(NS),
              openContent: (id: string) => {
                setSelectedContentId(id);
                setSidebarTab("content");
              },
            }),
          }, OperationsWorkspace);
          return;
        }
        disposeOccupant = ctx.slots.register({
          name: "shell.overlay",
          id: "oil-creator-inspector",
          order: 20,
          locale: NS,
          inject: () => ({
            ...face(),
            cockpit: operationsFace,
            closeDetails: () => {
              setSelectedContentId(null);
            },
          }),
        }, ContentInspector);
      };
      const stopSelection = subscribeSelectedContentId(sync);
      const stopChrome = subscribeSidebarChrome(sync);
      sync();
      return () => {
        stopSelection();
        stopChrome();
        release();
      };
    });
    const stopSettings = ctx.slots.inject("settings.plugin.item", () =>
      registerCreatorSettingsCard(
        ctx.slots as unknown as CompatibleSettingsSlots,
        CreatorSettingsCard,
        {
          namespace: CREATOR_SETTINGS_NAMESPACE,
          legacyId: "jacky-creator",
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
  }, "jacky-creator: remote-view");
}
