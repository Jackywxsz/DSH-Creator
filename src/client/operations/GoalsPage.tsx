import { useState } from "react";
import { Button, IconEditOutline16, IconPlusOutline16, IconTrashOutline16, Modal } from "@deepseek-ai/dsh-client-ui-primitives";

import type { CockpitState, Goal } from "../../cockpit/schemas.ts";
import type { ContentSummary } from "../../types.ts";
import type { CreatorKey } from "../locales.ts";
import { inputDate, noon } from "./date.ts";
import type { CreatorCockpitFace } from "./face.ts";
import { goalMetricValue } from "./metrics.ts";
import "./OperationsForms.css";

interface GoalDraft {
  name: string;
  metric: Goal["metric"];
  target: string;
  manualCurrent: string;
  start: string;
  end: string;
  note: string;
  contentIds: string[];
  primary: boolean;
  followerStart: string;
  followerTarget: string;
  contentTypeTargets: Record<string, string>;
}

function newGoalDraft(state: CockpitState): GoalDraft {
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  return {
    name: "",
    metric: "published",
    target: "",
    manualCurrent: "",
    start: inputDate(start.getTime()),
    end: inputDate(end.getTime()),
    note: "",
    contentIds: [],
    primary: !state.goals.some((goal) => goal.primary && goal.archivedAt === undefined),
    followerStart: "",
    followerTarget: "",
    contentTypeTargets: Object.fromEntries(state.settings.contentTypes.map((value) => [value, "0"])),
  };
}

function draftOf(state: CockpitState, goal?: Goal): GoalDraft {
  if (goal === undefined) return newGoalDraft(state);
  return {
    name: goal.name,
    metric: goal.metric,
    target: String(goal.target),
    manualCurrent: goal.manualCurrent === undefined ? "" : String(goal.manualCurrent),
    start: inputDate(goal.startAt),
    end: inputDate(goal.endAt),
    note: goal.note,
    contentIds: goal.contentIds,
    primary: goal.primary,
    followerStart: goal.followerStart === undefined ? "" : String(goal.followerStart),
    followerTarget: goal.followerTarget === undefined ? "" : String(goal.followerTarget),
    contentTypeTargets: Object.fromEntries(state.settings.contentTypes.map((value) => [value, String(goal.contentTypeTargets.find((item) => item.contentType === value)?.target ?? 0)])),
  };
}

function FollowerChart({ state, goal }: { state: CockpitState; goal: Goal }) {
  const entries = state.followerSnapshots.filter((item) => item.capturedAt >= goal.startAt && item.capturedAt <= goal.endAt);
  const rawPoints = [
    ...(goal.followerStart === undefined ? [] : [{ capturedAt: goal.startAt, followers: goal.followerStart }]),
    ...entries,
  ];
  const points = [...new Map(rawPoints.map((item) => [item.capturedAt, item])).values()];
  if (points.length === 0) return <div className="goalChartEmpty">录入粉丝快照后显示趋势。</div>;
  const values = [...points.map((item) => item.followers), goal.followerTarget ?? points[0]!.followers];
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const x = (value: number) => 4 + (value - goal.startAt) / Math.max(1, goal.endAt - goal.startAt) * 92;
  const y = (value: number) => 92 - (value - min) / Math.max(1, max - min) * 78;
  return <div className="goalFollowerChart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="粉丝增长趋势">{[25, 50, 75].map((line) => <line key={line} x1="4" x2="96" y1={line} y2={line} />)}{goal.followerTarget !== undefined && <line className="target" x1="4" x2="96" y1={y(goal.followerTarget)} y2={y(goal.followerTarget)} />}<polyline points={points.map((item) => `${x(item.capturedAt)},${y(item.followers)}`).join(" ")} />{points.map((item) => <circle key={item.capturedAt} cx={x(item.capturedAt)} cy={y(item.followers)} r="1.4"><title>{inputDate(item.capturedAt)} · {item.followers}</title></circle>)}</svg><footer><span>{inputDate(goal.startAt).slice(5)}</span><strong>{points.at(-1)?.followers.toLocaleString()}</strong><span>{inputDate(goal.endAt).slice(5)}</span></footer></div>;
}

