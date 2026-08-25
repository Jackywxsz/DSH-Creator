import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

import { isSubtitledVideoName, pathExists } from "./artifacts.ts";
import {
  countsOf,
  coverPathOf,
  createContentFolder,
  matchesFilter,
  matchesQuery,
  readArticle,
  readPublishCopy,
  readSubtitleCues,
  readSubtitleText,
  readScript,
  readTopicNote,
  scanLibrary,
  writeScript,
  writeTopicNote,
} from "./catalog.ts";
import {
  expandHomePath,
  resolveSkillDir,
  resolveDataDir,
  type Config,
} from "./config.ts";
import { inspectCreatorSetup } from "./capabilities.ts";
import { creatorGuideText } from "./guide.ts";
import { applyOrganize, previewOrganize, remapOverlayItems } from "./organize.ts";
import { cacheIsFresh, loadCollectCache, nextCollectCacheScope, saveCollectCache } from "./collectCache.ts";
import {
  applyMatchesToOverlay,
  cacheCoversTargets,
  filterCollected,
  filterMatchItems,
  knownFromPublish,
  matchCollected,
  mergeCollected,
  unionCollected,
  type CollectResult,
  type CollectTarget,
} from "./collectPublish.ts";
import { collectScriptPath, runCollectPublish } from "./collectEgo.ts";
import { pickCoverLaunch, pickSubtitleWorkflow, resolveCoverSkill, type GenerateStep } from "./generate.ts";
import { startLibraryWatch } from "./libraryWatch.ts";
import {
  emptyProfile,
  loadOverlay,
  normalizeEnabledPlatforms,
  overlayPath,
  saveOverlay,
  withOverlayLock,
} from "./overlay.ts";
import { patchOverlayPublish } from "./publishStatus.ts";
import { missingSecretMessage } from "./secrets.ts";
import { describeCreatorSecrets, resolveCreatorSecret, secretEnv } from "./secretsHost.ts";
import {
  findFreePort,
  pickBurnLaunch,
  pickPreviewLaunch,
  resolveSubtitleSkill,
  spawnPython,
  waitHttp,
} from "./subtitle.ts";
import {
  jobPidMatches,
  jobPidStillOurs,
  pidAlive,
  pidCommand,
  terminateOwnedProcess,
  waitForPidExit,
} from "./processAlive.ts";
import {
  livePreviewRecord,
  loadPreviewRegistry,
  previewRegistryPathForDataDir,
  removePreviewRecord,
  savePreviewRegistry,
  upsertPreviewRecord,
} from "./previewServers.ts";
import { collectRegistryPathForDataDir } from "./collectSpaces.ts";
import { coverThumb } from "./thumbs.ts";
import { startArticleServer } from "./articleServe.ts";
import { playbackOf, startVideoServer } from "./videoServe.ts";
import type {
  BindStudioRequest,
  BurnJob,
  ContentDetail,
  CoverThumbResult,
  CreatorCapabilities,
  CreatorSetupRequest,
  CreatorSetupResult,
  CreatorSetupStatus,
  CreateContentRequest,
  CreateContentResult,
  CreatorGuideResult,
  IdRequest,
  OverlayItem,
  OverlayStore,
  SetContentStageRequest,
  SetContentSkipRequest,
  LibrarySettings,
  ListContentsRequest,
  ListContentsResult,
  OrganizePreview,
  OrganizeRequest,
  SetLibraryRootRequest,
  SetProfileRequest,
  SetPublishRequest,
  SetScriptRequest,
  SetScriptRulesRequest,
  SetTopicNoteRequest,
  SubtitlePreviewResult,
  SubtitleTextResult,
  SyncPublishRequest,
  SyncPublishResult,
  ArticleMediaResult,
  VideoPlaybackResult,
  WaitExportRequest,
} from "./types.ts";

export const OIL_CREATOR_SERVICE = "oilCreator";

export class OilCreatorService extends TypertRemoteService {
  // Gateway calls methods on a Cordis proxy; `#private` fields throw on that receiver.
  libraryRoot: string;
  readonly dataDir: string;
  // Raw config values; skill dirs are re-resolved on each use so a skill the
  // user installs after Harness started is discovered without a restart.
  readonly subtitleSkillDirConfig: string;
  readonly coverSkillDirConfig: string;
  cache: { libraryRoot: string; items: Awaited<ReturnType<typeof scanLibrary>> } | undefined;
  cachedScriptRules: string | undefined;
  cachedEnabledPlatforms: string[] | undefined;
  catalogRevision = 0;
  watchClose: (() => void) | undefined;
  watchedRoot: string | undefined;
  exportWaiters = new Map<string, AbortController>();
  previews = new Map<string, { url: string; port: number; pid: number }>();
  videos = new Map<string, { url: string; path: string; close: () => void }>();
  articles = new Map<string, { origin: string; root: string; close: () => void }>();

  constructor(ctx: Context, config: Config) {
    super(ctx, OIL_CREATOR_SERVICE);
    this.libraryRoot = resolveUserPath(config.libraryRoot);
    this.dataDir = resolveUserPath(resolveDataDir(config));
    this.subtitleSkillDirConfig = config.subtitleSkillDir;
    this.coverSkillDirConfig = config.coverSkillDir;
    void loadOverlay(this.dataDir).then((overlay) => { this.rememberOverlay(overlay); });
    ctx.effect(() => async () => {
      this.stopWatch();
      this.stopExportWaiters();
      await this.stopServers();
    }, "oil-creator: library watch");
  }

