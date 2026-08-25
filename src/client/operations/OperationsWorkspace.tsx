import { useEffect, useRef, useState } from "react";
import { IconRefreshOutline16, IconRightUpOutline14 } from "@deepseek-ai/dsh-client-ui-primitives";

import type { CockpitState } from "../../cockpit/schemas.ts";
import type { ContentSummary, PipelineStage, PublishMark } from "../../types.ts";
import {
  useLibraryEpoch,
  useOperationsSection,
  type OperationsSection,
} from "../contentSelection.ts";
import type { CreatorViewFace } from "../face.ts";
import type { CreatorKey } from "../locales.ts";
import { formatRelativeTime } from "../relativeTime.ts";
import { StatusPill, type StatusTone } from "../ui/StatusPill.tsx";
import { ContentOperationsPage } from "./ContentOperationsPage.tsx";
import type { CreatorCockpitFace } from "./face.ts";
import { GoalsPage } from "./GoalsPage.tsx";
import { IdeasPage } from "./IdeasPage.tsx";
import { ReviewsPage } from "./ReviewsPage.tsx";
import { SchedulePage } from "./SchedulePage.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { TodayPage } from "./TodayPage.tsx";
import { useOperationsTheme } from "./operationsTheme.ts";
import "./OperationsWorkspace.css";
import "./CreatorCockpitV3.css";

const SECTION_TITLE: Record<OperationsSection, CreatorKey> = {
  today: "operations.nav.today",
  ideas: "operations.nav.ideas",
  schedule: "operations.nav.schedule",
  content: "operations.nav.content",
  goals: "operations.nav.goals",
  reviews: "operations.nav.reviews",
  settings: "operations.nav.settings",
};

const SECTION_HERO: Record<OperationsSection, {
  eyebrow: CreatorKey;
  title: CreatorKey;
  description: CreatorKey;
}> = {
  today: {
    eyebrow: "operations.hero.today.eyebrow",
    title: "operations.hero.today.title",
    description: "operations.hero.today.description",
  },
  ideas: {
    eyebrow: "operations.hero.ideas.eyebrow",
    title: "operations.hero.ideas.title",
    description: "operations.hero.ideas.description",
  },
  schedule: {
    eyebrow: "operations.hero.schedule.eyebrow",
    title: "operations.hero.schedule.title",
    description: "operations.hero.schedule.description",
  },
  content: {
    eyebrow: "operations.hero.content.eyebrow",
    title: "operations.hero.content.title",
    description: "operations.hero.content.description",
  },
  goals: {
    eyebrow: "operations.hero.goals.eyebrow",
    title: "operations.hero.goals.title",
    description: "operations.hero.goals.description",
  },
  reviews: {
    eyebrow: "operations.hero.reviews.eyebrow",
    title: "operations.hero.reviews.title",
    description: "operations.hero.reviews.description",
  },
  settings: {
    eyebrow: "operations.hero.settings.eyebrow",
    title: "operations.hero.settings.title",
    description: "operations.hero.settings.description",
  },
};

const PIPELINE_KEY: Record<PipelineStage, CreatorKey> = {
  raw: "operations.pipeline.raw",
  subtitled: "operations.pipeline.subtitled",
  covered: "operations.pipeline.covered",
  packaged: "operations.pipeline.packaged",
};

const PIPELINE_TONE: Record<PipelineStage, StatusTone> = {
  raw: "neutral",
  subtitled: "pending",
  covered: "pending",
  packaged: "success",
};

function latestFirst(items: ContentSummary[]): ContentSummary[] {
  return [...items].sort((a, b) => b.recordedAt - a.recordedAt || b.createdMs - a.createdMs);
}

function publishMark(item: ContentSummary): PublishMark {
  const statuses = Object.values(item.publish).map((entry) => entry.status);
  if (statuses.includes("published")) return "published";
  if (statuses.includes("draft")) return "draft";
  return "unpublished";
}

function publishLabel(mark: PublishMark): CreatorKey {
  if (mark === "published") return "inspector.publish.published";
  if (mark === "draft") return "inspector.publish.draft";
  return "inspector.publish.unpublished";
}

function publishTone(mark: PublishMark): StatusTone {
  if (mark === "published") return "success";
  if (mark === "draft") return "pending";
  return "neutral";
}

