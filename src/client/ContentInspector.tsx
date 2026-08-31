import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  IconBrowseOutline16,
  IconCloseOutline16,
  IconFolderOpenOutline16,
  MarkdownText,
  Menu,
  StateDot,
} from "@deepseek-ai/dsh-client-ui-primitives";
import type { InjectFace, PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";

import { formatCount } from "../collectPublish.ts";
import { isPublishMark } from "../publishStatus.ts";
import { rewriteArticleImages } from "../articleMarkdown.ts";
import type { ArticleMediaResult, ContentDetail, ContentOptionalStep, PublishMark, PublishPlatform, SubtitleCue, VideoPlaybackResult, WorkflowStage } from "../types.ts";
import { CoverThumb, coverThumbRevision } from "./CoverThumb.tsx";
import type { CreatorViewFace } from "./face.ts";
import {
  applyConversationInset,
  clearConversationInset,
  getInspectorWidth,
  setInspectorWidth,
  useLibraryEpoch,
  useProfileEpoch,
  useSelectedContentId,
} from "./contentSelection.ts";
import type { CreatorKey } from "./locales.ts";
import type { CockpitState } from "../cockpit/schemas.ts";
import type { CreatorCockpitFace } from "./operations/face.ts";
import { sendCockpitInstruction } from "./operations/sessionBridge.tsx";
import {
  buildPresentationInstruction,
  type PresentationAspect,
} from "./presentationInstruction.ts";
import { PlatformMark } from "./PlatformMark.tsx";
import { isPublishSyncDisabled, PUBLISH_UI_PLATFORMS, selectEnabledPublishPlatforms } from "./publishPlatforms.ts";
import { formatRelativeTime } from "./relativeTime.ts";
import {
  contentProgress,
  contentStepHasAsset,
  contentStepIsSkipped,
  publishProgress,
  readTopicSummary,
  replaceTopicCore,
  type ContentProgressStep,
} from "./contentWorkflow.ts";
import { WORKFLOW_TONE } from "./sidebar/ContentSidebarPanel.tsx";
import { ActionBar, ActionButton } from "./ui/ActionButton.tsx";
import { StatusPill, type StatusTone } from "./ui/StatusPill.tsx";
import { Surface } from "./ui/Surface.tsx";
import "./ContentInspector.css";

const TABS = ["overview", "script", "presentation", "video", "subtitle", "cover", "article"] as const;
type InspectorTab = (typeof TABS)[number];

const PROGRESS_KEY: Record<ContentProgressStep, CreatorKey> = {
  topic: "inspector.step.topic",
  script: "inspector.step.script",
  presentation: "inspector.step.presentation",
  video: "inspector.step.video",
  subtitle: "inspector.step.subtitle",
  cover: "inspector.step.cover",
  article: "inspector.step.article",
  publish: "inspector.step.publish",
};

const PROGRESS_HINT_KEY: Partial<Record<ContentProgressStep, CreatorKey>> = {
  script: "inspector.step.scriptHint",
  presentation: "inspector.step.presentationHint",
  video: "inspector.step.videoHint",
  subtitle: "inspector.step.subtitleHint",
  cover: "inspector.step.coverHint",
  article: "inspector.step.articleHint",
};

const PROGRESS_TAB: Partial<Record<ContentProgressStep, InspectorTab>> = {
  script: "script",
  presentation: "presentation",
  video: "video",
  subtitle: "subtitle",
  cover: "cover",
  article: "article",
};

const PUBLISH_KEY: Record<PublishMark, CreatorKey> = {
  unpublished: "inspector.publish.unpublished",
  draft: "inspector.publish.draft",
  published: "inspector.publish.published",
};

const PUBLISH_TONE: Record<PublishMark, StatusTone> = {
  unpublished: "neutral",
  draft: "pending",
  published: "success",
};

const PUBLISH_MARKS: readonly PublishMark[] = ["unpublished", "draft", "published"];

const STAGE_KEY: Record<WorkflowStage, CreatorKey> = {
  idle: "inspector.stage.idle",
  record: "inspector.stage.record",
  cut: "inspector.stage.cut",
  finish: "inspector.stage.finish",
  publish: "inspector.stage.publish",
  live: "inspector.stage.live",
};

const TAB_KEY: Record<InspectorTab, CreatorKey> = {
  overview: "inspector.tab.overview",
  script: "inspector.tab.script",
  presentation: "inspector.tab.presentation",
  video: "inspector.tab.video",
  subtitle: "inspector.tab.subtitle",
  cover: "inspector.tab.cover",
  article: "inspector.tab.article",
};

function cuesFromSubtitle(nextSubtitle: { text: string; cues: SubtitleCue[] }): SubtitleCue[] {
  if (nextSubtitle.cues.length > 0) return nextSubtitle.cues;
  if (nextSubtitle.text === "") return [];
  return nextSubtitle.text.split("\n").filter((line) => line.trim() !== "").map((text) => ({ text }));
}

function friendlyError(cause: unknown, t: (key: CreatorKey) => string): string {
  if (cause instanceof Error) {
    if (cause.message.startsWith("content not found")) return t("empty.gone" as CreatorKey);
    return cause.message;
  }
  return t("empty.error" as CreatorKey);
}

function metricParts(
  row: { views?: number; likes?: number; comments?: number },
  t: (key: CreatorKey) => string,
): string[] {
  const parts: string[] = [];
  if (row.views !== undefined) {
    parts.push(t("inspector.publish.views").replace("{n}", formatCount(row.views)));
  }
  if (row.likes !== undefined) {
    parts.push(t("inspector.publish.likes").replace("{n}", formatCount(row.likes)));
  }
  if (row.comments !== undefined) {
    parts.push(t("inspector.publish.comments").replace("{n}", formatCount(row.comments)));
  }
  return parts;
}

function dateInputValue(value?: number): string {
  if (value === undefined) return "";
  const date = new Date(value);
  const pad = (part: number): string => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateInputTimestamp(value: string): number | undefined {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return undefined;
  const timestamp = new Date(year, month - 1, day, 12).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function JobNote({ tone, children }: { tone?: "running" | "done" | "error"; children: ReactNode }) {
  return (
    <div className={tone === undefined ? "jobNote" : `jobNote ${tone}`}>
      {tone === "running" && <StateDot state="ongoing" size={12} />}
      {tone === "done" && <StateDot state="done" size={12} />}
      {tone === "error" && <StateDot state="error" size={12} />}
      {children}
    </div>
  );
}

interface AssetShelfEntry {
  label: string;
  path?: string;
  expectedPath: string;
  status?: string;
  tone?: StatusTone;
  onReveal?: () => void;
}

function relativeAssetPath(path: string, folderPath: string): string {
  const normalizedPath = path.replaceAll("\\", "/");
  const normalizedFolder = folderPath.replaceAll("\\", "/").replace(/\/$/, "");
  if (normalizedPath.startsWith(`${normalizedFolder}/`)) {
    return normalizedPath.slice(normalizedFolder.length + 1);
  }
  return normalizedPath.split("/").filter(Boolean).at(-1) ?? normalizedPath;
}

function AssetShelf({
  folderPath,
  entries,
  openPath,
  t,
}: {
  folderPath: string;
  entries: AssetShelfEntry[];
  openPath: (path: string) => Promise<void>;
  t: (key: CreatorKey) => string;
}) {
  const readyCount = entries.filter((entry) => entry.path !== undefined).length;
  return (
    <section className="assetShelf">
      <header className="assetShelfHeader">
        <div>
          <span className="eyebrow">{t("inspector.assets.eyebrow" as CreatorKey)}</span>
          <h2>{t("inspector.assets.title" as CreatorKey)}</h2>
        </div>
        <span className="assetShelfCount">
          {t("inspector.assets.count" as CreatorKey)
            .replace("{ready}", String(readyCount))
            .replace("{total}", String(entries.length))}
        </span>
      </header>
      <div className="assetShelfRows">
        {entries.map((entry) => {
          const ready = entry.path !== undefined;
          const shownPath = entry.path ?? entry.expectedPath;
          return (
            <div className="assetShelfRow" key={`${entry.label}-${entry.expectedPath}`}>
              <div className="assetShelfIdentity">
                <strong>{entry.label}</strong>
                <code title={shownPath}>{relativeAssetPath(shownPath, folderPath)}</code>
              </div>
              <div className="assetShelfActions">
                <StatusPill tone={entry.tone ?? (ready ? "success" : "neutral")}>
                  {entry.status ?? t((ready ? "inspector.assets.ready" : "inspector.assets.waiting") as CreatorKey)}
                </StatusPill>
                {entry.path !== undefined && (
                  <button
                    type="button"
                    className="assetReveal"
                    onClick={() => {
                      if (entry.onReveal !== undefined) entry.onReveal();
                      else void openPath(entry.path!);
                    }}
                  >
                    {t("inspector.assets.reveal" as CreatorKey)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OverviewContentBrief({
  detail,
  cockpit,
  cover,
  saveCore,
  t,
}: {
  detail: ContentDetail;
  cockpit: CreatorCockpitFace;
  cover?: ReactNode;
  saveCore: (core: string) => Promise<void>;
  t: (key: CreatorKey) => string;
}) {
  const [state, setState] = useState<CockpitState | undefined>(undefined);
  const summary = readTopicSummary(detail.topicNote, detail.title);
  const [editingCore, setEditingCore] = useState(false);
  const [coreDraft, setCoreDraft] = useState(summary.core);
  const [coreSaving, setCoreSaving] = useState(false);
  const [coreError, setCoreError] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void cockpit.getCockpitState().then((next) => {
      if (live) setState(next);
    }, () => undefined);
    return () => { live = false; };
  }, [detail.id, cockpit]);

  useEffect(() => {
    setCoreDraft(summary.core);
    setEditingCore(false);
    setCoreError(undefined);
  }, [detail.id, detail.topicNote]);

  const meta = state?.contentMeta[detail.id];
  const core = summary.core || t("inspector.overview.coreEmpty" as CreatorKey);
  const note = summary.note;
  const tags = [...new Set([...detail.tags, ...(meta?.tags ?? [])])];
  const goals = (meta?.goalIds ?? [])
    .map((id) => state?.goals.find((goal) => goal.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  const priority = meta?.priority === undefined
    ? undefined
    : t(`inspector.overview.priority.${meta.priority}` as CreatorKey);
  const strategy = [meta?.contentType, meta?.tier, priority, ...goals]
    .filter((value): value is string => value !== undefined && value !== "");

  return (
    <section className={cover === undefined ? "overviewBrief" : "overviewBrief withCover"}>
      <div className="overviewBriefMain">
        <div className="overviewBriefTopline">
          <span className="eyebrow">{t("inspector.overview.eyebrow" as CreatorKey)}</span>
          <div className="overviewBriefState">
            <StatusPill tone={WORKFLOW_TONE[detail.workflow]}>{t(STAGE_KEY[detail.workflow])}</StatusPill>
            <span>{formatRelativeTime(detail.recordedAt, Date.now(), t)}</span>
          </div>
        </div>
        <div className="overviewField topicField">
          <span>{t("inspector.overview.topic" as CreatorKey)}</span>
          <h2>{detail.title}</h2>
        </div>
        <div className="overviewField coreField">
          <div className="coreFieldHeader">
            <span>{t("inspector.overview.core" as CreatorKey)}</span>
            {!editingCore && (
              <button type="button" onClick={() => { setCoreDraft(summary.core); setEditingCore(true); }}>
                {t("inspector.overview.coreEdit" as CreatorKey)}
              </button>
            )}
          </div>
          {editingCore
            ? (
              <div className="coreEditor">
                <textarea
                  autoFocus={true}
                  rows={3}
                  value={coreDraft}
                  placeholder={t("inspector.overview.corePlaceholder" as CreatorKey)}
                  disabled={coreSaving}
                  onChange={(event) => { setCoreDraft(event.target.value); setCoreError(undefined); }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setCoreDraft(summary.core);
                      setEditingCore(false);
                    }
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && coreDraft.trim() !== "") {
                      event.preventDefault();
                      setCoreSaving(true);
                      void saveCore(coreDraft).then(() => {
                        setEditingCore(false);
                        setCoreSaving(false);
                      }, (cause: unknown) => {
                        setCoreError(cause instanceof Error ? cause.message : t("inspector.overview.coreSaveFailed" as CreatorKey));
                        setCoreSaving(false);
                      });
                    }
                  }}
                />
                <div className="coreEditorActions">
                  <button type="button" disabled={coreSaving} onClick={() => { setCoreDraft(summary.core); setEditingCore(false); }}>
                    {t("inspector.overview.coreCancel" as CreatorKey)}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={coreSaving || coreDraft.trim() === ""}
                    onClick={() => {
                      setCoreSaving(true);
                      void saveCore(coreDraft).then(() => {
                        setEditingCore(false);
                        setCoreSaving(false);
                      }, (cause: unknown) => {
                        setCoreError(cause instanceof Error ? cause.message : t("inspector.overview.coreSaveFailed" as CreatorKey));
                        setCoreSaving(false);
                      });
                    }}
                  >
                    {t((coreSaving ? "inspector.overview.coreSaving" : "inspector.overview.coreSave") as CreatorKey)}
                  </button>
                </div>
                {coreError !== undefined && <p className="coreEditorError">{coreError}</p>}
              </div>
            )
            : <p>{core}</p>}
        </div>
        {note !== "" && <p className="overviewNote">{note}</p>}
        {(strategy.length > 0 || tags.length > 0) && (
          <div className="overviewMeta">
            {strategy.map((value) => <span className="strategyChip" key={value}>{value}</span>)}
            {tags.map((tag) => <span className="tagChip" key={tag}>#{tag}</span>)}
          </div>
        )}
      </div>
      {cover}
    </section>
  );
}

function ScriptOperationsBridge({
  contentId,
  cockpit,
  t,
}: {
  contentId: string;
  cockpit: CreatorCockpitFace;
  t: (key: CreatorKey) => string;
}) {
  const [state, setState] = useState<CockpitState | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void cockpit.getCockpitState().then((next) => {
      if (live) setState(next);
    }, (cause: unknown) => {
      if (live) setError(cause instanceof Error ? cause.message : t("operations.state.unavailable"));
    });
    return () => { live = false; };
  }, [contentId]);
  const meta = state?.contentMeta[contentId];
  const activeKnowledge = state?.knowledgeItems.filter((entry) => entry.active) ?? [];
  const selectedIds = meta?.knowledgeIds ?? [];
  const toggleKnowledge = (id: string, selected: boolean): void => {
    const knowledgeIds = selected
      ? [...selectedIds, id]
      : selectedIds.filter((value) => value !== id);
    void cockpit.setContentMeta({ contentId, patch: { knowledgeIds } }).then(setState, (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : t("operations.state.writeFailed"));
    });
  };
  const strategy = [
    meta?.contentType,
    meta?.tier,
    meta?.hookType,
    meta?.structureType,
    ...(meta?.tags ?? []),
  ].filter((value): value is string => value !== undefined && value !== "");
  return (
    <section className="scriptOperationsBridge">
      <header><div><strong>{t("inspector.operations.title")}</strong><span>{t("inspector.operations.hint")}</span></div><button type="button" onClick={() => {
        const sent = sendCockpitInstruction(`请为 contentId=${contentId} 创作口播脚本。先调用 jacky_creator_get_script_context 读取运营看板中已选的策略、规则和模板，再调用 jacky_creator_script_rules 读取长期人设规则。结合 topic.md 写出成稿，并保存到这条 Jacky 内容项目的 script.md。不要只把脚本发在对话里。`);
        if (!sent) window.alert(t("operations.ai.noSession"));
      }}>{t("inspector.operations.create")}</button></header>
      {error !== undefined && <p className="scriptOperationsError">{error}</p>}
      {strategy.length > 0 && <div className="scriptStrategyChips">{strategy.map((value) => <span key={value}>{value}</span>)}</div>}
      {activeKnowledge.length > 0 ? <div className="scriptKnowledgeChoices">{activeKnowledge.map((entry) => <label key={entry.id}><input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={(event) => { toggleKnowledge(entry.id, event.target.checked); }} /><span>{entry.kind === "rule" ? t("operations.knowledge.rule") : t("operations.knowledge.template")} · {entry.title}</span></label>)}</div> : state !== undefined && <p>{t("operations.knowledge.empty")}</p>}
    </section>
  );
}

export type ContentInspectorProps =
  & PropsRuntime<"shell.overlay">
  & InjectFace<CreatorViewFace>
  & PropsLocale<"dsh.jacky.creator">
  & {
    closeDetails: () => void;
    cockpit: CreatorCockpitFace;
  };

export function ContentInspector({
  t,
  useSessions,
  ready,
  getContent,
  getCoverThumb,
  getVideoPlayback,
  getArticleMedia,
  getSubtitleText,
  getSettings,
  setContentSkip,
  bindStudio,
  openStudio,
  waitForExport,
  setPublish,
  syncPublish,
  startSubtitleGenerate,
  startSubtitleBurn,
  startCoverGenerate,
  setScript,
  setTopicNote,
  pickDirectory,
  openSubtitlePreview,
  openPath,
  openFolder,
  closeDetails,
  cockpit,
}: ContentInspectorProps) {
  const [selectedId, setSelectedId] = useSelectedContentId();
  const currentSessionId = useSessions((sessions) => sessions.current);
  const libraryEpoch = useLibraryEpoch();
  const profileEpoch = useProfileEpoch();
  const [enabledPlatforms, setEnabledPlatforms] = useState<readonly PublishPlatform[] | undefined>(undefined);
  const scriptSavedRef = useRef(true);
  const loadedId = useRef<string | null>(null);
  const [detail, setDetail] = useState<ContentDetail | undefined>(undefined);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<InspectorTab>("overview");
  const [panelWidth, setPanelWidth] = useState(getInspectorWidth);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [sessionHint, setSessionHint] = useState<string | undefined>(undefined);

  const [busy, setBusy] = useState<"subtitle" | "burn" | "cover" | "sync" | undefined>(undefined);
  const expectSubtitlePreview = useRef(false);
  const [syncHint, setSyncHint] = useState<string | undefined>(undefined);
  const [scriptDraft, setScriptDraft] = useState("");
  const [scriptSaved, setScriptSaved] = useState(true);
  scriptSavedRef.current = scriptSaved;
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [videoReady, setVideoReady] = useState(false);
  const [articleOrigin, setArticleOrigin] = useState<string | undefined>(undefined);
  const [publishMenu, setPublishMenu] = useState<PublishPlatform | null>(null);
  const [publishPending, setPublishPending] = useState<PublishPlatform | null>(null);
  const [coverPreview, setCoverPreview] = useState<"3x4" | "4x3" | "16x9" | undefined>(undefined);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setTab("overview");
    setActionError(undefined);
    setSessionHint(undefined);

    setSyncHint(undefined);
    setScriptDraft("");
    setScriptSaved(true);
    setVideoSrc(undefined);
    setVideoReady(false);
    setArticleOrigin(undefined);
    setBusy(undefined);
    expectSubtitlePreview.current = false;
    setPublishMenu(null);
    setPublishPending(null);
    setCoverPreview(undefined);
  }, [selectedId]);

  useEffect(() => {
    if (coverPreview === undefined) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setCoverPreview(undefined);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); };
  }, [coverPreview]);

  useEffect(() => {
    let cancelled = false;
    setEnabledPlatforms(undefined);
    if (!ready()) {
      setEnabledPlatforms([]);
      return () => { cancelled = true; };
    }
    void getSettings().then((settings) => {
      if (!cancelled) setEnabledPlatforms(settings.profile.enabledPlatforms);
    }, () => {
      if (!cancelled) setEnabledPlatforms([]);
    });
    return () => { cancelled = true; };
  }, [getSettings, libraryEpoch, profileEpoch, ready]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { setExpanded(true); });
    return () => { window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      loadedId.current = null;
      setDetail(undefined);
      setCues([]);
      setError(undefined);
      return;
    }
    if (!ready()) {
      setError(t("empty.remote" as CreatorKey));
      return;
    }
    const switched = loadedId.current !== selectedId;
    let cancelled = false;
    setError(undefined);
    void Promise.all([getContent(selectedId), getSubtitleText(selectedId)]).then(
      ([nextDetail, nextSubtitle]) => {
        if (cancelled) return;
        loadedId.current = selectedId;
        setDetail(nextDetail);
        if (switched || scriptSavedRef.current) {
          setScriptDraft(nextDetail.script);
          setScriptSaved(true);
        }
        setCues(cuesFromSubtitle(nextSubtitle));
      },
      (cause: unknown) => {
        if (cancelled) return;
        setDetail(undefined);
        setCues([]);
        setError(friendlyError(cause, t));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedId, libraryEpoch]);

  useEffect(() => {
    if (tab !== "video" || selectedId === null || !ready()) return;
    let cancelled = false;
    setVideoReady(false);
    void getVideoPlayback(selectedId).then((next: VideoPlaybackResult) => {
      if (cancelled) return;
      setVideoSrc(next.found ? next.url : undefined);
      setVideoReady(true);
    }, () => {
      if (cancelled) return;
      setVideoSrc(undefined);
      setVideoReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, selectedId, libraryEpoch]);

  useEffect(() => {
    if (tab !== "article" || selectedId === null || !ready()) return;
    let cancelled = false;
    void getArticleMedia(selectedId).then((next: ArticleMediaResult) => {
      if (cancelled) return;
      setArticleOrigin(next.found ? next.origin : undefined);
    }, () => {
      if (!cancelled) setArticleOrigin(undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, selectedId, libraryEpoch]);

  useEffect(() => {
    if (detail === undefined || scriptSaved) return;
    const timer = window.setTimeout(() => {
      void setScript(detail.id, scriptDraft).then((next) => {
        setDetail(next);
        setScriptSaved(scriptDraft === next.script);
      }, (cause: unknown) => {
        setActionError(cause instanceof Error ? cause.message : t("empty.error" as CreatorKey));
      });
    }, 700);
    return () => {
      window.clearTimeout(timer);
    };
  }, [detail?.id, scriptDraft, scriptSaved]);

  useEffect(() => {
    const running = detail?.burn.status === "running"
      || detail?.subtitleJob.status === "running"
      || detail?.coverJob.status === "running";
    if (!running || selectedId === null || !ready()) return;
    const timer = window.setInterval(() => {
      void getContent(selectedId).then((next) => { setDetail(next); });
    }, 3000);
    return () => { window.clearInterval(timer); };
  }, [selectedId, detail?.burn.status, detail?.subtitleJob.status, detail?.coverJob.status]);

  useEffect(() => {
    if (selectedId === null || detail?.subtitleJob.status !== "done" || !ready()) return;
    void getSubtitleText(selectedId).then((nextSubtitle) => {
      setCues(cuesFromSubtitle(nextSubtitle));
    });
  }, [selectedId, detail?.subtitleJob.status]);

  useEffect(() => {
    if (!expectSubtitlePreview.current || selectedId === null || !ready()) return;
    if (detail?.subtitleJob.status === "done") {
      expectSubtitlePreview.current = false;
      void openSubtitlePreview(selectedId).then(() => undefined, (cause: unknown) => {
        setActionError(cause instanceof Error ? cause.message : t("empty.error" as CreatorKey));
      });
      return;
    }
    if (detail?.subtitleJob.status === "error") expectSubtitlePreview.current = false;
  }, [selectedId, detail?.subtitleJob.status]);

  const shownWidth = expanded ? panelWidth : 0;

  const applyPublish = (platform: PublishPlatform, status: PublishMark): void => {
    setPublishMenu(null);
    if (detail === undefined || detail.publish[platform].status === status) return;
    setPublishPending(platform);
    void setPublish(detail.id, platform, status).then((next) => {
      setDetail(next);
      setPublishPending(null);
    }, (cause: unknown) => {
      setActionError(cause instanceof Error ? cause.message : t("empty.error" as CreatorKey));
      setPublishPending(null);
    });
  };

  const applyPublishedAt = (platform: PublishPlatform, value: string): void => {
    if (detail === undefined) return;
    const publishedAt = dateInputTimestamp(value);
    if (publishedAt === undefined) return;
    const row = detail.publish[platform];
    setPublishPending(platform);
    void setPublish(detail.id, platform, "published", row.url, publishedAt).then((next) => {
      setDetail(next);
      setPublishPending(null);
    }, (cause: unknown) => {
      setActionError(cause instanceof Error ? cause.message : t("empty.error" as CreatorKey));
      setPublishPending(null);
    });
  };

  useEffect(() => {
    if (selectedId === null) {
      clearConversationInset();
      return;
    }
    applyConversationInset(shownWidth, !dragging);
  }, [selectedId, currentSessionId, shownWidth, dragging]);

  useEffect(() => () => { clearConversationInset(); }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      if (drag.current === null) return;
      setInspectorWidth(drag.current.startWidth + (event.clientX - drag.current.startX));
      setPanelWidth(getInspectorWidth());
    };
    const onUp = (): void => {
      if (drag.current === null) return;
      drag.current = null;
      setDragging(false);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (selectedId === null) return null;

  const hasVideo = detail?.videoRaw !== undefined || detail?.videoSubtitled !== undefined;
  const hasSubtitleDraft = detail?.subtitles.srt !== undefined || detail?.subtitles.transcript !== undefined;
  const canPreviewSubtitle = hasSubtitleDraft || detail?.subtitleJob.status === "done";
  const hasAnyCover = detail !== undefined
    && (detail.covers["3x4"] !== undefined || detail.covers["4x3"] !== undefined || detail.covers["16x9"] !== undefined);
  const platformSettingsPending = enabledPlatforms === undefined;
  const visiblePlatforms = platformSettingsPending ? [] : selectEnabledPublishPlatforms(enabledPlatforms);
  const publication = detail === undefined
    ? { published: 0, total: visiblePlatforms.length, completed: false }
    : publishProgress(detail.publish, visiblePlatforms.map((platform) => platform.key));
  const anyPublishMarked = detail !== undefined
    && visiblePlatforms.some((platform) => detail.publish[platform.key].status !== "unpublished");
  const progress = detail === undefined ? undefined : contentProgress(detail, publication.completed);
  const currentStep = progress?.current ?? "script";
  const presentationHasAsset = detail !== undefined && contentStepHasAsset(detail, "presentation");
  const subtitleHasAsset = detail !== undefined && contentStepHasAsset(detail, "subtitle");
  const articleHasAsset = detail !== undefined && contentStepHasAsset(detail, "article");

  const onSaveCore = async (core: string): Promise<void> => {
    if (detail === undefined) return;
    const nextText = replaceTopicCore(detail.topicNote, detail.title, core);
    const next = await setTopicNote(detail.id, nextText);
    setDetail(next);
  };

  const onBindStudio = (): void => {
    if (detail === undefined) return;
    setActionError(undefined);
    void pickDirectory()
      .then((path) => {
        if (path === null) return undefined;
        return bindStudio(detail.id, path);
      })
      .then((next) => {
        if (next !== undefined) setDetail(next);
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "";
        if (message.includes("multiple Screen Studio projects")) {
          setActionError(t("inspector.studio.multiple" as CreatorKey));
        } else if (message.includes("not a Screen Studio project")) {
          setActionError(t("inspector.studio.invalid" as CreatorKey));
        } else if (message.includes("Screen Studio project missing")) {
          setActionError(t("inspector.studio.missing" as CreatorKey));
        } else {
          setActionError(message || t("inspector.studio.bindFailed" as CreatorKey));
        }
      });
  };

  const onOpenStudio = (): void => {
    if (detail === undefined) return;
    setActionError(undefined);
    void openStudio(detail.id)
      .then(() => waitForExport(detail.id))
      .then(setDetail, (cause: unknown) => {
        setActionError(cause instanceof Error ? cause.message : t("inspector.studio.openFailed" as CreatorKey));
      });
  };

  const onUseExternalEditor = (): void => {
    if (detail === undefined) return;
    setActionError(undefined);
    void openFolder(detail.folderPath).catch((cause: unknown) => {
      setActionError(cause instanceof Error ? cause.message : t("inspector.video.openFolderFailed" as CreatorKey));
    });
    void waitForExport(detail.id).then(setDetail, (cause: unknown) => {
      setActionError(cause instanceof Error ? cause.message : t("inspector.video.waitFailed" as CreatorKey));
    });
  };

  const onToggleSkip = (step: ContentOptionalStep): void => {
    if (detail === undefined) return;
    const skipped = !contentStepIsSkipped(detail, step);
    setActionError(undefined);
    void setContentSkip(detail.id, step, skipped).then(setDetail, (cause: unknown) => {
      setActionError(cause instanceof Error ? cause.message : t("empty.error" as CreatorKey));
    });
  };

  const onGenerateCover = (): void => {
    if (detail === undefined) return;
    if (detail.videoRaw === undefined && detail.videoSubtitled === undefined) {
      setActionError(t("inspector.cover.needVideo" as CreatorKey));
      return;
    }
    if (!detail.secrets.cover.configured) {
      setActionError(t("inspector.cover.needKey" as CreatorKey));
      return;
    }
    setActionError(undefined);
    setBusy("cover");
    void startCoverGenerate(detail.id).then((next) => {
      setDetail(next);
      setBusy(undefined);
    }, (cause: unknown) => {
      setActionError(cause instanceof Error ? cause.message : t("empty.error" as CreatorKey));
      setBusy(undefined);
    });
  };

  const onGeneratePresentation = (aspect: PresentationAspect): void => {
    if (detail === undefined) return;
    if (detail.script.trim() === "" && scriptDraft.trim() === "") {
      setActionError(t("inspector.presentation.needScript" as CreatorKey));
      return;
    }
    setActionError(undefined);
    const instruction = buildPresentationInstruction({
      id: detail.id,
      folderPath: detail.folderPath,
      aspect,
    });
    if (!sendCockpitInstruction(instruction)) {
      setActionError(t("operations.ai.noSession"));
      return;
    }
    setSessionHint(t("inspector.presentation.submitted" as CreatorKey));
  };

  const onGenerateArticle = (): void => {
    if (detail === undefined) return;
    if (detail.script.trim() === "" && scriptDraft.trim() === "") {
      setActionError(t("inspector.article.needScript" as CreatorKey));
      return;
    }
    setActionError(undefined);
    const output = detail.articlePath ?? `${detail.folderPath}/公众号文章/${detail.id}.md`;
    const instruction = [
      `请把 contentId=${JSON.stringify(detail.id)} 的 script.md 改写为公众号文章。`,
      "保留核心观点、案例、证据和个人表达，删除口播停顿、重复和舞台提示，按阅读逻辑重组。",
      "输出必须是纯 Markdown：一个 H1，正文使用 H2/H3；不用 HTML，不使用排版占位文本；图片只用相对路径 images/文件名。",
      `把成稿写入 ${JSON.stringify(output)}，不要只发在对话里。若文件已存在，先询问我是否覆盖。`,
    ].join("\n");
    if (!sendCockpitInstruction(instruction)) {
      setActionError(t("operations.ai.noSession"));
      return;
    }
    setSessionHint(t("inspector.article.submitted" as CreatorKey));
  };

  const onGenerateSubtitle = (): void => {
    if (detail === undefined) return;
    if (detail.videoRaw === undefined && detail.videoSubtitled === undefined) {
      setActionError(t("inspector.subtitle.needVideo" as CreatorKey));
      return;
    }
    if (!detail.secrets.subtitle.configured) {
      setActionError(t("inspector.subtitle.needKey" as CreatorKey));
      return;
    }
    setActionError(undefined);
    setBusy("subtitle");
    expectSubtitlePreview.current = true;
    void startSubtitleGenerate(detail.id).then((next) => {
      setDetail(next);
      setBusy(undefined);
    }, (cause: unknown) => {
      expectSubtitlePreview.current = false;
      setActionError(cause instanceof Error ? cause.message : t("empty.error" as CreatorKey));
      setBusy(undefined);
    });
  };

  const onBurnSubtitle = (): void => {
    if (detail === undefined) return;
    if (detail.videoRaw === undefined) {
      setActionError(t("inspector.subtitle.needVideo" as CreatorKey));
      return;
    }
    if (!hasSubtitleDraft && detail.subtitleJob.status !== "done") {
      setActionError(t("inspector.subtitle.needDraft" as CreatorKey));
      return;
    }
    setActionError(undefined);
    setBusy("burn");
    void startSubtitleBurn(detail.id).then((next) => {
      setDetail(next);
      setBusy(undefined);
    }, (cause: unknown) => {
      setActionError(cause instanceof Error ? cause.message : t("empty.error" as CreatorKey));
      setBusy(undefined);
    });
  };

  const onPreviewSubtitle = (): void => {
    if (detail === undefined) return;
    void openSubtitlePreview(detail.id).then(() => undefined, (cause: unknown) => {
      setActionError(cause instanceof Error ? cause.message : t("empty.error" as CreatorKey));
    });
  };

  const onSyncPublish = (): void => {
    if (detail === undefined) return;
    setActionError(undefined);
    setBusy("sync");
    void syncPublish({ id: detail.id }).then((result) => {
      const login = result.platforms
        .filter((page) => page.loginRequired === true)
        .map((page) => {
          const label = PUBLISH_UI_PLATFORMS.find((item) => item.key === page.platform);
          return label === undefined ? page.platform : t(label.label);
        });
      setSyncHint(t((result.cached === true ? "inspector.publish.cached" : "inspector.publish.synced") as CreatorKey)
        .replace("{n}", String(result.matched)));
      if (login.length > 0) {
        setActionError(
          t("inspector.publish.login" as CreatorKey).replace("{name}", login.join("、")),
        );
      }
      setBusy(undefined);
      return getContent(detail.id);
    }).then((next) => {
      if (next !== undefined) setDetail(next);
    }, (cause: unknown) => {
      setActionError(cause instanceof Error ? cause.message : t("empty.error" as CreatorKey));
      setBusy(undefined);
    });
  };

  const currentStepTab = PROGRESS_TAB[currentStep];

  return (
    <div
      data-plugin="jacky-creator"
      data-surface="inspector"
      className={[
        "docked",
        expanded ? "open" : "",
        dragging ? "dragging" : "",
        panelWidth >= 560 ? "wide" : "",
      ].filter((part) => part !== "").join(" ")}
      style={{
        width: shownWidth,
      }}
    >
      <header className="header">
        <div className="titleRow">
          <div className="title">
            {detail?.title ?? (error === undefined ? t("empty.loading" as CreatorKey) : "")}
          </div>
          <div className="titleActions">
            {detail !== undefined && (
              <button
                type="button"
                className="close"
                aria-label={t("inspector.openFolder" as CreatorKey)}
                onClick={() => { void openFolder(detail.folderPath); }}
              >
                <IconFolderOpenOutline16 size={14} />
              </button>
            )}
            <button
              type="button"
              className="close"
              aria-label={t("inspector.close" as CreatorKey)}
              onClick={() => {
                setSelectedId(null);
                closeDetails();
              }}
            >
              <IconCloseOutline16 size={14} />
            </button>
          </div>
        </div>
        <div className="tabs" role="tablist">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "tab active" : "tab"}
              onClick={() => {
                setTab(id);
                setActionError(undefined);
                setSessionHint(undefined);
              }}
            >
              {t(TAB_KEY[id])}
            </button>
          ))}
        </div>
      </header>
      <div className="body">
        {error !== undefined && <div className="empty">{error}</div>}
        {error === undefined && detail === undefined && (
          <div className="empty">{t("empty.loading" as CreatorKey)}</div>
        )}
        {detail !== undefined && tab === "overview" && (
          <>
            <OverviewContentBrief
              detail={detail}
              cockpit={cockpit}
              saveCore={onSaveCore}
              t={t}
              {...(hasAnyCover ? {
                cover: (
                  <button className="overviewCover" type="button" onClick={() => { setTab("cover"); }}>
                    <CoverThumb
                      id={detail.id}
                      load={getCoverThumb}
                      revision={coverThumbRevision(detail.covers)}
                      fallback={<IconBrowseOutline16 className="coverFallback" size={22} />}
                    />
                    <span>{t("inspector.overview.openCover" as CreatorKey)}</span>
                  </button>
                ),
              } : {})}
            />
            <div className="stepper" aria-hidden="true">
              {progress?.steps.map((step) => (
                <div key={step.id} className={`step ${step.status}`}>
                  <span className="stepDot" />
                  <span className="stepLabel">{t(PROGRESS_KEY[step.id])}</span>
                </div>
              ))}
            </div>
            {sessionHint !== undefined && <JobNote tone="done">{sessionHint}</JobNote>}
            {currentStepTab !== undefined && (
              <div className="overviewNextAction">
                <Surface
                  title={t("inspector.overview.nextAction" as CreatorKey)}
                  hint={PROGRESS_HINT_KEY[currentStep] === undefined ? undefined : t(PROGRESS_HINT_KEY[currentStep]!)}
                >
                  <ActionBar>
                    <ActionButton tone="primary" onClick={() => { setTab(currentStepTab); }}>
                      {t("inspector.overview.openStep" as CreatorKey).replace("{step}", t(PROGRESS_KEY[currentStep]))}
                    </ActionButton>
                  </ActionBar>
                </Surface>
              </div>
            )}
            {actionError !== undefined && (
              <JobNote tone="error">{actionError}</JobNote>
            )}
            <Surface
              title={t("inspector.publish.statusTitle" as CreatorKey)}
              hint={t("inspector.publish.confirmHint" as CreatorKey)}
            >
              {platformSettingsPending
                ? <div className="empty">{t("inspector.publish.platformsLoading" as CreatorKey)}</div>
                : visiblePlatforms.length === 0
                  ? <div className="empty">{t("inspector.publish.enablePlatforms" as CreatorKey)}</div>
                  : (
                    <details
                      className="publishStatusDisclosure"
                      open={currentStep === "publish" || detail.workflow === "publish" || anyPublishMarked}
                    >
                      <summary>
                        <span>
                          <StatusPill tone={publication.completed ? "success" : "neutral"}>
                            {t((publication.completed
                              ? "inspector.publish.statusPublished"
                              : "inspector.publish.statusUnpublished") as CreatorKey)}
                          </StatusPill>
                          <strong>{publication.published}/{publication.total}</strong>
                        </span>
                        <em>{t("inspector.publish.manage" as CreatorKey)}</em>
                      </summary>
                      <p className="publishStatusRule">
                        {t("inspector.publish.distribution" as CreatorKey)
                          .replace("{published}", String(publication.published))
                          .replace("{total}", String(publication.total))}
                      </p>
                      <div className="publishGrid">
                        {visiblePlatforms.map((platform) => {
                          const row = detail.publish[platform.key];
                          const metrics = metricParts(row, t);
                          return (
                            <div key={platform.id} className="publishCard">
                              <div className="publishRow">
                                <span className="publishName">
                                  <PlatformMark id={platform.id} size={16} />
                                  {t(platform.label)}
                                </span>
                                <Menu
                                  portal={true}
                                  align="end"
                                  open={publishMenu === platform.key}
                                  anchor={(
                                    <StatusPill
                                      tone={PUBLISH_TONE[row.status]}
                                      disabled={publishPending === platform.key}
                                      aria-haspopup="menu"
                                      aria-label={`${t(platform.label)}：${t(PUBLISH_KEY[row.status])}`}
                                      onClick={() => {
                                        setPublishMenu(publishMenu === platform.key ? null : platform.key);
                                      }}
                                    >
                                      {t(PUBLISH_KEY[row.status])}
                                    </StatusPill>
                                  )}
                                  items={PUBLISH_MARKS.map((mark) => ({ id: mark, label: t(PUBLISH_KEY[mark]) }))}
                                  selectedId={row.status}
                                  onSelect={(id) => {
                                    if (isPublishMark(id)) applyPublish(platform.key, id);
                                  }}
                                  onClose={() => { setPublishMenu(null); }}
                                />
                              </div>
                              {metrics.length > 0 && (
                                <div className="publishMetrics">{metrics.join(" · ")}</div>
                              )}
                              {row.status === "published" && (
                                <label className="publishDate">
                                  <span>{t("inspector.publish.publishedAt")}</span>
                                  <input
                                    type="date"
                                    value={dateInputValue(row.publishedAt)}
                                    disabled={publishPending === platform.key}
                                    onChange={(event) => { applyPublishedAt(platform.key, event.target.value); }}
                                  />
                                </label>
                              )}
                              {row.status === "published" && row.url !== undefined && (
                                <a className="publishUrl" href={row.url} target="_blank" rel="noreferrer">
                                  {t("inspector.publish.open" as CreatorKey)}
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
            </Surface>
            {(currentStep === "publish" || detail.workflow === "publish" || anyPublishMarked || detail.hasArticle) && (
              <>
                <Surface
                  title={t("inspector.sync.title" as CreatorKey)}
                  hint={syncHint ?? t((platformSettingsPending
                    ? "inspector.publish.platformsLoading"
                    : "inspector.sync.hint") as CreatorKey)}
                >
                  {!platformSettingsPending && visiblePlatforms.length === 0 && (
                    <div className="empty">{t("inspector.publish.enablePlatforms" as CreatorKey)}</div>
                  )}
                  <ActionBar>
                    <ActionButton
                      tone="primary"
                      onClick={onSyncPublish}
                      disabled={isPublishSyncDisabled(busy, platformSettingsPending, enabledPlatforms ?? [])}
                    >
                      {t((busy === "sync" ? "inspector.publish.syncing" : "inspector.publish.sync") as CreatorKey)}
                    </ActionButton>
                  </ActionBar>
                </Surface>
                <Surface title={t("inspector.article" as CreatorKey)}>
                  <button
                    type="button"
                    className="publishRow articleRow"
                    onClick={() => { setTab("article"); }}
                  >
                    <span className="publishName">
                      <PlatformMark id="article" size={16} />
                      {t("inspector.article.draft" as CreatorKey)}
                    </span>
                    <StatusPill tone={detail.hasArticle ? "success" : "neutral"}>
                      {t((detail.hasArticle ? "inspector.article.ready" : "inspector.article.missing") as CreatorKey)}
                    </StatusPill>
                  </button>
                </Surface>
              </>
            )}
          </>
        )}
        {detail !== undefined && tab === "video" && (
          <div className="assetWorkspace">
            <Surface
              title={t("inspector.video.projectTitle" as CreatorKey)}
              hint={t("inspector.video.projectHint" as CreatorKey)}
            >
              <ActionBar>
                <ActionButton
                  tone="primary"
                  onClick={detail.studioPath === undefined ? onBindStudio : onOpenStudio}
                >
                  {t((detail.studioPath === undefined ? "inspector.studio.bind" : "inspector.studio.open") as CreatorKey)}
                </ActionButton>
                {detail.studioPath !== undefined && (
                  <ActionButton onClick={onBindStudio}>{t("inspector.studio.rebind" as CreatorKey)}</ActionButton>
                )}
                <ActionButton tone="secondary" onClick={onUseExternalEditor}>
                  {t("inspector.video.external" as CreatorKey)}
                </ActionButton>
              </ActionBar>
              {detail.waitingForExport && !hasVideo && (
                <div className="videoActionState">
                  <div>
                    <JobNote tone={detail.exportTimedOut === true ? "error" : "running"}>
                      {t((detail.exportTimedOut === true
                        ? "inspector.step.exportTimedOut"
                        : "inspector.step.waitingExport") as CreatorKey)}
                    </JobNote>
                    <p className="videoActionHint">
                      {t("inspector.step.waitingExportHint" as CreatorKey)}
                      <code>{detail.folderPath}</code>
                    </p>
                  </div>
                  <button type="button" onClick={() => { void openFolder(detail.folderPath); }}>
                    {t("inspector.video.openFolder" as CreatorKey)}
                  </button>
                </div>
              )}
              {actionError !== undefined && <JobNote tone="error">{actionError}</JobNote>}
            </Surface>
            <AssetShelf
              folderPath={detail.folderPath}
              openPath={openPath}
              t={t}
              entries={[
                {
                  label: t("inspector.video.raw" as CreatorKey),
                  ...(detail.videoRaw === undefined ? {} : { path: detail.videoRaw }),
                  expectedPath: `${detail.folderPath}/${detail.id}.mp4`,
                },
                {
                  label: t("inspector.video.subtitled" as CreatorKey),
                  ...(detail.videoSubtitled === undefined ? {} : { path: detail.videoSubtitled }),
                  expectedPath: `${detail.folderPath}/${detail.id}_subtitled.mp4`,
                },
              ]}
            />
            {!videoReady
              ? <div className="empty">{t("empty.loading" as CreatorKey)}</div>
              : videoSrc === undefined
                ? <div className="empty">{t("inspector.video.empty" as CreatorKey)}</div>
                : (
                  <video
                    className="videoPlayer"
                    controls={true}
                    playsInline={true}
                    preload="metadata"
                    src={videoSrc}
                  />
                )}
          </div>
        )}
        {detail !== undefined && tab === "script" && (
          <div className="scriptWorkspace">
            <ScriptOperationsBridge contentId={detail.id} cockpit={cockpit} t={t} />
            <AssetShelf
              folderPath={detail.folderPath}
              openPath={openPath}
              t={t}
              entries={[{
                label: t("inspector.script.asset" as CreatorKey),
                ...(detail.script.trim() === "" ? {} : { path: `${detail.folderPath}/script.md` }),
                expectedPath: `${detail.folderPath}/script.md`,
              }]}
            />
            <textarea
              className="scriptEditor"
              value={scriptDraft}
              placeholder={t("inspector.script.placeholder" as CreatorKey)}
              onChange={(event) => {
                setScriptDraft(event.target.value);
                setScriptSaved(event.target.value === detail.script);
              }}
            />
          </div>
        )}
        {detail !== undefined && tab === "presentation" && (
          <div className="assetWorkspace">
            <Surface
              title={t("inspector.presentation.title" as CreatorKey)}
              hint={t("inspector.presentation.hint" as CreatorKey)}
            >
              <ActionBar>
                <ActionButton
                  tone="primary"
                  disabled={detail.script.trim() === ""}
                  onClick={() => { onGeneratePresentation("16x9"); }}
                >
                  {t("inspector.presentation.generate16x9" as CreatorKey)}
                </ActionButton>
                <ActionButton
                  disabled={detail.script.trim() === ""}
                  onClick={() => { onGeneratePresentation("3x4"); }}
                >
                  {t("inspector.presentation.generate3x4" as CreatorKey)}
                </ActionButton>
                {!presentationHasAsset && (
                  <ActionButton tone="ghost" onClick={() => { onToggleSkip("presentation"); }}>
                    {t((contentStepIsSkipped(detail, "presentation")
                      ? "inspector.skip.restorePresentation"
                      : "inspector.skip.presentation") as CreatorKey)}
                  </ActionButton>
                )}
              </ActionBar>
            </Surface>
            <AssetShelf
              folderPath={detail.folderPath}
              openPath={openPath}
              t={t}
              entries={(["16x9", "3x4"] as const).map((aspect) => ({
                label: `${t("inspector.presentation.asset" as CreatorKey)} ${aspect}`,
                ...(detail.presentations[aspect] === undefined ? {} : { path: detail.presentations[aspect] }),
                expectedPath: `${detail.folderPath}/演示/${detail.id}-${aspect}.html`,
              }))}
            />
            {actionError !== undefined && <JobNote tone="error">{actionError}</JobNote>}
            {sessionHint !== undefined && <JobNote tone="done">{sessionHint}</JobNote>}
          </div>
        )}
        {detail !== undefined && tab === "cover" && (
          <div className="assetWorkspace">
            <Surface
              title={t("inspector.cover.jackyTitle" as CreatorKey)}
              hint={t("inspector.cover.jackyHint" as CreatorKey)}
            >
              <ActionBar>
                <ActionButton
                  tone={hasAnyCover ? "secondary" : "primary"}
                  onClick={onGenerateCover}
                  disabled={busy !== undefined || detail.coverJob.status === "running"}
                >
                  {t((busy === "cover" || detail.coverJob.status === "running"
                    ? "inspector.cover.generating"
                    : hasAnyCover
                      ? "inspector.cover.regenerate"
                      : "inspector.cover.generate") as CreatorKey)}
                </ActionButton>
              </ActionBar>
              <div className="coverActionState" role="status">
                {actionError !== undefined
                  ? <JobNote tone="error">{actionError}</JobNote>
                  : detail.coverJob.status === "running" || busy === "cover"
                    ? <JobNote tone="running">{t("inspector.cover.generating" as CreatorKey)}</JobNote>
                    : detail.coverJob.status === "error"
                      ? <JobNote tone="error">{detail.coverJob.error ?? t("inspector.cover.failed" as CreatorKey)}</JobNote>
                      : hasAnyCover
                        ? <JobNote tone="done">{t("inspector.cover.ready" as CreatorKey)}</JobNote>
                        : !hasVideo
                          ? <JobNote>{t("inspector.cover.needVideo" as CreatorKey)}</JobNote>
                          : !detail.secrets.cover.configured
                            ? <JobNote>{t("inspector.cover.needKey" as CreatorKey)}</JobNote>
                            : null}
              </div>
            </Surface>
            <div className="coverGallery">
              {(["3x4", "4x3", "16x9"] as const).map((aspect) => (
                <div className="coverAsset" key={aspect}>
                  <button
                    type="button"
                    className={`coverAssetImage ratio-${aspect}`}
                    disabled={detail.covers[aspect] === undefined}
                    aria-label={t("inspector.cover.preview" as CreatorKey).replace("{aspect}", aspect)}
                    onClick={() => { setCoverPreview(aspect); }}
                  >
                    <CoverThumb
                      id={`${detail.id}::${aspect}`}
                      load={getCoverThumb}
                      {...(detail.covers[aspect] === undefined ? {} : { revision: detail.covers[aspect] })}
                      fallback={<span>{aspect}</span>}
                    />
                  </button>
                  <span>{aspect}</span>
                </div>
              ))}
            </div>
            <AssetShelf
              folderPath={detail.folderPath}
              openPath={openPath}
              t={t}
              entries={(["3x4", "4x3", "16x9"] as const).map((aspect) => ({
                label: `${t("inspector.cover.asset" as CreatorKey)} ${aspect}`,
                ...(detail.covers[aspect] === undefined ? {} : { path: detail.covers[aspect] }),
                expectedPath: `${detail.folderPath}/${detail.id}_${aspect}.png`,
                onReveal: () => { setCoverPreview(aspect); },
              }))}
            />
          </div>
        )}
        {detail !== undefined && tab === "article" && (
          <div className="assetWorkspace">
            <Surface
              title={t("inspector.article.generateTitle" as CreatorKey)}
              hint={t("inspector.article.generateHint" as CreatorKey)}
            >
              <ActionBar>
                <ActionButton
                  tone={detail.article.trim() === "" ? "primary" : "secondary"}
                  disabled={detail.script.trim() === ""}
                  onClick={onGenerateArticle}
                >
                  {t((detail.article.trim() === ""
                    ? "inspector.article.generate"
                    : "inspector.article.regenerate") as CreatorKey)}
                </ActionButton>
                {detail.articlePath !== undefined && (
                  <ActionButton onClick={() => { void openPath(detail.articlePath!); }}>
                    {t("inspector.article.openMarkdown" as CreatorKey)}
                  </ActionButton>
                )}
                {!articleHasAsset && (
                  <ActionButton tone="ghost" onClick={() => { onToggleSkip("article"); }}>
                    {t((contentStepIsSkipped(detail, "article")
                      ? "inspector.skip.restoreArticle"
                      : "inspector.skip.article") as CreatorKey)}
                  </ActionButton>
                )}
              </ActionBar>
            </Surface>
            <AssetShelf
              folderPath={detail.folderPath}
              openPath={openPath}
              t={t}
              entries={[{
                label: t("inspector.article.asset" as CreatorKey),
                ...(detail.articlePath === undefined ? {} : { path: detail.articlePath }),
                expectedPath: `${detail.folderPath}/公众号文章/${detail.id}.md`,
              }]}
            />
            {actionError !== undefined && <JobNote tone="error">{actionError}</JobNote>}
            {sessionHint !== undefined && <JobNote tone="done">{sessionHint}</JobNote>}
            {detail.article.trim() === ""
              ? <div className="empty">{t("inspector.article.empty" as CreatorKey)}</div>
              : (
                <div className="article">
                  <MarkdownText
                    text={articleOrigin === undefined
                      ? detail.article
                      : rewriteArticleImages(detail.article, articleOrigin)}
                  />
                </div>
              )}
          </div>
        )}
        {detail !== undefined && tab === "subtitle" && (
          <div className="assetWorkspace">
            {hasVideo && (
              <ActionBar>
                {canPreviewSubtitle && (
                  <ActionButton tone="ghost" onClick={onPreviewSubtitle}>
                    {t("inspector.subtitle.previewEdit" as CreatorKey)}
                  </ActionButton>
                )}
                <ActionButton
                  tone={!hasSubtitleDraft && detail.videoSubtitled === undefined ? "primary" : "secondary"}
                  onClick={onGenerateSubtitle}
                  disabled={
                    busy !== undefined
                    || detail.subtitleJob.status === "running"
                    || detail.burn.status === "running"
                  }
                >
                  {t((
                    !hasSubtitleDraft
                      ? "inspector.subtitle.generate"
                      : "inspector.subtitle.regenerate"
                  ) as CreatorKey)}
                </ActionButton>
                {hasSubtitleDraft && (
                  <ActionButton
                    tone={detail.videoSubtitled === undefined ? "primary" : "secondary"}
                    onClick={onBurnSubtitle}
                    disabled={
                      busy !== undefined
                      || detail.subtitleJob.status === "running"
                      || detail.burn.status === "running"
                    }
                  >
                    {t((detail.videoSubtitled === undefined
                      ? "inspector.subtitle.burn"
                      : "inspector.subtitle.reburn") as CreatorKey)}
                  </ActionButton>
                )}
                {!subtitleHasAsset && (
                  <ActionButton tone="ghost" onClick={() => { onToggleSkip("subtitle"); }}>
                    {t((contentStepIsSkipped(detail, "subtitle")
                      ? "inspector.skip.restoreSubtitle"
                      : "inspector.skip.subtitle") as CreatorKey)}
                  </ActionButton>
                )}
              </ActionBar>
            )}
            {!hasVideo && (
              <ActionBar>
                {!subtitleHasAsset && (
                  <ActionButton tone="ghost" onClick={() => { onToggleSkip("subtitle"); }}>
                    {t((contentStepIsSkipped(detail, "subtitle")
                      ? "inspector.skip.restoreSubtitle"
                      : "inspector.skip.subtitle") as CreatorKey)}
                  </ActionButton>
                )}
              </ActionBar>
            )}
            {actionError !== undefined
              ? <JobNote tone="error">{actionError}</JobNote>
              : detail.subtitleJob.status === "running" || detail.burn.status === "running"
                ? (
                  <JobNote tone="running">
                    {t((detail.subtitleJob.status === "running"
                      ? "inspector.subtitle.generating"
                      : "inspector.subtitle.burning") as CreatorKey)}
                  </JobNote>
                )
                : detail.subtitleJob.status === "error" || detail.burn.status === "error"
                  ? (
                    <JobNote tone="error">
                      {(detail.subtitleJob.error ?? detail.burn.error ?? "").includes("process exited")
                        ? t("inspector.subtitle.burnFailed" as CreatorKey)
                        : detail.subtitleJob.error
                          ?? detail.burn.error
                          ?? t("inspector.subtitle.burnFailed" as CreatorKey)}
                    </JobNote>
                  )
                  : null}
            <AssetShelf
              folderPath={detail.folderPath}
              openPath={openPath}
              t={t}
              entries={[
                {
                  label: t("inspector.subtitle.srtAsset" as CreatorKey),
                  ...(detail.subtitles.srt === undefined ? {} : { path: detail.subtitles.srt }),
                  expectedPath: `${detail.folderPath}/${detail.id}.srt`,
                },
                {
                  label: t("inspector.subtitle.assAsset" as CreatorKey),
                  ...(detail.subtitles.ass === undefined ? {} : { path: detail.subtitles.ass }),
                  expectedPath: `${detail.folderPath}/${detail.id}.ass`,
                },
                {
                  label: t("inspector.subtitle.transcriptAsset" as CreatorKey),
                  ...(detail.subtitles.transcript === undefined ? {} : { path: detail.subtitles.transcript }),
                  expectedPath: `${detail.folderPath}/${detail.id}.subtitle-work/subtitle-transcript.json`,
                },
                {
                  label: t("inspector.video.subtitled" as CreatorKey),
                  ...(detail.videoSubtitled === undefined ? {} : { path: detail.videoSubtitled }),
                  expectedPath: `${detail.folderPath}/${detail.id}_subtitled.mp4`,
                },
              ]}
            />
            {cues.length === 0
              ? <div className="empty">{t("inspector.subtitle.empty" as CreatorKey)}</div>
              : (
                <ol className="cues">
                  {cues.map((cue, index) => (
                    <li key={`${cue.at ?? "cue"}-${index}`} className="cue">
                      {cue.at !== undefined && <div className="cueTime">{cue.at}</div>}
                      <p className="cueText">{cue.text}</p>
                    </li>
                  ))}
                </ol>
              )}
          </div>
        )}
      </div>
      {detail !== undefined && coverPreview !== undefined && (
        <div
          className="coverPreviewBackdrop"
          onPointerDown={(event) => {
            if (event.currentTarget === event.target) setCoverPreview(undefined);
          }}
        >
          <section
            className={`coverPreviewDialog ratio-${coverPreview}`}
            role="dialog"
            aria-modal="true"
            aria-label={t("inspector.cover.previewTitle" as CreatorKey)}
          >
            <header>
              <div>
                <span className="eyebrow">PREVIEW</span>
                <strong>{t("inspector.cover.previewTitle" as CreatorKey)} · {coverPreview}</strong>
              </div>
              <button
                type="button"
                aria-label={t("inspector.cover.previewClose" as CreatorKey)}
                onClick={() => { setCoverPreview(undefined); }}
              >
                <IconCloseOutline16 size={16} />
              </button>
            </header>
            <div className="coverPreviewCanvas">
              <CoverThumb
                id={`${detail.id}::${coverPreview}`}
                load={getCoverThumb}
                {...(detail.covers[coverPreview] === undefined ? {} : { revision: detail.covers[coverPreview] })}
                fallback={<span>{t("inspector.cover.previewMissing" as CreatorKey)}</span>}
              />
            </div>
            <div className="coverPreviewRatios" aria-label={t("inspector.cover.previewRatios" as CreatorKey)}>
              {(["3x4", "4x3", "16x9"] as const).map((aspect) => (
                <button
                  key={aspect}
                  type="button"
                  className={coverPreview === aspect ? "active" : ""}
                  disabled={detail.covers[aspect] === undefined}
                  onClick={() => { setCoverPreview(aspect); }}
                >
                  {aspect}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      <div
        className="resize"
        onPointerDown={(event) => {
          event.preventDefault();
          drag.current = { startX: event.clientX, startWidth: panelWidth };
          setDragging(true);
        }}
      />
    </div>
  );
}