  subtitleSkillDir(): string {
    return resolveSkillDir(this.subtitleSkillDirConfig, "oil-subtitle", process.env.OIL_SUBTITLE_SKILL);
  }

  coverSkillDir(): string {
    return resolveSkillDir(this.coverSkillDirConfig, "oil-cover", process.env.OIL_COVER_SKILL);
  }

  async stopServers(): Promise<void> {
    for (const session of this.videos.values()) session.close();
    this.videos.clear();
    for (const session of this.articles.values()) session.close();
    this.articles.clear();
    const registryPath = previewRegistryPathForDataDir(this.dataDir);
    const recorded = loadPreviewRegistry(registryPath);
    const recordedByPid = new Map(recorded.map((record) => [record.pid, record]));
    const remaining = new Map<string, typeof recorded[number]>();
    const seen = new Set<number>();
    for (const preview of [...this.previews.values(), ...recorded]) {
      if (seen.has(preview.pid)) continue;
      seen.add(preview.pid);
      if (jobPidStillOurs(preview.pid, "preview_editor")) {
        try {
          process.kill(preview.pid, "SIGTERM");
          await waitForPidExit(preview.pid, ["preview_editor"]);
          if (jobPidStillOurs(preview.pid, "preview_editor")) {
            process.kill(preview.pid, "SIGKILL");
            await waitForPidExit(preview.pid, ["preview_editor"], 1_000);
          }
        } catch {
          // The process may have exited between ownership check and signal.
        }
      }
      // Keep a live record when ownership could not be established or the
      // process ignored both signals. A later Harness run can retry safely.
      if (pidAlive(preview.pid) && (pidCommand(preview.pid) === undefined || jobPidStillOurs(preview.pid, "preview_editor"))) {
        const record = recordedByPid.get(preview.pid);
        if (record !== undefined) remaining.set(record.id, record);
      }
    }
    this.previews.clear();
    savePreviewRegistry(registryPath, [...remaining.values()]);
  }

  invalidateCatalog(): void {
    this.cache = undefined;
    this.catalogRevision += 1;
  }

  stopWatch(): void {
    this.watchClose?.();
    this.watchClose = undefined;
    this.watchedRoot = undefined;
  }

  stopExportWaiters(): void {
    for (const waiter of this.exportWaiters.values()) waiter.abort();
    this.exportWaiters.clear();
  }

  subtitleSkill(): Promise<{ root: string; python: string }> {
    return resolveSubtitleSkill(this.subtitleSkillDir());
  }

  coverSkill(): Promise<{ root: string; jackyRoot: string; python: string; script: string }> {
    return resolveCoverSkill(this.coverSkillDir());
  }

  ensureWatch(libraryRoot: string): void {
    if (this.watchedRoot === libraryRoot && this.watchClose !== undefined) return;
    this.stopWatch();
    this.watchedRoot = libraryRoot;
    try {
      mkdirSync(this.dataDir, { recursive: true });
    } catch {
      // Watch can still attach to an existing library root.
    }
    this.watchClose = startLibraryWatch({
      libraryRoot,
      overlayPath: overlayPath(this.dataDir),
      onChange: () => {
        this.invalidateCatalog();
      },
    }).close;
  }

  async scanned() {
    return withOverlayLock(this.dataDir, async () => {
      let overlay = await loadOverlay(this.dataDir);
      const libraryRoot = overlay.libraryRoot ?? this.libraryRoot;
      this.rememberOverlay(overlay);
      this.ensureWatch(libraryRoot);
      const reconciled = await reconcileOverlayBurns(overlay);
      if (reconciled !== undefined) {
        overlay = reconciled;
        await saveOverlay(this.dataDir, overlay);
        this.invalidateCatalog();
      }
      if (this.cache?.libraryRoot === libraryRoot) {
        return { overlay, libraryRoot, items: this.cache.items };
      }
      const items = await scanLibrary(libraryRoot, overlay);
      this.cache = { libraryRoot, items };
      return { overlay, libraryRoot, items };
    });
  }

  async getRevision(
    _request: Record<string, never>,
    signal: AbortSignal,
  ): Promise<{ revision: number }> {
    signal.throwIfAborted();
    if (this.watchClose === undefined) await this.scanned();
    return { revision: this.catalogRevision };
  }

  async listContents(
    request: ListContentsRequest,
    signal: AbortSignal,
  ): Promise<ListContentsResult> {
    signal.throwIfAborted();
    const { overlay, libraryRoot, items: scanned } = await this.scanned();
    const items = scanned.filter((item) =>
      matchesFilter(item, request.filter) && matchesQuery(item, request.query)
    );
    return {
      settings: await this.settingsOf(libraryRoot, overlay),
      items,
      counts: countsOf(scanned),
      revision: this.catalogRevision,
    };
  }

