import { useState } from "react";

import type { CockpitState, ScheduleItem } from "../../cockpit/schemas.ts";
import type { ContentSummary } from "../../types.ts";
import { setOperationsSection } from "../contentSelection.ts";
import type { CreatorKey } from "../locales.ts";
import { addDays, dayEnd, dayStart, inputDate, noon, shortDate, weekStart } from "./date.ts";
import type { CreatorCockpitFace } from "./face.ts";
import { goalMetricValue, publishedAtOf } from "./metrics.ts";
import "./OperationsForms.css";

export function TodayPage({ state, items, face, t, commit, openContent }: {
  state: CockpitState;
  items: ContentSummary[];
  face: CreatorCockpitFace;
  t: (key: CreatorKey) => string;
  commit: (operation: Promise<CockpitState>) => Promise<void>;
  openContent: (id: string) => void;
}) {
  const [range, setRange] = useState<"today" | "week">("today");
  const now = Date.now();
  const todayStart = dayStart(now);
  const todayEnd = dayEnd(now);
  const rangeStart = range === "today" ? todayStart : weekStart(now);
  const rangeEnd = range === "today" ? todayEnd : dayEnd(addDays(rangeStart, 6));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const scheduled = [...state.scheduleItems].sort((a, b) => a.plannedAt - b.plannedAt || a.rank - b.rank);
  const due = scheduled.filter((entry) => entry.plannedAt >= rangeStart && entry.plannedAt <= rangeEnd);
  const overdue = scheduled.filter((entry) => entry.completedAt === undefined && entry.plannedAt < todayStart);
  const waiting = items.filter((item) => {
    const published = publishedAtOf(item);
    const reviewed = state.contentMeta[item.id]?.reviews.some((review) => review.status === "confirmed") ?? false;
    return published !== undefined && dayEnd(addDays(published, state.settings.reviewDelayDays)) < now && !reviewed;
  });
  const activeGoals = state.goals.filter((goal) => goal.archivedAt === undefined && goal.startAt <= now && goal.endAt >= now);
  const recentIdeas = [...state.ideas].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  const updateRank = (entry: ScheduleItem, direction: -1 | 1): void => {
    const sameDate = scheduled.filter((item) => dayStart(item.plannedAt) === dayStart(entry.plannedAt));
    const index = sameDate.findIndex((item) => item.id === entry.id);
    const other = sameDate[index + direction];
    if (other === undefined) return;
    void Promise.all([
      face.updateScheduleItem({ id: entry.id, patch: { rank: other.rank } }),
      face.updateScheduleItem({ id: other.id, patch: { rank: entry.rank } }),
    ]).then((states) => commit(Promise.resolve(states.at(-1)!))).catch(() => {});
  };

  const scheduleRows = (rows: ScheduleItem[]) => rows.length === 0 ? (
    <div className="operationsTodayEmpty">{t("operations.today.none")}</div>
  ) : (
    <div className="todayTaskList">{rows.map((entry, index) => {
      const complete = entry.completedAt !== undefined;
      return <article key={entry.id} className={`todayTask${complete ? " complete" : ""}`}>
        <button
          type="button"
          className="todayTaskCheck"
          aria-label={complete ? t("operations.schedule.undo") : t("operations.schedule.done")}
          onClick={() => { void commit(face.updateScheduleItem({ id: entry.id, patch: { completed: !complete } })); }}
        >{complete ? "✓" : ""}</button>
        <span className="todayTaskRank">{String(index + 1).padStart(2, "0")}</span>
        <button type="button" className="todayTaskMain" onClick={() => { if (entry.contentId !== undefined) openContent(entry.contentId); }}>
          <span><em>{t(`operations.schedule.milestone.${entry.milestone}` as CreatorKey)}</em>{entry.contentId !== undefined && <small>{itemById.get(entry.contentId)?.workflow ?? ""}</small>}</span>
          <strong>{entry.title}</strong>
          <small>{entry.note || state.contentMeta[entry.contentId ?? ""]?.nextAction || t("operations.notRecorded")}</small>
        </button>
        <div className="todayTaskControls">
          <button type="button" aria-label="上移" onClick={() => { updateRank(entry, -1); }}>↑</button>
          <button type="button" aria-label="下移" onClick={() => { updateRank(entry, 1); }}>↓</button>
          <input aria-label="改期" type="date" value={inputDate(entry.plannedAt)} onChange={(event) => { void commit(face.updateScheduleItem({ id: entry.id, patch: { plannedAt: noon(event.target.value) } })); }} />
          <button type="button" aria-label={t("operations.delete")} onClick={() => { if (window.confirm(t("operations.schedule.deleteConfirm"))) void commit(face.deleteScheduleItem(entry.id)); }}>×</button>
        </div>
      </article>;
    })}</div>
  );

  return <section className="todayCockpit">
    <div className="operationsRangeSwitch" role="group" aria-label={t("operations.today.range")}>
      <button type="button" className={range === "today" ? "active" : ""} onClick={() => { setRange("today"); }}>{t("operations.today.mode.today")}</button>
      <button type="button" className={range === "week" ? "active" : ""} onClick={() => { setRange("week"); }}>{t("operations.today.mode.week")}</button>
      <span>{shortDate(rangeStart)}–{shortDate(rangeEnd)}</span>
      <button type="button" className="todayOpenSchedule" onClick={() => { setOperationsSection("schedule"); }}>{t("operations.nav.schedule")} →</button>
    </div>

    {overdue.length > 0 && <section className="todayPrimaryPanel overdue">
      <header><div><span>OVERDUE</span><h2>{t("operations.today.overdue")}</h2><p>保留原排期，完成、改期或移除后自动消失。</p></div><strong>{overdue.length}</strong></header>
      {scheduleRows(overdue)}
    </section>}

    <section className="todayPrimaryPanel">
      <header><div><span>{range === "today" ? "TODAY'S TODO" : "THIS WEEK"}</span><h2>{range === "today" ? t("operations.today.must") : t("operations.today.mustWeek")}</h2><p>所有推进事项统一来自档期规划。</p></div><strong>{due.filter((entry) => entry.completedAt === undefined).length}<small> 待完成</small></strong></header>
      {scheduleRows(due)}
    </section>

    <div className="todaySupportGrid">
      <section><header><span>T+{state.settings.reviewDelayDays}</span><h2>{t("operations.today.reviews")}</h2></header>{waiting.length === 0 ? <div className="operationsTodayEmpty">{t("operations.today.none")}</div> : waiting.map((item) => <button key={item.id} type="button" onClick={() => { openContent(item.id); }}><strong>{item.title}</strong><span>{t("operations.reviews.due")}</span></button>)}</section>
      <section><header><span>GOAL HEALTH</span><h2>{t("operations.today.goals")}</h2></header>{activeGoals.length === 0 ? <div className="operationsTodayEmpty">{t("operations.today.none")}</div> : activeGoals.slice(0, 4).map((goal) => { const current = goalMetricValue(goal, items, state); const progress = current === undefined || goal.target <= 0 ? 0 : Math.min(100, Math.round(current / goal.target * 100)); return <button key={goal.id} type="button" onClick={() => { setOperationsSection("goals"); }}><span><strong>{goal.name}</strong><em>{current ?? t("operations.notRecorded")} / {goal.target}</em></span><i><b style={{ width: `${progress}%` }} /></i></button>; })}</section>
      <section><header><span>INSPIRATION</span><h2>{t("operations.today.ideas")}</h2></header>{recentIdeas.length === 0 ? <div className="operationsTodayEmpty">{t("operations.today.none")}</div> : recentIdeas.map((idea) => <button key={idea.id} type="button" onClick={() => { setOperationsSection("ideas"); }}><strong>{idea.title}</strong><span>{t(`operations.ideaStatus.${idea.status}` as CreatorKey)}</span></button>)}</section>
    </div>
  </section>;
}
