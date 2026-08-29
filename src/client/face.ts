import type {
  ContentDetail,
  ContentFilter,
  ContentOptionalStep,
  CoverThumbResult,
  CreatorCapabilities,
  CreatorInstallResult,
  CreatorInstallTarget,
  CreatorPlatformLoginResult,
  CreatorProfile,
  LibrarySettings,
  ListContentsResult,
  PublishMark,
  PublishPlatform,
  SubtitlePreviewResult,
  SubtitleTextResult,
  SyncPublishResult,
  ArticleMediaResult,
  VideoPlaybackResult,
} from "../types.ts";

export interface CreatorViewFace {
  ready: () => boolean;
  listContents: (query: string, filter: ContentFilter) => Promise<ListContentsResult>;
  getRevision: () => Promise<number>;
  getContent: (id: string) => Promise<ContentDetail>;
  getCoverThumb: (id: string) => Promise<CoverThumbResult>;
  getVideoPlayback: (id: string) => Promise<VideoPlaybackResult>;
  getArticleMedia: (id: string) => Promise<ArticleMediaResult>;
  getSubtitleText: (id: string) => Promise<SubtitleTextResult>;
  pickDirectory: () => Promise<string | null>;
  openPath: (path: string) => Promise<void>;
  openFolder: (path: string) => Promise<void>;
  getSettings: () => Promise<LibrarySettings>;
  getCapabilities: () => Promise<CreatorCapabilities>;
  installCapability: (target: CreatorInstallTarget) => Promise<CreatorInstallResult>;
  checkPlatformLogins: (platforms?: PublishPlatform[]) => Promise<CreatorPlatformLoginResult>;
  openPlatformLogin: (platform: PublishPlatform) => Promise<void>;
  setLibraryRoot: (path: string) => Promise<void>;
  setProfile: (profile: CreatorProfile) => Promise<void>;
  setScriptRules: (text: string) => Promise<void>;
  refreshCatalog: () => Promise<ListContentsResult>;
  createContent: (title: string) => Promise<{ id: string; folderPath: string }>;
  markReadyToRecord: (id: string) => Promise<ContentDetail>;
  setContentSkip: (id: string, step: ContentOptionalStep, skipped: boolean) => Promise<ContentDetail>;
  bindStudio: (id: string, path: string) => Promise<ContentDetail>;
  openStudio: (id: string) => Promise<ContentDetail>;
  waitForExport: (id: string) => Promise<ContentDetail>;
  setPublish: (id: string, platform: PublishPlatform, status: PublishMark, url?: string, publishedAt?: number) => Promise<ContentDetail>;
  syncPublish: (request?: { platform?: PublishPlatform; id?: string }) => Promise<SyncPublishResult>;
  openSubtitlePreview: (id: string) => Promise<SubtitlePreviewResult>;
  startSubtitleBurn: (id: string) => Promise<ContentDetail>;
  startSubtitleGenerate: (id: string) => Promise<ContentDetail>;
  startCoverGenerate: (id: string) => Promise<ContentDetail>;
  setScript: (id: string, text: string) => Promise<ContentDetail>;
  setTopicNote: (id: string, text: string) => Promise<ContentDetail>;
}