  async getContent(request: IdRequest, signal: AbortSignal): Promise<ContentDetail> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item === undefined) {
      throw new Error(`content not found: ${request.id}`);
    }
    return {
      ...item,
      publishCopy: await readPublishCopy(item.folderPath),
      topicNote: await readTopicNote(item.folderPath),
      script: await readScript(item.folderPath),
      article: await readArticle(item.articlePath),
      secrets: await describeCreatorSecrets(this.ctx),
    };
  }

  async getCoverThumb(request: IdRequest, signal: AbortSignal): Promise<CoverThumbResult> {
    signal.throwIfAborted();
    const folderId = request.id.split("::")[0] ?? request.id;
    const ratio = request.id.split("::")[1];
    const item = await this.find(folderId);
    const path = ratio === "3x4" || ratio === "4x3" || ratio === "16x9"
      ? item?.covers[ratio]
      : item === undefined ? undefined : coverPathOf(item);
    return coverThumb(this.dataDir, request.id, path);
  }

  async getVideoPlayback(request: IdRequest, signal: AbortSignal): Promise<VideoPlaybackResult> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    const picked = item === undefined ? undefined : playbackOf(item);
    if (picked === undefined) return { found: false, url: "", kind: "raw" };
    const existing = this.videos.get(request.id);
    if (existing !== undefined && existing.path === picked.path) {
      return { found: true, url: existing.url, kind: picked.kind };
    }
    existing?.close();
    const session = await startVideoServer(picked.path);
    this.videos.set(request.id, { url: session.url, path: picked.path, close: session.close });
    return { found: true, url: session.url, kind: picked.kind };
  }

  async getArticleMedia(request: IdRequest, signal: AbortSignal): Promise<ArticleMediaResult> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item?.articlePath === undefined) return { found: false, origin: "" };
    const root = dirname(item.articlePath);
    const existing = this.articles.get(request.id);
    if (existing !== undefined && existing.root === root) {
      return { found: true, origin: existing.origin };
    }
    existing?.close();
    const session = await startArticleServer(root);
    this.articles.set(request.id, { origin: session.origin, root, close: session.close });
    return { found: true, origin: session.origin };
  }

  async getSubtitleText(request: IdRequest, signal: AbortSignal): Promise<SubtitleTextResult> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item === undefined) return { text: "", cues: [] };
    const cues = await readSubtitleCues(item);
    const text = cues.length > 0 ? cues.map((cue) => cue.text).join("\n") : await readSubtitleText(item);
    return { text, cues };
  }

  async getSettings(_request: Record<string, never>, signal: AbortSignal): Promise<LibrarySettings> {
    signal.throwIfAborted();
    const overlay = await loadOverlay(this.dataDir);
    this.rememberOverlay(overlay);
    return this.settingsOf(overlay.libraryRoot ?? this.libraryRoot, overlay);
  }

  async setLibraryRoot(
    request: SetLibraryRootRequest,
    signal: AbortSignal,
  ): Promise<LibrarySettings> {
    signal.throwIfAborted();
    const libraryRoot = resolveUserPath(request.path);
    const info = await stat(libraryRoot).catch(() => undefined);
    if (info === undefined || !info.isDirectory()) {
      throw new Error(`library root is not a directory: ${libraryRoot}`);
    }
    return withOverlayLock(this.dataDir, async () => {
      const overlay = await loadOverlay(this.dataDir);
      overlay.libraryRoot = libraryRoot;
      await saveOverlay(this.dataDir, overlay);
      this.libraryRoot = libraryRoot;
      this.stopWatch();
      this.invalidateCatalog();
      return this.settingsOf(libraryRoot, overlay);
    });
  }

  async setProfile(request: SetProfileRequest, signal: AbortSignal): Promise<LibrarySettings> {
    signal.throwIfAborted();
    return withOverlayLock(this.dataDir, async () => {
      const overlay = await loadOverlay(this.dataDir);
      overlay.profile = {
        enabledPlatforms: normalizeEnabledPlatforms(request.profile.enabledPlatforms),
      };
      await saveOverlay(this.dataDir, overlay);
      this.rememberOverlay(overlay);
      this.invalidateCatalog();
      return this.settingsOf(overlay.libraryRoot ?? this.libraryRoot, overlay);
    });
  }

  async setScriptRules(request: SetScriptRulesRequest, signal: AbortSignal): Promise<LibrarySettings> {
    signal.throwIfAborted();
    return withOverlayLock(this.dataDir, async () => {
      const overlay = await loadOverlay(this.dataDir);
      const text = request.text.trim();
      if (text === "") delete overlay.scriptRules;
      else overlay.scriptRules = text;
      await saveOverlay(this.dataDir, overlay);
      this.rememberOverlay(overlay);
      return this.settingsOf(overlay.libraryRoot ?? this.libraryRoot, overlay);
    });
  }

  async getCreatorGuide(signal: AbortSignal): Promise<CreatorGuideResult> {
    signal.throwIfAborted();
    const status = await this.getCreatorSetupStatus(signal);
    return { guide: creatorGuideText(status), status };
  }

  async getCapabilities(
    _request: Record<string, never>,
    signal: AbortSignal,
  ): Promise<{ capabilities: CreatorCapabilities }> {
    signal.throwIfAborted();
    const status = await this.getCreatorSetupStatus(signal);
    return { capabilities: status.capabilities };
  }

  async getCreatorSetupStatus(signal: AbortSignal): Promise<CreatorSetupStatus> {
    signal.throwIfAborted();
    const settings = await this.getSettings({}, signal);
    return inspectCreatorSetup({
      libraryRoot: settings.libraryRoot,
      dataDir: this.dataDir,
      subtitleSkillDir: this.subtitleSkillDir(),
      coverSkillDir: this.coverSkillDir(),
      settings,
    });
  }

  async configureCreator(
    request: CreatorSetupRequest,
    signal: AbortSignal,
  ): Promise<CreatorSetupResult> {
    signal.throwIfAborted();
    const proposal: CreatorSetupResult["proposal"] = {};
    if (request.libraryRoot !== undefined) proposal.libraryRoot = resolveUserPath(request.libraryRoot);
    if (request.enabledPlatforms !== undefined) {
      proposal.enabledPlatforms = normalizeEnabledPlatforms(request.enabledPlatforms);
    }
    if (!request.apply || Object.keys(proposal).length === 0) {
      return { applied: false, proposal, status: await this.getCreatorSetupStatus(signal) };
    }
    if (proposal.libraryRoot !== undefined) {
      const info = await stat(proposal.libraryRoot).catch(() => undefined);
      if (info === undefined || !info.isDirectory()) {
        throw new Error(`library root is not a directory: ${proposal.libraryRoot}`);
      }
    }
    await withOverlayLock(this.dataDir, async () => {
      const overlay = await loadOverlay(this.dataDir);
      if (proposal.libraryRoot !== undefined) overlay.libraryRoot = proposal.libraryRoot;
      const profile = overlay.profile ?? emptyProfile();
      if (proposal.enabledPlatforms !== undefined) {
        profile.enabledPlatforms = [...proposal.enabledPlatforms];
      }
      overlay.profile = profile;
      await saveOverlay(this.dataDir, overlay);
      this.rememberOverlay(overlay);
      if (proposal.libraryRoot !== undefined) {
        this.libraryRoot = proposal.libraryRoot;
        this.stopWatch();
      }
      this.invalidateCatalog();
    });
    return { applied: true, proposal, status: await this.getCreatorSetupStatus(signal) };
  }

  async setTopicNote(request: SetTopicNoteRequest, signal: AbortSignal): Promise<ContentDetail> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item === undefined) throw new Error(`content not found: ${request.id}`);
    await writeTopicNote(item.folderPath, request.text);
    return this.getContent({ id: request.id }, signal);
  }

  async setScript(request: SetScriptRequest, signal: AbortSignal): Promise<ContentDetail> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item === undefined) throw new Error(`content not found: ${request.id}`);
    await writeScript(item.folderPath, request.text);
    return this.getContent({ id: request.id }, signal);
  }

  async organizeLibrary(request: OrganizeRequest, signal: AbortSignal): Promise<OrganizePreview> {
    signal.throwIfAborted();
    const overlay = await loadOverlay(this.dataDir);
    const libraryRoot = overlay.libraryRoot ?? this.libraryRoot;
    if (!request.apply) {
      return previewOrganize(libraryRoot, overlay, request.ids);
    }
    const result = await applyOrganize(libraryRoot, overlay, request.ids);
    await withOverlayLock(this.dataDir, async () => {
      const latest = await loadOverlay(this.dataDir);
      await saveOverlay(this.dataDir, remapOverlayItems(latest, result.preview.moves));
    });
    this.invalidateCatalog();
    return result.preview;
  }

  async refreshCatalog(
    _request: Record<string, never>,
    signal: AbortSignal,
  ): Promise<ListContentsResult> {
    this.invalidateCatalog();
    return this.listContents({ query: "", filter: "all" }, signal);
  }

  async setContentStage(
    request: SetContentStageRequest,
    signal: AbortSignal,
  ): Promise<ContentDetail> {
    signal.throwIfAborted();
    await withOverlayLock(this.dataDir, async () => {
      const overlay = await loadOverlay(this.dataDir);
      const current = overlay.items[request.id] ?? {};
      const next = { ...current };
      if (request.readyToRecord) next.readyToRecord = true;
      else delete next.readyToRecord;
      overlay.items[request.id] = next;
      await saveOverlay(this.dataDir, overlay);
      this.invalidateCatalog();
    });
    return this.getContent({ id: request.id }, signal);
  }

  async setContentSkip(
    request: SetContentSkipRequest,
    signal: AbortSignal,
  ): Promise<ContentDetail> {
    signal.throwIfAborted();
    if (await this.find(request.id) === undefined) {
      throw new Error(`content not found: ${request.id}`);
    }
    return this.patchItem(request.id, (item) => {
      const skipped = new Set(item.skippedSteps ?? []);
      if (request.skipped) skipped.add(request.step);
      else skipped.delete(request.step);
      if (skipped.size === 0) delete item.skippedSteps;
      else item.skippedSteps = [...skipped];
    }, signal);
  }

  async createContent(
    request: CreateContentRequest,
    signal: AbortSignal,
  ): Promise<CreateContentResult> {
    signal.throwIfAborted();
    const overlay = await loadOverlay(this.dataDir);
    const libraryRoot = overlay.libraryRoot ?? this.libraryRoot;
    const created = await createContentFolder(libraryRoot, request.title);
    this.invalidateCatalog();
    return created;
  }

  async bindStudio(request: BindStudioRequest, signal: AbortSignal): Promise<ContentDetail> {
    signal.throwIfAborted();
    const studioPath = await resolveStudioPath(request.path);
    return this.patchItem(request.id, (item) => {
      item.studioPath = studioPath;
    }, signal);
  }

  async setPublish(request: SetPublishRequest, signal: AbortSignal): Promise<ContentDetail> {
    signal.throwIfAborted();
    const overlay = await loadOverlay(this.dataDir);
    const enabledPlatforms = overlay.profile?.enabledPlatforms ?? emptyProfile().enabledPlatforms;
    if (!enabledPlatforms.includes(request.platform)) {
      throw new Error(`publish platform is disabled: ${request.platform}`);
    }
    return this.patchItem(request.id, (item) => {
      item.publish = patchOverlayPublish(item.publish, request.platform, request.status, request.url, request.publishedAt ?? Date.now());
    }, signal);
  }

  async syncPublish(request: SyncPublishRequest, signal: AbortSignal): Promise<SyncPublishResult> {
    signal.throwIfAborted();
    const configured = await loadOverlay(this.dataDir);
    const enabledPlatforms = configured.profile?.enabledPlatforms ?? emptyProfile().enabledPlatforms;
    if (request.platform !== undefined && !enabledPlatforms.includes(request.platform)) {
      throw new Error(`publish platform is disabled: ${request.platform}`);
    }
    const platforms = request.platform === undefined ? enabledPlatforms : [request.platform];
    const scopedId = request.id === undefined || request.id === "" ? undefined : request.id;
    const cached = await loadCollectCache(this.dataDir);
    const { items } = await this.scanned();
    const scoped = filterMatchItems(items, scopedId);
    if (scopedId !== undefined && scoped.length === 0) {
      throw new Error(`content not found: ${scopedId}`);
    }
    if (platforms.length === 0) return { matched: 0, platforms: [] };
    const targets: CollectTarget[] | undefined = scopedId === undefined
      ? undefined
      : scoped.map((item) => {
        const known = knownFromPublish(item.publish);
        const remoteIds = Object.values(known)
          .map((row) => row.remoteId)
          .filter((value): value is string => value !== undefined && value !== "");
        const urls = Object.values(known)
          .map((row) => row.url)
          .filter((value): value is string => value !== undefined && value !== "");
        const target: CollectTarget = { title: item.title };
        if (remoteIds.length > 0) target.remoteIds = remoteIds;
        if (urls.length > 0) target.urls = urls;
        return target;
      });
    let collected: CollectResult;
    let fromCache = false;
    const cachedSlice = cached === undefined ? undefined : filterCollected(cached.result, platforms);
    const cacheCoversPlatforms = cachedSlice !== undefined
      && platforms.every((platform) => cachedSlice.collected.some((page) => page.platform === platform));
    if (
      request.force !== true
      && cached !== undefined
      && cacheIsFresh(cached.fetchedAt)
      && cacheCoversPlatforms
      && cacheCoversTargets(cachedSlice ?? cached.result, targets, cached.scope)
    ) {
      collected = cachedSlice ?? cached.result;
      fromCache = true;
    } else {
      try {
        collected = await runCollectPublish(collectScriptPath(), signal, {
          ...(platforms === undefined ? {} : { platforms }),
          ...(targets === undefined ? {} : { targets }),
          registryPath: collectRegistryPathForDataDir(this.dataDir),
        });
        const merged = scopedId === undefined
          ? mergeCollected(cached?.result, collected, platforms)
          : unionCollected(cached?.result, collected);
        await saveCollectCache(this.dataDir, merged, {
          scope: nextCollectCacheScope(cached?.scope, scopedId !== undefined),
        });
        collected = filterCollected(merged, platforms);
      } catch (cause) {
        if (signal.aborted || (cause instanceof Error && cause.name === "AbortError")) throw cause;
        if (
          cached === undefined
          || !cacheIsFresh(cached.fetchedAt)
          || !cacheCoversPlatforms
          || !cacheCoversTargets(cachedSlice ?? cached.result, targets, cached.scope)
        ) {
          throw cause;
        }
        collected = cachedSlice ?? cached.result;
        fromCache = true;
      }
    }
    const matches = matchCollected(
      scoped.map((item) => ({
        id: item.id,
        title: item.title,
        known: knownFromPublish(item.publish),
      })),
      collected.collected,
    );
    await withOverlayLock(this.dataDir, async () => {
      const latest = await loadOverlay(this.dataDir);
      latest.items = applyMatchesToOverlay(latest.items, matches);
      await saveOverlay(this.dataDir, latest);
      this.invalidateCatalog();
    });
    const result: SyncPublishResult = {
      matched: matches.length,
      platforms: collected.collected.map((page) => {
        const row: SyncPublishResult["platforms"][number] = {
          platform: page.platform,
          count: page.items.length,
        };
        if (page.loginRequired === true) row.loginRequired = true;
        if (page.error !== undefined && page.error !== "") row.error = page.error;
        return row;
      }),
    };
    if (fromCache) result.cached = true;
    return result;
  }

  async openSubtitlePreview(
    request: IdRequest,
    signal: AbortSignal,
  ): Promise<SubtitlePreviewResult> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item === undefined) throw new Error(`content not found: ${request.id}`);
    const registryPath = previewRegistryPathForDataDir(this.dataDir);
    const recorded = livePreviewRecord(loadPreviewRegistry(registryPath), request.id);
    const existing = this.previews.get(request.id);
    const reusable = existing !== undefined && jobPidMatches(existing.pid, ["preview_editor"])
      ? existing
      : recorded;
    if (reusable !== undefined) {
      this.previews.set(request.id, reusable);
      await openExternalPath(reusable.url);
      return { url: reusable.url, port: reusable.port };
    }
    const skill = await this.subtitleSkill();
    const launch = await pickPreviewLaunch(item);
    const port = await findFreePort();
    const child = spawnPython(
      skill.python,
      join(skill.root, "scripts/preview_editor.py"),
      launch.args,
      { PREVIEW_EDITOR_PORT: String(port) },
    );
    const pid = child.pid;
    if (pid === undefined) throw new Error("preview failed to start");
    child.unref();
    const url = `http://127.0.0.1:${port}`;
    const record = { url, port, pid, id: request.id, startedAt: Date.now() };
    this.previews.set(request.id, record);
    upsertPreviewRecord(registryPath, record);
    try {
      await waitHttp(url, 8000, signal);
    } catch (cause) {
      try {
        await terminateOwnedProcess(pid, ["preview_editor"]);
      } catch {
        // Cleanup must still happen if the termination probe itself fails.
      }
      try {
        this.previews.delete(request.id);
      } finally {
        removePreviewRecord(registryPath, request.id);
      }
      throw cause;
    }
    await openExternalPath(url);
    return { url, port };
  }

  async startSubtitleBurn(request: IdRequest, signal: AbortSignal): Promise<ContentDetail> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item === undefined) throw new Error(`content not found: ${request.id}`);
    if (item.burn.status === "running" && jobPidMatches(item.burn.pid, ["burn_subtitles.py"])) {
      return this.getContent({ id: request.id }, signal);
    }
    const skill = await this.subtitleSkill();
    const launch = await pickBurnLaunch(item);
    const child = spawnPython(
      skill.python,
      join(skill.root, "scripts/burn_subtitles.py"),
      launch.args,
    );
    const pid = child.pid;
    if (pid === undefined) throw new Error("burn failed to start");
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = `${stderr}${String(chunk)}`.slice(-4000);
    });
    const startedAt = Date.now();
    child.once("exit", (code) => {
      const burn: BurnJob = code === 0
        ? { status: "done", startedAt, output: launch.output }
        : {
          status: "error",
          startedAt,
          output: launch.output,
          error: stderr.trim() === "" ? `burn failed: ${code}` : stderr.trim(),
        };
      void this.patchItem(request.id, (next) => {
        next.burn = burn;
      }, new AbortController().signal).catch(() => undefined);
    });
    child.unref();
    return this.patchItem(request.id, (next) => {
      next.burn = { status: "running", startedAt, output: launch.output, pid };
    }, signal);
  }

  async startSubtitleGenerate(request: IdRequest, signal: AbortSignal): Promise<ContentDetail> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item === undefined) throw new Error(`content not found: ${request.id}`);
    if (item.subtitleJob.status === "running" && jobPidMatches(item.subtitleJob.pid, JOB_COMMAND.subtitleJob)) {
      return this.getContent({ id: request.id }, signal);
    }
    if (item.burn.status === "running" && jobPidMatches(item.burn.pid, JOB_COMMAND.burn)) {
      return this.getContent({ id: request.id }, signal);
    }
    const subtitleKey = await resolveCreatorSecret(this.ctx, "subtitle");
    if (subtitleKey === undefined) throw new Error(missingSecretMessage("subtitle"));
    const skill = await this.subtitleSkill();
    const workflow = await pickSubtitleWorkflow(item, skill.root);
    const env: Record<string, string> = { ...secretEnv("subtitle", subtitleKey) };
    return this.startChainedJob(request.id, "subtitleJob", {
      python: skill.python,
      steps: workflow.steps,
      env,
    }, signal);
  }

  async startCoverGenerate(request: IdRequest & { title?: string }, signal: AbortSignal): Promise<ContentDetail> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item === undefined) throw new Error(`content not found: ${request.id}`);
    if (item.coverJob.status === "running" && jobPidMatches(item.coverJob.pid, ["generate_jacky_cover.py", "generate_oil_cover.py"])) {
      return this.getContent({ id: request.id }, signal);
    }
    const key = await resolveCreatorSecret(this.ctx, "cover");
    if (key === undefined) throw new Error(missingSecretMessage("cover"));
    const skill = await this.coverSkill();
    const launch = await pickCoverLaunch(item, request.title);
    return this.startTrackedJob(request.id, "coverJob", {
      python: skill.python,
      script: skill.script,
      args: launch.args,
      output: launch.output,
      env: {
        ...secretEnv("cover", key),
        OIL_COVER_SKILL_DIR: skill.root,
        JACKY_COVER_SKILL_DIR: skill.jackyRoot,
      },
    }, signal);
  }

  async startChainedJob(
    id: string,
    field: "burn" | "subtitleJob" | "coverJob",
    launch: {
      python: string;
      steps: readonly GenerateStep[];
      env?: Record<string, string>;
    },
    signal: AbortSignal,
  ): Promise<ContentDetail> {
    const first = launch.steps[0];
    if (first === undefined) throw new Error(`${field} has no steps`);
    const finalOutput = launch.steps[launch.steps.length - 1]?.output ?? first.output;
    const startedAt = Date.now();
    const runStep = (index: number): number => {
      const step = launch.steps[index];
      if (step === undefined) throw new Error(`${field} step missing`);
      const child = spawnPython(launch.python, step.script, step.args, envForGenerateStep(step.env, launch.env));
      const pid = child.pid;
      if (pid === undefined) throw new Error(`${field} failed to start`);
      let stderr = "";
      child.stderr?.on("data", (chunk: Buffer | string) => {
        stderr = `${stderr}${String(chunk)}`.slice(-4000);
      });
      child.once("exit", (code) => {
        if (code !== 0) {
          const job: BurnJob = {
            status: "error",
            startedAt,
            output: step.output,
            error: stderr.trim() === "" ? `${field} failed: ${code}` : stderr.trim(),
          };
          void this.patchItem(id, (next) => {
            next[field] = job;
          }, new AbortController().signal).catch(() => undefined);
          return;
        }
        const nextStep = launch.steps[index + 1];
        if (nextStep !== undefined) {
          try {
            const nextPid = runStep(index + 1);
            void this.patchItem(id, (next) => {
              next[field] = { status: "running", startedAt, output: finalOutput, pid: nextPid };
            }, new AbortController().signal).catch(() => undefined);
          } catch (cause) {
            const message = cause instanceof Error ? cause.message : `${field} failed`;
            void this.patchItem(id, (next) => {
              next[field] = { status: "error", startedAt, output: step.output, error: message };
            }, new AbortController().signal).catch(() => undefined);
          }
          return;
        }
        void this.patchItem(id, (next) => {
          next[field] = { status: "done", startedAt, output: finalOutput };
        }, new AbortController().signal).then(() => {
          if (field !== "subtitleJob") return;
          return this.openSubtitlePreview({ id }, new AbortController().signal);
        }, () => undefined).catch(() => undefined);
      });
      child.unref();
      return pid;
    };
    const pid = runStep(0);
    return this.patchItem(id, (next) => {
      next[field] = { status: "running", startedAt, output: finalOutput, pid };
    }, signal);
  }

  async startTrackedJob(
    id: string,
    field: "burn" | "subtitleJob" | "coverJob",
    launch: {
      python: string;
      script: string;
      args: readonly string[];
      output: string;
      env?: Record<string, string>;
    },
    signal: AbortSignal,
  ): Promise<ContentDetail> {
    const child = spawnPython(launch.python, launch.script, launch.args, launch.env);
    const pid = child.pid;
    if (pid === undefined) throw new Error(`${field} failed to start`);
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = `${stderr}${String(chunk)}`.slice(-4000);
    });
    const startedAt = Date.now();
    child.once("exit", (code) => {
      const job: BurnJob = code === 0
        ? { status: "done", startedAt, output: launch.output }
        : {
          status: "error",
          startedAt,
          output: launch.output,
          error: stderr.trim() === "" ? `${field} failed: ${code}` : stderr.trim(),
        };
      void this.patchItem(id, (next) => {
        next[field] = job;
      }, new AbortController().signal).catch(() => undefined);
    });
    child.unref();
    return this.patchItem(id, (next) => {
      next[field] = { status: "running", startedAt, output: launch.output, pid };
    }, signal);
  }

  async openStudio(request: IdRequest, signal: AbortSignal): Promise<ContentDetail> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item === undefined) throw new Error(`content not found: ${request.id}`);
    if (item.studioPath === undefined) throw new Error("no Screen Studio project bound");
    if (process.platform !== "darwin") throw new Error("Screen Studio is only supported on macOS");
    await openExternalPath(item.studioPath);
    return this.getContent({ id: request.id }, signal);
  }

  async waitForExport(request: WaitExportRequest, signal: AbortSignal): Promise<ContentDetail> {
    signal.throwIfAborted();
    const item = await this.find(request.id);
    if (item === undefined) throw new Error(`content not found: ${request.id}`);
    if (item.videoRaw !== undefined || item.videoSubtitled !== undefined) {
      return this.getContent({ id: request.id }, signal);
    }
    const started = await this.patchItem(request.id, (next) => {
      next.waitingForExport = true;
      delete next.exportTimedOut;
    }, signal);
    this.exportWaiters.get(request.id)?.abort();
    const waiter = new AbortController();
    this.exportWaiters.set(request.id, waiter);
    const timeoutMs = request.timeoutMs ?? 7_200_000;
    void waitForStableVideo(item.folderPath, timeoutMs, waiter.signal).then((found) => {
      if (waiter.signal.aborted) return;
      if (this.exportWaiters.get(request.id) === waiter) {
        this.exportWaiters.delete(request.id);
      }
      return this.patchItem(request.id, (next) => {
        if (found) {
          delete next.waitingForExport;
          delete next.exportTimedOut;
          return;
        }
        next.waitingForExport = true;
        next.exportTimedOut = true;
      }, new AbortController().signal);
    }, () => {
      if (this.exportWaiters.get(request.id) === waiter) {
        this.exportWaiters.delete(request.id);
      }
    });
    return started;
  }

  async find(id: string) {
    const { items } = await this.scanned();
    return items.find((item) => item.id === id);
  }

  rememberOverlay(overlay: OverlayStore): void {
    this.cachedScriptRules = overlay.scriptRules;
    this.cachedEnabledPlatforms = overlay.profile?.enabledPlatforms ?? emptyProfile().enabledPlatforms;
  }

  async settingsOf(
    libraryRoot: string,
    overlay: { profile?: LibrarySettings["profile"]; scriptRules?: string },
  ): Promise<LibrarySettings> {
    return {
      libraryRoot,
      profile: overlay.profile ?? emptyProfile(),
      secrets: await describeCreatorSecrets(this.ctx),
      ...(overlay.scriptRules === undefined ? {} : { scriptRules: overlay.scriptRules }),
    };
  }

  async patchItem(
    id: string,
    mutate: (item: OverlayItem) => void,
    signal: AbortSignal,
  ): Promise<ContentDetail> {
    await withOverlayLock(this.dataDir, async () => {
      const overlay = await loadOverlay(this.dataDir);
      const current = overlay.items[id] ?? {};
      const next = { ...current };
      mutate(next);
      overlay.items[id] = next;
      await saveOverlay(this.dataDir, overlay);
      this.invalidateCatalog();
    });
    return this.getContent({ id }, signal);
  }
}

