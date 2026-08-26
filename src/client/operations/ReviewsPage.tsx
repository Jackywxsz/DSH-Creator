import { useState } from "react";

import type { CockpitState, ContentOperationsMeta } from "../../cockpit/schemas.ts";
import type { ContentSummary } from "../../types.ts";
import type { CreatorKey } from "../locales.ts";
import { addDays, dayEnd, inputDate } from "./date.ts";
import type { CreatorCockpitFace } from "./face.ts";
import { publishedAtOf, publishedMetricValue } from "./metrics.ts";
import { sendCockpitInstruction } from "./sessionBridge.tsx";
import "./OperationsForms.css";

function MetricsEditor({ item, meta, face, t, commit }: {
  item: ContentSummary;
  meta?: ContentOperationsMeta;
  face: CreatorCockpitFace;
  t: (key: CreatorKey) => string;
  commit: (operation: Promise<CockpitState>) => Promise<void>;
}) {
  const current = meta?.supplementalMetrics;
  const [saves, setSaves] = useState(current?.saves?.toString() ?? "");
  const [followerGain, setFollowerGain] = useState(current?.followerGain?.toString() ?? "");
  const [clickRate, setClickRate] = useState(current?.clickRate?.toString() ?? "");
  const [retentionRate, setRetentionRate] = useState(current?.retentionRate?.toString() ?? "");
  const [note, setNote] = useState(current?.note ?? "");
  const number = (value: string): number | undefined => value === "" ? undefined : Number(value);
  return <details className="operationsMetricsEditor"><summary>{t("operations.reviews.metrics")}</summary><div>
    <label><span>{t("operations.metric.saves")}</span><input type="number" min="0" value={saves} onChange={(event) => { setSaves(event.target.value); }} /></label>
    <label><span>{t("operations.metric.followerGain")}</span><input type="number" value={followerGain} onChange={(event) => { setFollowerGain(event.target.value); }} /></label>
    <label><span>{t("operations.metric.clickRate")}</span><input type="number" min="0" max="100" step="0.1" value={clickRate} onChange={(event) => { setClickRate(event.target.value); }} /></label>
    <label><span>{t("operations.metric.retentionRate")}</span><input type="number" min="0" max="100" step="0.1" value={retentionRate} onChange={(event) => { setRetentionRate(event.target.value); }} /></label>
    <label className="full"><span>{t("operations.metric.note")}</span><textarea value={note} onChange={(event) => { setNote(event.target.value); }} /></label>
    <button type="button" onClick={() => { void commit(face.setContentMeta({ contentId: item.id, patch: { supplementalMetrics: { saves: number(saves), followerGain: number(followerGain), clickRate: number(clickRate), retentionRate: number(retentionRate), ...(note.trim() === "" ? {} : { note }) } } })); }}>{t("settings.save")}</button>
  </div></details>;
}