export function GoalsPage({ state, items, face, t, commit }: {
  state: CockpitState;
  items: ContentSummary[];
  face: CreatorCockpitFace;
  t: (key: CreatorKey) => string;
  commit: (operation: Promise<CockpitState>) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Goal | undefined>();
  const [draft, setDraft] = useState<GoalDraft>(() => newGoalDraft(state));
  const [formOpen, setFormOpen] = useState(false);
  const [followers, setFollowers] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(inputDate(Date.now()));
  const [saving, setSaving] = useState(false);
  const active = state.goals.filter((goal) => goal.archivedAt === undefined).sort((a, b) => Number(b.primary) - Number(a.primary));
  const archived = state.goals.filter((goal) => goal.archivedAt !== undefined);
  const primary = active.find((goal) => goal.primary);

  const openForm = (goal?: Goal): void => {
    setEditing(goal);
    setDraft(draftOf(state, goal));
    setFormOpen(true);
  };

  const saveGoal = async (): Promise<void> => {
    if (draft.name.trim() === "" || draft.target === "" || saving) return;
    setSaving(true);
    const contentTypeTargets = Object.entries(draft.contentTypeTargets).map(([contentType, value]) => ({ contentType, target: Math.max(0, Number(value) || 0) }));
    const shared = {
      name: draft.name,
      target: Number(draft.target),
      startAt: noon(draft.start),
      endAt: noon(draft.end),
      contentIds: draft.contentIds,
      primary: draft.primary,
      contentTypeTargets,
      followerStart: draft.followerStart === "" ? undefined : Number(draft.followerStart),
      followerTarget: draft.followerTarget === "" ? undefined : Number(draft.followerTarget),
      note: draft.note,
    };
    try {
      if (editing === undefined) await commit(face.createGoal({
        ...shared,
        metric: draft.metric,
        ...(draft.metric === "custom" && draft.manualCurrent !== "" ? { manualCurrent: Number(draft.manualCurrent) } : {}),
      }));
      else await commit(face.updateGoal({
        id: editing.id,
        patch: {
          ...shared,
          followerStart: draft.followerStart === "" ? null : Number(draft.followerStart),
          followerTarget: draft.followerTarget === "" ? null : Number(draft.followerTarget),
          manualCurrent: editing.metric === "custom" ? draft.manualCurrent === "" ? null : Number(draft.manualCurrent) : null,
        },
      }));
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const addSnapshot = async (): Promise<void> => {
    if (followers === "" || saving) return;
    setSaving(true);
    try {
      await commit(face.createFollowerSnapshot({ followers: Number(followers), capturedAt: noon(snapshotDate) }));
      setFollowers("");
    } finally {
      setSaving(false);
    }
  };

  const GoalCard = ({ goal }: { goal: Goal }) => {
    const current = goalMetricValue(goal, items, state);
    const progress = current === undefined || goal.target <= 0 ? undefined : Math.min(100, Math.round(current / goal.target * 100));
    const elapsed = Math.max(0, Math.min(100, Math.round((Date.now() - goal.startAt) / Math.max(1, goal.endAt - goal.startAt) * 100)));
    const health = progress === undefined ? "unknown" : progress >= 100 ? "complete" : progress >= elapsed + 10 ? "ahead" : progress >= elapsed - 10 ? "ontrack" : "risk";
    return <article className={`operationsGoalRow${goal.primary ? " primary" : ""}`}>
      <div className="operationsGoalHeader"><div>{goal.primary && <em>PRIMARY CYCLE</em>}<strong>{goal.name}</strong><span>{t(`operations.metric.${goal.metric}` as CreatorKey)} · {inputDate(goal.startAt)} {t("operations.periodSeparator")} {inputDate(goal.endAt)}</span></div><div className="operationsGoalHeaderActions"><span className={`operationsGoalHealth ${health}`}>{t(`operations.goals.health.${health}` as CreatorKey)}</span><div className="operationsRowActions"><button type="button" aria-label={t("operations.edit")} onClick={() => { openForm(goal); }}><IconEditOutline16 size={16} /></button><button type="button" className="danger" aria-label={t("operations.delete")} onClick={() => { if (window.confirm(t("operations.goals.deleteConfirm"))) void commit(face.deleteGoal(goal.id)); }}><IconTrashOutline16 size={16} /></button></div></div></div>
      <div className="operationsGoalValue"><strong>{current === undefined ? t("operations.notRecorded") : current}</strong><span>/ {goal.target}</span>{progress !== undefined && <em>{progress}% · {t("operations.goals.elapsed")} {elapsed}%</em>}</div>
      <div className="operationsGoalTrack"><span style={{ width: `${progress ?? 0}%` }} /></div>
      {goal.primary && <><div className="goalQuotaGrid">{goal.contentTypeTargets.map((quota) => { const count = items.filter((item) => state.contentMeta[item.id]?.contentType === quota.contentType && Object.values(item.publish).some((entry) => entry.status === "published" && entry.publishedAt !== undefined && entry.publishedAt >= goal.startAt && entry.publishedAt <= goal.endAt)).length; return <div key={quota.contentType}><span>{quota.contentType}</span><strong>{count}<small> / {quota.target}</small></strong></div>; })}</div><FollowerChart state={state} goal={goal} /></>}
      {goal.note && <p>{goal.note}</p>}
      {goal.primary && <button type="button" className="goalArchive" onClick={() => { if (window.confirm("归档当前阶段目标？历史数据会保留为只读。")) void commit(face.updateGoal({ id: goal.id, patch: { archived: true } })); }}>归档阶段并保留历史</button>}
    </article>;
  };

  return <section className="operationsCrudPage goalsCockpit">
    <div className="operationsCrudToolbar"><div><h2>{t("operations.goals.title")}</h2><p>{t("operations.goals.hint")}</p></div><button type="button" className="operationsPrimaryAction" onClick={() => { openForm(); }}><IconPlusOutline16 size={16} />{primary === undefined ? "建立阶段目标" : t("operations.goals.create")}</button></div>
    {active.length === 0 ? <div className="operationsInlineEmpty">{t("operations.goals.empty")}</div> : <div className="operationsGoalsList">{active.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</div>}

    <section className="operationsSnapshots"><div><h3>{t("operations.followers.title")}</h3><p>{t("operations.followers.hint")}</p></div><div className="operationsSnapshotForm"><input type="date" value={snapshotDate} onChange={(event) => { setSnapshotDate(event.target.value); }} /><input type="number" min="0" placeholder={t("operations.followers.count")} value={followers} onChange={(event) => { setFollowers(event.target.value); }} /><button type="button" disabled={followers === "" || saving} onClick={() => { void addSnapshot(); }}>{t("operations.followers.add")}</button></div>{state.followerSnapshots.length > 0 && <div className="operationsSnapshotList">{[...state.followerSnapshots].reverse().map((entry) => <div key={entry.id}><span>{inputDate(entry.capturedAt)}</span><strong>{entry.followers}</strong><button type="button" onClick={() => { if (window.confirm(t("operations.followers.deleteConfirm"))) void commit(face.deleteFollowerSnapshot(entry.id)); }}><IconTrashOutline16 size={14} /></button></div>)}</div>}</section>

    {archived.length > 0 && <details className="goalHistory"><summary>历史阶段 · {archived.length}</summary><div>{archived.map((goal) => <article key={goal.id}><strong>{goal.name}</strong><span>{inputDate(goal.startAt)}–{inputDate(goal.endAt)} · {goal.target}</span></article>)}</div></details>}

    <Modal open={formOpen} onClose={() => { if (!saving) setFormOpen(false); }} title={editing === undefined ? t("operations.goals.create") : t("operations.goals.edit")} closeLabel={t("create.cancel")} footer={<><Button variant="outline" disabled={saving} onClick={() => { setFormOpen(false); }}>{t("create.cancel")}</Button><Button variant="primary" disabled={saving || draft.name.trim() === "" || draft.target === ""} onClick={() => { void saveGoal(); }}>{t("settings.save")}</Button></>}>
      <div data-plugin="jacky-creator" data-surface="operations-dialog" className="operationsFormGrid">
        <label className="full"><span>{t("operations.goals.field.name")}</span><input autoFocus value={draft.name} onChange={(event) => { setDraft({ ...draft, name: event.target.value }); }} /></label>
        <label className="full check"><input type="checkbox" checked={draft.primary} onChange={(event) => { setDraft({ ...draft, primary: event.target.checked, metric: event.target.checked ? "published" : draft.metric }); }} />设为当前阶段主目标</label>
        <label><span>{t("operations.goals.field.metric")}</span><select value={draft.metric} disabled={editing !== undefined || draft.primary} onChange={(event) => { setDraft({ ...draft, metric: event.target.value as Goal["metric"] }); }}><option value="published">{t("operations.metric.published")}</option><option value="views">{t("operations.metric.views")}</option><option value="likes">{t("operations.metric.likes")}</option><option value="comments">{t("operations.metric.comments")}</option><option value="followers">{t("operations.metric.followers")}</option><option value="custom">{t("operations.metric.custom")}</option></select></label>
        <label><span>{t("operations.goals.field.target")}</span><input type="number" min="0" value={draft.target} onChange={(event) => { setDraft({ ...draft, target: event.target.value }); }} /></label>
        {draft.metric === "custom" && <label><span>{t("operations.goals.field.current")}</span><input type="number" value={draft.manualCurrent} onChange={(event) => { setDraft({ ...draft, manualCurrent: event.target.value }); }} /></label>}
        <label><span>{t("operations.goals.field.start")}</span><input type="date" value={draft.start} onChange={(event) => { setDraft({ ...draft, start: event.target.value }); }} /></label>
        <label><span>{t("operations.goals.field.end")}</span><input type="date" value={draft.end} onChange={(event) => { setDraft({ ...draft, end: event.target.value }); }} /></label>
        {draft.primary && <><fieldset className="full goalQuotaEditor"><legend>内容类型配额</legend>{state.settings.contentTypes.map((type) => <label key={type}><span>{type}</span><input type="number" min="0" value={draft.contentTypeTargets[type] ?? "0"} onChange={(event) => { setDraft({ ...draft, contentTypeTargets: { ...draft.contentTypeTargets, [type]: event.target.value } }); }} /></label>)}</fieldset><label><span>阶段开始粉丝</span><input type="number" min="0" value={draft.followerStart} onChange={(event) => { setDraft({ ...draft, followerStart: event.target.value }); }} /></label><label><span>目标粉丝</span><input type="number" min="0" value={draft.followerTarget} onChange={(event) => { setDraft({ ...draft, followerTarget: event.target.value }); }} /></label></>}
        <fieldset className="full operationsGoalContents"><legend>{t("operations.goals.field.contents")}</legend>{items.length === 0 ? <span>{t("empty.library")}</span> : items.map((item) => <label key={item.id}><input type="checkbox" checked={draft.contentIds.includes(item.id)} onChange={(event) => { setDraft({ ...draft, contentIds: event.target.checked ? [...draft.contentIds, item.id] : draft.contentIds.filter((id) => id !== item.id) }); }} />{item.title}</label>)}</fieldset>
        <label className="full"><span>{t("operations.goals.field.note")}</span><textarea value={draft.note} onChange={(event) => { setDraft({ ...draft, note: event.target.value }); }} /></label>
      </div>
    </Modal>
  </section>;
}