function resolveUserPath(path: string): string {
  const expanded = expandHomePath(path);
  if (!isAbsolute(expanded)) throw new Error(`path must be absolute: ${path}`);
  return expanded;
}

function envForGenerateStep(
  kind: GenerateStep["env"],
  env: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const key = kind === "subtitle"
    ? "DASHSCOPE_API_KEY"
    : kind === "cover"
      ? "ZENMUX_API_KEY"
      : undefined;
  if (key === undefined || env === undefined || env[key] === undefined) return undefined;
  return { [key]: env[key] };
}

async function resolveStudioPath(path: string): Promise<string> {
  const info = await stat(path).catch(() => undefined);
  if (info === undefined) throw new Error("Screen Studio project missing");
  if (path.endsWith(".screenstudio")) return path;
  const project = join(path, "project.json");
  if (await pathExists(project)) return path;
  if (!info.isDirectory()) throw new Error("not a Screen Studio project");

  const candidates: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (!entry.name.endsWith(".screenstudio")) continue;
    const candidate = join(path, entry.name);
    const candidateInfo = await stat(candidate).catch(() => undefined);
    if (candidateInfo?.isDirectory()) candidates.push(candidate);
  }
  if (candidates.length === 1) return candidates[0]!;
  if (candidates.length > 1) {
    throw new Error("multiple Screen Studio projects found; select one project");
  }
  throw new Error("not a Screen Studio project");
}