export function ReviewsPage({ state, items, face, t, commit, openContent }: {
  state: CockpitState;
  items: ContentSummary[];
  face: CreatorCockpitFace;
  t: (key: CreatorKey) => string;
  commit: (operation: Promise<CockpitState>) => Promise<void>;
  openContent: (id: string) => void;
}) {
  const published = items.filter((item) => Object.values(item.publish).some((entry) => entry.status === "published"));
  const confirmedReview = (item: ContentSummary) => state.contentMeta[item.id]?.reviews.filter((review) => review.status === "confirmed").at(-1);
  const pending = published.filter((item) => confirmedReview(item) === undefined);
  const reviewed = published.filter((item) => confirmedReview(item) !== undefined);
  const overdue = pending.filter((item) => { const at = publishedAtOf(item); return at !== undefined && dayEnd(addDays(at, state.settings.reviewDelayDays)) < Date.now(); });
  const rated = reviewed.map((item) => confirmedReview(item)?.rating).filter((value): value is number => value !== undefined);
  const average = rated.length === 0 ? undefined : rated.reduce((sum, value) => sum + value, 0) / rated.length;

  const saveKnowledge = (item: ContentSummary, review: NonNullable<ContentOperationsMeta["reviews"][number]>, kind: "rule" | "template", body: string): void => {
    if (!window.confirm(kind === "rule" ? t("operations.reviews.rulePrompt") : t("operations.reviews.templatePrompt"))) return;
    const operation = kind === "rule"
      ? face.saveRule({ contentId: item.id, reviewId: review.id, title: `${item.title} 经验规则`, body, tags: state.contentMeta[item.id]?.tags ?? [] })
      : face.saveTemplate({ contentId: item.id, reviewId: review.id, title: `${item.title} 结构模板`, body, tags: state.contentMeta[item.id]?.tags ?? [] });
    void operation.then((result) => commit(Promise.resolve(result.state))).catch((cause: unknown) => { window.alert(cause instanceof Error ? cause.message : t("operations.state.writeFailed")); });
  };

  const ReviewCard = ({ item, completed }: { item: ContentSummary; completed: boolean }) => {
    const meta = state.contentMeta[item.id];
    const latest = meta?.reviews.at(-1);
    const confirmed = confirmedReview(item);
    const at = publishedAtOf(item);
    const due = at === undefined ? undefined : addDays(at, state.settings.reviewDelayDays);
    const isOverdue = !completed && due !== undefined && dayEnd(due) < Date.now();
    const visibleMetrics = (["views", "likes", "comments"] as const).map((key) => ({ key, value: publishedMetricValue(item, key) }));
    return <article className={`operationsReviewCard${isOverdue ? " overdue" : ""}`}>
      <header><button type="button" className="reviewTitle" onClick={() => { openContent(item.id); }}><strong>{item.title}</strong><span>{at === undefined ? t("operations.reviews.dateUnknown") : `发布于 ${inputDate(at)} · ${completed ? "已复盘" : isOverdue ? `已到 T+${state.settings.reviewDelayDays}` : `T+${state.settings.reviewDelayDays} 待复盘`}`}</span></button><button type="button" onClick={() => { const sent = sendCockpitInstruction(`请为 Jacky 运营看板中 contentId=${item.id} 的《${item.title}》生成发布后复盘草稿。先调用 cockpit_get_review_context 读取真实内容、发布数据、补充指标和最新评分，再分析有效做法、问题、下一步实验，并调用 cockpit_save_review_draft 保存为草稿。不得替用户确认复盘，也不得直接沉淀规则或模板。`); if (!sent) window.alert(t("operations.ai.noSession")); }}>{latest === undefined ? t("operations.reviews.ai") : t("operations.reviews.aiAgain")}</button></header>
      <div className="operationsPublishedMetrics">{visibleMetrics.map(({ key, value }) => <span key={key}><small>{t(`operations.metric.${key}` as CreatorKey)}</small><strong>{value === undefined ? t("operations.notRecorded") : value.toLocaleString()}</strong></span>)}<span><small>{t("operations.metric.saves")}</small><strong>{meta?.supplementalMetrics?.saves?.toLocaleString() ?? t("operations.notRecorded")}</strong></span></div>
      <MetricsEditor item={item} {...(meta === undefined ? {} : { meta })} face={face} t={t} commit={commit} />
      {latest !== undefined && <section className="operationsReviewDraft"><div><span>{latest.status === "draft" ? t("operations.reviews.draft") : t("operations.reviews.confirmed")}{latest.rating === undefined ? "" : ` · ${latest.rating}/5`}</span><p>{latest.analysis}</p>{latest.learnedRule && <blockquote>{latest.learnedRule}</blockquote>}</div>{latest.status === "draft" ? <button type="button" onClick={() => { if (window.confirm(t("operations.reviews.confirmPrompt"))) void commit(face.confirmReview(item.id, latest.id)); }}>{t("operations.reviews.confirm")}</button> : <div className="operationsKnowledgeActions">{latest.learnedRule && <button type="button" onClick={() => { saveKnowledge(item, latest, "rule", latest.learnedRule ?? ""); }}>{t("operations.reviews.saveRule")}</button>}<button type="button" onClick={() => { saveKnowledge(item, latest, "template", latest.analysis); }}>{t("operations.reviews.saveTemplate")}</button></div>}</section>}
      {completed && confirmed !== undefined && latest?.id !== confirmed.id && <small>最近一次人工确认：{inputDate(confirmed.confirmedAt ?? confirmed.createdAt)}</small>}
    </article>;
  };

  return <section className="reviewCockpit">
    <div className="reviewKpis">
      <article><span>发布样本</span><strong>{published.length}</strong><small>全部已发布内容</small></article>
      <article className={overdue.length > 0 ? "risk" : ""}><span>待复盘</span><strong>{pending.length}</strong><small>{overdue.length > 0 ? `${overdue.length} 条已到 T+${state.settings.reviewDelayDays}` : "当前没有逾期复盘"}</small></article>
      <article><span>已复盘</span><strong>{reviewed.length}</strong><small>人工确认后计入</small></article>
      <article><span>完成率</span><strong>{published.length === 0 ? "0%" : `${Math.round(reviewed.length / published.length * 100)}%`}</strong><small>{reviewed.length} / {published.length}</small></article>
      <article><span>平均星级</span><strong>{average === undefined ? "-" : average.toFixed(1)}<em>/5</em></strong><small>只统计已确认评分</small></article>
    </div>

    <div className="reviewLedgers">
      <section><header><div><span>TO REVIEW</span><h2>待复盘</h2><p>AI 草稿仍属于待复盘，人工确认后才会离开这里。</p></div><strong>{pending.length}</strong></header>{pending.length === 0 ? <div className="operationsInlineEmpty">{t("operations.today.none")}</div> : pending.map((item) => <ReviewCard key={item.id} item={item} completed={false} />)}</section>
      <section><header><div><span>REVIEWED</span><h2>已复盘</h2><p>已完成定型，可继续沉淀为规则或模板。</p></div><strong>{reviewed.length}</strong></header>{reviewed.length === 0 ? <div className="operationsInlineEmpty">{t("operations.today.none")}</div> : reviewed.map((item) => <ReviewCard key={item.id} item={item} completed />)}</section>
    </div>

    <section className="operationsKnowledgeLibrary">
      <div className="operationsSectionHeading"><div><h2>{t("operations.knowledge.title")}</h2><p>{t("operations.knowledge.hint")}</p></div><span>{state.knowledgeItems.filter((entry) => entry.active).length} / {state.knowledgeItems.length}</span></div>
      {state.knowledgeItems.length === 0 ? <div className="operationsInlineEmpty">{t("operations.knowledge.empty")}</div> : <div className="operationsKnowledgeGrid">{state.knowledgeItems.map((entry, index) => <article key={entry.id} className={entry.active ? "active" : ""}><header><span>{String(index + 1).padStart(2, "0")}</span><em>{entry.kind === "rule" ? t("operations.knowledge.rule") : t("operations.knowledge.template")}</em></header><strong>{entry.title}</strong><p>{entry.body}</p><div>{entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div><button type="button" onClick={() => { void commit(face.updateKnowledge({ id: entry.id, patch: { active: !entry.active } })); }}>{entry.active ? t("operations.knowledge.disable") : t("operations.knowledge.enable")}</button></article>)}</div>}
    </section>
  </section>;
}