export interface OperationsWorkspaceProps extends CreatorViewFace, CreatorCockpitFace {
  t: (key: CreatorKey) => string;
  openContent: (id: string) => void;
}

export function OperationsWorkspace({
  t,
  ready,
  listContents,
  getContent,
  createContent,
  openContent,
  cockpitReady,
  getCockpitState,
  getCockpitRevision,
  ...cockpitFace
}: OperationsWorkspaceProps) {
  const section = useOperationsSection();
  const operationsTheme = useOperationsTheme();
  const libraryEpoch = useLibraryEpoch();
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [cockpitState, setCockpitState] = useState<CockpitState | undefined>(undefined);
  const [cockpitError, setCockpitError] = useState<string | undefined>(undefined);
  const [cockpitLoading, setCockpitLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [section]);

  useEffect(() => {
    let live = true;
    const load = async (): Promise<void> => {
      if (!ready()) {
        if (live) {
          setError(t("empty.remote"));
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setError(undefined);
      try {
        const result = await listContents("", "all");
        if (live) setItems(latestFirst(result.items));
      } catch (cause) {
        if (live) setError(cause instanceof Error ? cause.message : t("empty.error"));
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    return () => { live = false; };
  }, [libraryEpoch, refreshNonce]);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async (): Promise<void> => {
      if (!cockpitReady()) {
        if (live) {
          setCockpitError(t("operations.state.unavailable"));
          setCockpitLoading(false);
        }
        return;
      }
      try {
        const next = await getCockpitState();
        if (live) {
          setCockpitState(next);
          setCockpitError(undefined);
        }
      } catch (cause) {
        if (live) setCockpitError(cause instanceof Error ? cause.message : t("empty.error"));
      } finally {
        if (live) setCockpitLoading(false);
      }
    };
    void load();
    timer = setInterval(() => {
      if (!live || !cockpitReady()) return;
      void getCockpitRevision().then((revision) => {
        if (live && cockpitState !== undefined && revision !== cockpitState.revision) void load();
      }).catch(() => {});
    }, 2_000);
    return () => {
      live = false;
      if (timer !== undefined) clearInterval(timer);
    };
  }, [refreshNonce, cockpitState?.revision]);

  const commit = async (operation: Promise<CockpitState>): Promise<void> => {
    setCockpitError(undefined);
    try {
      setCockpitState(await operation);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("operations.state.writeFailed");
      setCockpitError(message);
      throw cause;
    }
  };

  const published = items.filter((item) => publishMark(item) === "published").length;
  const inProduction = items.filter((item) => item.workflow !== "idle" && item.workflow !== "live").length;
  const readyToPublish = items.filter((item) => item.workflow === "publish").length;
  const visibleItems = items.slice(0, 8);
  const hero = SECTION_HERO[section];
  const showsToday = section === "today";
  const isStatePage = section !== "today";
  const needsContentFacts = section === "schedule" || section === "content" || section === "goals" || section === "reviews";
  const fullCockpitFace: CreatorCockpitFace = {
    cockpitReady,
    getCockpitState,
    getCockpitRevision,
    ...cockpitFace,
  };

  return (
    <main
      data-plugin="dsh-oil-creator"
      data-surface="operations-workspace"
      data-cockpit-theme={operationsTheme}
    >
      <header className="operationsWorkspaceHeader">
        <div className="operationsWorkspaceTitle">
          <div className="operationsWorkspaceKicker">{t(hero.eyebrow)}</div>
          <h1>{t(SECTION_TITLE[section])}</h1>
        </div>
        <p>{t(hero.description)}</p>
        {(
          <button
            type="button"
            className="operationsRefresh"
            aria-label={t("toolbar.refresh")}
            disabled={loading || cockpitLoading}
            onClick={() => { setRefreshNonce((value) => value + 1); }}
          >
            <IconRefreshOutline16 size={16} />
            <span>{t("toolbar.refresh")}</span>
          </button>
        )}
      </header>

      <div ref={bodyRef} className="operationsWorkspaceBody">
        {cockpitError !== undefined && <div className="operationsState error">{cockpitError}</div>}
        {showsToday ? (
          <>
            <section className="operationsSummary" aria-label={t("operations.summary.label")}> 
              <div><span>{t("operations.summary.total")}</span><strong>{items.length}</strong></div>
              <div><span>{t("operations.summary.production")}</span><strong>{inProduction}</strong></div>
              <div><span>{t("operations.summary.publish")}</span><strong>{readyToPublish}</strong></div>
              <div><span>{t("operations.summary.live")}</span><strong>{published}</strong></div>
            </section>

            {cockpitState !== undefined && <TodayPage state={cockpitState} items={items} face={fullCockpitFace} t={t} commit={commit} openContent={openContent} />}

            <section className="operationsQueue">
              <div className="operationsSectionHeading">
                <div>
                  <h2>{t("operations.queue.recent")}</h2>
                  <p>{t("operations.queue.hint")}</p>
                </div>
                <span>{visibleItems.length} / {items.length}</span>
              </div>

              {loading && items.length === 0 && <div className="operationsState">{t("empty.loading")}</div>}
              {error !== undefined && <div className="operationsState error">{error}</div>}
              {!loading && error === undefined && items.length === 0 && (
                <div className="operationsState">{t("empty.library")}</div>
              )}
              {error === undefined && visibleItems.map((item) => {
                const mark = publishMark(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="operationsContentRow"
                    onClick={() => { openContent(item.id); }}
                  >
                    <span className="operationsContentMain">
                      <strong>{item.title}</strong>
                      <span>{formatRelativeTime(item.recordedAt, Date.now(), t)}</span>
                    </span>
                    <span className="operationsContentFacts">
                      <span>
                        <small>{t("operations.fact.workflow")}</small>
                        <StatusPill tone={item.workflow === "live" ? "success" : item.workflow === "idle" ? "neutral" : "pending"}>
                          {t(`inspector.stage.${item.workflow}` as CreatorKey)}
                        </StatusPill>
                      </span>
                      <span>
                        <small>{t("operations.fact.pipeline")}</small>
                        <StatusPill tone={PIPELINE_TONE[item.pipeline]}>{t(PIPELINE_KEY[item.pipeline])}</StatusPill>
                      </span>
                      <span>
                        <small>{t("operations.fact.publish")}</small>
                        <StatusPill tone={publishTone(mark)}>{t(publishLabel(mark))}</StatusPill>
                      </span>
                    </span>
                    <span className="operationsOpenLabel">
                      {t("operations.openContent")}
                      <IconRightUpOutline14 size={14} />
                    </span>
                  </button>
                );
              })}
            </section>
          </>
        ) : cockpitLoading && cockpitState === undefined && isStatePage ? (
          <div className="operationsState">{t("empty.loading")}</div>
        ) : needsContentFacts && loading && items.length === 0 ? (
          <div className="operationsState">{t("empty.loading")}</div>
        ) : needsContentFacts && error !== undefined && items.length === 0 ? (
          <div className="operationsState error">{error}</div>
        ) : cockpitState !== undefined && section === "ideas" ? (
          <IdeasPage state={cockpitState} face={fullCockpitFace} t={t} commit={commit} openContent={openContent} />
        ) : cockpitState !== undefined && section === "schedule" ? (
          <SchedulePage state={cockpitState} items={items} face={fullCockpitFace} t={t} commit={commit} openContent={openContent} />
        ) : cockpitState !== undefined && section === "content" ? (
          <ContentOperationsPage state={cockpitState} items={items} face={fullCockpitFace} t={t} commit={commit} openContent={openContent} getContent={getContent} createContent={createContent} />
        ) : cockpitState !== undefined && section === "goals" ? (
          <GoalsPage state={cockpitState} items={items} face={fullCockpitFace} t={t} commit={commit} />
        ) : cockpitState !== undefined && section === "reviews" ? (
          <ReviewsPage state={cockpitState} items={items} face={fullCockpitFace} t={t} commit={commit} openContent={openContent} />
        ) : cockpitState !== undefined && section === "settings" ? (
          <SettingsPage state={cockpitState} face={fullCockpitFace} t={t} commit={commit} />
        ) : cockpitState === undefined && cockpitError !== undefined ? null : (
          <section className="operationsFutureState">
            <span>v0.1</span>
            <h2>{t("operations.empty.title")}</h2>
            <p>{t("operations.empty.description")}</p>
          </section>
        )}
      </div>
    </main>
  );
}