const JOB_FIELDS = ["burn", "subtitleJob", "coverJob"] as const;
const JOB_COMMAND = {
  burn: ["burn_subtitles.py"],
  subtitleJob: ["bailian_transcribe.py", "review_subtitles.py", "prepare_subtitles.py"],
  coverJob: ["generate_jacky_cover.py", "generate_oil_cover.py"],
} as const;

function jobStarted(job: BurnJob): { startedAt?: number } {
  return job.startedAt === undefined ? {} : { startedAt: job.startedAt };
}

async function settleFinishedJob(job: BurnJob, field: (typeof JOB_FIELDS)[number]): Promise<BurnJob> {
  const output = job.output;
  const started = jobStarted(job);
  if (output !== undefined && await pathExists(output)) {
    return { status: "done", ...started, output };
  }
  return {
    status: "error",
    ...started,
    ...(output === undefined ? {} : { output }),
    error: `${field} process exited`,
  };
}

function recoverSubtitleJob(item: OverlayItem, job: BurnJob): BurnJob | undefined {
  if (job.status !== "error" || job.error !== "subtitleJob process exited") return undefined;
  const burn = item.burn;
  if (burn?.status === "running" && burn.pid !== undefined && jobPidMatches(burn.pid, JOB_COMMAND.burn)) {
    return {
      status: "running",
      ...jobStarted(job),
      ...jobStarted(burn),
      ...(burn.output === undefined ? {} : { output: burn.output }),
      pid: burn.pid,
    };
  }
  if (burn?.status === "done") {
    const output = burn.output ?? job.output;
    return {
      status: "done",
      ...jobStarted(job),
      ...jobStarted(burn),
      ...(output === undefined ? {} : { output }),
    };
  }
  return undefined;
}

