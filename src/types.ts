export type ContentFilter = "all" | "cover" | "subtitle" | "article";

export type PipelineStage = "raw" | "subtitled" | "covered" | "packaged";

export type WorkflowStage = "idle" | "record" | "cut" | "finish" | "publish" | "live";

export type PublishPlatform = "xiaohongshu" | "douyin" | "bilibili" | "wechat";

export type PublishMark = "unpublished" | "draft" | "published";

export type PublishSource = "none" | "publisher" | "overlay" | "sync";

export interface PublishMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  syncedAt?: number;
}

export interface PlatformPublish extends PublishMetrics {
  status: PublishMark;
  source: PublishSource;
  url?: string;
  remoteId?: string;
}

export interface ContentPublish {
  xiaohongshu: PlatformPublish;
  douyin: PlatformPublish;
  bilibili: PlatformPublish;
  wechat: PlatformPublish;
}

export type BurnStatus = "idle" | "running" | "done" | "error";

export interface BurnJob {
  status: BurnStatus;
  startedAt?: number;
  output?: string;
  error?: string;
  pid?: number;
}

export type MediaJob = BurnJob;

export type SecretKind = "subtitle" | "cover";

export interface SecretView {
  kind: SecretKind;
  ref: string;
  configured: boolean;
  writable: boolean;
  source?: string;
}

export interface CreatorSecrets {
  subtitle: SecretView;
  cover: SecretView;
}

export interface OverlayPublish extends PublishMetrics {
  status: PublishMark;
  url?: string;
  remoteId?: string;
}

export interface SubtitleCue {
  text: string;
  at?: string;
}

export interface ContentCovers {
  "3x4"?: string;
  "4x3"?: string;
  "16x9"?: string;
}

export interface ContentSubtitles {
  srt?: string;
  ass?: string;
  transcript?: string;
}

export interface ContentSummary {
  id: string;
  folderPath: string;
  title: string;
  date?: string;
  recordedAt: number;
  videoRaw?: string;
  videoSubtitled?: string;
  covers: ContentCovers;
  subtitles: ContentSubtitles;
  hasPublishPackage: boolean;
  hasArticle: boolean;
  studioPath?: string;
  waitingForExport: boolean;
  exportTimedOut?: boolean;
  articlePath?: string;
  tags: string[];
  pipeline: PipelineStage;
  workflow: WorkflowStage;
  publish: ContentPublish;
  burn: BurnJob;
  subtitleJob: MediaJob;
  coverJob: MediaJob;
}

export interface CreatorPlatforms {
  xiaohongshu?: string;
  douyin?: string;
  bilibili?: string;
  wechat?: string;
  youtube?: string;
}

export interface CreatorProfile {
  platforms: CreatorPlatforms;
}

export interface LibrarySettings {
  libraryRoot: string;
  profile: CreatorProfile;
  secrets: CreatorSecrets;
}

export interface LibraryCounts {
  total: number;
  cover: number;
  subtitle: number;
  article: number;
}

export interface ListContentsRequest {
  query: string;
  filter: ContentFilter;
}

export interface ListContentsResult {
  settings: LibrarySettings;
  items: ContentSummary[];
  counts: LibraryCounts;
  revision: number;
}

export interface IdRequest {
  id: string;
}

export interface ContentDetail extends ContentSummary {
  publishCopy: string;
  topicNote: string;
  script: string;
  article: string;
  secrets: CreatorSecrets;
}

export interface CoverThumbResult {
  found: boolean;
  mime: string;
  base64: string;
}

export interface VideoPlaybackResult {
  found: boolean;
  url: string;
  kind: "raw" | "subtitled";
}

export interface ArticleMediaResult {
  found: boolean;
  origin: string;
}

export interface SubtitleTextResult {
  text: string;
  cues: SubtitleCue[];
}

export interface SetLibraryRootRequest {
  path: string;
}

export interface CreateContentRequest {
  title: string;
}

export interface CreateContentResult {
  id: string;
  folderPath: string;
}

export interface SetContentStageRequest {
  id: string;
  readyToRecord: boolean;
}

export interface BindStudioRequest {
  id: string;
  path: string;
}

export interface WaitExportRequest {
  id: string;
  timeoutMs?: number;
}

export interface OverlayItem {
  title?: string;
  readyToRecord?: boolean;
  studioPath?: string;
  waitingForExport?: boolean;
  exportTimedOut?: boolean;
  publish?: Partial<Record<PublishPlatform, OverlayPublish>>;
  burn?: BurnJob;
  subtitleJob?: MediaJob;
  coverJob?: MediaJob;
}

export interface SetPublishRequest {
  id: string;
  platform: PublishPlatform;
  status: PublishMark;
  url?: string;
}

export interface SubtitlePreviewResult {
  url: string;
  port: number;
}

export interface SyncPublishRequest {
  id?: string;
  platform?: PublishPlatform;
  force?: boolean;
}

export interface SyncPublishResult {
  matched: number;
  cached?: boolean;
  platforms: Array<{
    platform: PublishPlatform;
    count: number;
    loginRequired?: boolean;
    error?: string;
  }>;
}

export interface OverlayStore {
  schemaVersion: 1;
  libraryRoot?: string;
  profile?: CreatorProfile;
  items: Record<string, OverlayItem>;
}

export type OrganizeReason = "add-date" | "readable-title" | "both";

export interface OrganizeMove {
  from: string;
  to: string;
  reason: OrganizeReason;
}

export interface OrganizeRequest {
  apply: boolean;
  ids: string[];
}

export interface OrganizePreview {
  moves: OrganizeMove[];
  unchanged: number;
}

export interface SetProfileRequest {
  profile: CreatorProfile;
}

export interface SetTopicNoteRequest {
  id: string;
  text: string;
}

export interface SetScriptRequest {
  id: string;
  text: string;
}