async function reconcileOverlayBurns(overlay: OverlayStore): Promise<OverlayStore | undefined> {
  let dirty = false;
  const items: OverlayStore["items"] = { ...overlay.items };
  for (const [id, item] of Object.entries(overlay.items)) {
    let nextItem = items[id] ?? item;
    for (const field of JOB_FIELDS) {
      const job = nextItem[field];
      if (job === undefined) continue;
      if (field === "subtitleJob") {
        const recovered = recoverSubtitleJob(nextItem, job);
        if (recovered !== undefined) {
          nextItem = { ...nextItem, subtitleJob: recovered };
          dirty = true;
          continue;
        }
      }
      if (job.status !== "running") continue;
      if (jobPidMatches(job.pid, JOB_COMMAND[field])) continue;
      nextItem = { ...nextItem, [field]: await settleFinishedJob(job, field) };
      dirty = true;
    }
    items[id] = nextItem;
  }
  return dirty ? { ...overlay, items } : undefined;
}

function openExternalPath(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = process.platform === "darwin"
      ? { file: "open", args: [path] }
      : process.platform === "win32"
        ? { file: "explorer.exe", args: [path] }
        : { file: "xdg-open", args: [path] };
    const child = spawn(command.file, command.args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`${command.file} failed: ${code}`));
    });
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitForStableVideo(
  folderPath: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<boolean> {
  const started = Date.now();
  let last = "";
  let same = 0;
  while (Date.now() - started < timeoutMs) {
    signal.throwIfAborted();
    const names = await readdir(folderPath).catch(() => []);
    let newest: { path: string; size: number; mtime: number } | undefined;
    for (const name of names) {
      if (!name.endsWith(".mp4") && !name.endsWith(".mov")) continue;
      if (isSubtitledVideoName(name)) continue;
      const path = join(folderPath, name);
      const info = await stat(path).catch(() => undefined);
      if (info === undefined || !info.isFile() || info.size === 0) continue;
      if (newest === undefined || info.mtimeMs > newest.mtime) {
        newest = { path, size: info.size, mtime: info.mtimeMs };
      }
    }
    const key = newest === undefined ? "" : `${newest.path}:${newest.size}`;
    if (key !== "" && key === last) same += 1;
    else {
      last = key;
      same = 0;
    }
    if (same >= 4) return true;
    await sleep(2000, signal);
  }
  return false;
}
