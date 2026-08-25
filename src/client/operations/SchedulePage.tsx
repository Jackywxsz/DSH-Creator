import { useMemo, useState, type DragEvent } from "react";
import { Button, IconEditOutline16, IconPlusOutline16, IconTrashOutline16, Modal } from "@deepseek-ai/dsh-client-ui-primitives";

import type { CockpitState, ScheduleItem } from "../../cockpit/schemas.ts";
import type { ContentSummary, WorkflowStage } from "../../types.ts";
import type { CreatorKey } from "../locales.ts";
import { addDays, dayStart, inputDate, noon, shortDate, weekStart } from "./date.ts";
import type { CreatorCockpitFace } from "./face.ts";
import { createStageDragPayload, parseStageDragPayload, PRODUCTION_STAGES } from "./scheduleStages.ts";
import "./OperationsForms.css";

interface ScheduleDraft {
  title: string;
  plannedDate: string;
  kind: ScheduleItem["kind"];
  milestone: ScheduleItem["milestone"];
  contentId: string;
  typeId: string;
  note: string;
}

const WORKFLOW_MILESTONE: Record<WorkflowStage, ScheduleItem["milestone"]> = {
  idle: "topic",
  record: "recording",
  cut: "editing",
  finish: "editing",
  publish: "publishing",
  live: "review",
};

function draftOf(now: number, item?: ScheduleItem): ScheduleDraft {
  return item === undefined ? {
    title: "",
    plannedDate: inputDate(now),
    kind: "content",
    milestone: "topic",
    contentId: "",
    typeId: "",
    note: "",
  } : {
    title: item.title,
    plannedDate: inputDate(item.plannedAt),
    kind: item.kind,
    milestone: item.milestone,
    contentId: item.contentId ?? "",
    typeId: item.typeId ?? "",
    note: item.note,
  };
}

function monthCells(anchor: number): Array<number | undefined> {
  const date = new Date(anchor);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const leading = (first.getDay() + 6) % 7;
  const count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: leading }, () => undefined),
    ...Array.from({ length: count }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index + 1).getTime()),
  ];
}

export function SchedulePage({ state, items, face, t, commit, openContent }: {
  state: CockpitState;
  items: ContentSummary[];
  face: CreatorCockpitFace;
  t: (key: CreatorKey) => string;
  commit: (operation: Promise<CockpitState>) => Promise<void>;
  openContent: (id: string) => void;
}) {
  const now = Date.now();
  const [mode, setMode] = useState<"week" | "month">("month");
  const [anchor, setAnchor] = useState(dayStart(now));
  const [editing, setEditing] = useState<ScheduleItem | undefined>();
  const [draft, setDraft] = useState<ScheduleDraft>(() => draftOf(now));
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const visibleDates = mode === "week"
    ? Array.from({ length: 7 }, (_, index) => addDays(weekStart(anchor), index))
    : monthCells(anchor);
  const periodLabel = mode === "week"
    ? `${shortDate(weekStart(anchor))}–${shortDate(addDays(weekStart(anchor), 6))}`
    : new Date(anchor).toLocaleDateString(undefined, { year: "numeric", month: "long" });

  const openForm = (date = anchor, item?: ScheduleItem): void => {
    setEditing(item);
    setDraft(item === undefined ? draftOf(date) : draftOf(date, item));
    setFormOpen(true);
  };

  const save = async (): Promise<void> => {
    if (saving || draft.title.trim() === "") return;
    setSaving(true);
    try {
      const common = {
        title: draft.title,
        kind: draft.kind,
        milestone: draft.milestone,
        plannedAt: noon(draft.plannedDate),
        note: draft.note,
        ...(draft.contentId === "" ? {} : { contentId: draft.contentId }),
        ...(draft.typeId === "" ? {} : { typeId: draft.typeId }),
      };
      if (editing === undefined) await commit(face.createScheduleItem(common));
      else await commit(face.updateScheduleItem({ id: editing.id, patch: { ...common, contentId: draft.contentId === "" ? null : draft.contentId, typeId: draft.typeId === "" ? null : draft.typeId } }));
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const movePeriod = (direction: -1 | 1): void => {
    const date = new Date(anchor);
    if (mode === "week") date.setDate(date.getDate() + direction * 7);
    else date.setMonth(date.getMonth() + direction, 1);
    setAnchor(dayStart(date.getTime()));
  };

  const dropOn = (event: DragEvent, date: number): void => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/x-creator-schedule") || event.dataTransfer.getData("text/plain");
    const stage = parseStageDragPayload(raw);
    if (stage !== undefined) {
      const content = itemById.get(stage.contentId);
      if (content !== undefined) void commit(face.createScheduleItem({
        kind: "content",
        milestone: stage.milestone,
        title: content.title,
        contentId: content.id,
        plannedAt: noon(inputDate(date)),
        note: state.contentMeta[content.id]?.nextAction ?? "",
      }));
      return;
    }
    try {
      const payload = JSON.parse(raw) as { kind?: string; id?: string };
      if (payload.kind === "schedule" && payload.id !== undefined) {
        void commit(face.updateScheduleItem({ id: payload.id, patch: { plannedAt: noon(inputDate(date)) } }));
      }
      if (payload.kind === "content" && payload.id !== undefined) {
        const content = itemById.get(payload.id);
        if (content !== undefined) void commit(face.createScheduleItem({
          kind: "content",
          milestone: WORKFLOW_MILESTONE[content.workflow],
          title: content.title,
          contentId: content.id,
          plannedAt: noon(inputDate(date)),
          note: state.contentMeta[content.id]?.nextAction ?? "",
        }));
      }
    } catch {
      return;
    }
  };

  return <section className="scheduleCockpit">
    <div className="scheduleToolbar">
      <div><span>PRODUCTION SCHEDULE</span><h2>{periodLabel}</h2><p>把真实内容的下一步拖进日历，今日推进会自动读取这里。</p></div>
      <div>
        <div className="scheduleMode"><button type="button" className={mode === "week" ? "active" : ""} onClick={() => { setMode("week"); }}>周</button><button type="button" className={mode === "month" ? "active" : ""} onClick={() => { setMode("month"); }}>月</button></div>
        <button type="button" onClick={() => { movePeriod(-1); }}>←</button>
        <button type="button" onClick={() => { setAnchor(dayStart(now)); }}>今天</button>
        <button type="button" onClick={() => { movePeriod(1); }}>→</button>
        <button type="button" className="operationsPrimaryAction" onClick={() => { openForm(now); }}><IconPlusOutline16 size={16} />{t("operations.schedule.create")}</button>
      </div>
    </div>

    <div className="scheduleLayout">
      <aside className="scheduleBacklog">
        <header><span>NEXT ACTIONS</span><h3>待安排内容</h3><small>拖入右侧日期</small></header>
        <div>{items.filter((item) => item.workflow !== "live").map((item) => <article
          key={item.id}
          draggable
          onDragStart={(event) => {
            const value = JSON.stringify({ kind: "content", id: item.id });
            event.dataTransfer.setData("application/x-creator-schedule", value);
            event.dataTransfer.setData("text/plain", value);
          }}
        ><strong>{item.title}</strong><div className="scheduleStageList">{PRODUCTION_STAGES.map((milestone) => <button
          key={milestone}
          type="button"
          className={`scheduleStageChip${WORKFLOW_MILESTONE[item.workflow] === milestone ? " current" : ""}`}
          draggable
          aria-label={`拖动${t(`operations.schedule.milestone.${milestone}` as CreatorKey)}到日历`}
          onDragStart={(event) => {
            event.stopPropagation();
            const value = createStageDragPayload(item.id, milestone);
            event.dataTransfer.effectAllowed = "copy";
            event.dataTransfer.setData("application/x-creator-schedule", value);
            event.dataTransfer.setData("text/plain", value);
          }}
        >{t(`operations.schedule.milestone.${milestone}` as CreatorKey)}</button>)}</div><small>{state.contentMeta[item.id]?.nextAction ?? t("operations.notRecorded")}</small></article>)}</div>
      </aside>

      <div className={`scheduleCalendar ${mode}`}>
        <div className="scheduleWeekdays">{["一", "二", "三", "四", "五", "六", "日"].map((value) => <span key={value}>周{value}</span>)}</div>
        <div className="scheduleCalendarGrid">{visibleDates.map((date, cell) => {
          if (date === undefined) return <div key={`blank-${cell}`} className="scheduleCell blank" />;
          const entries = state.scheduleItems.filter((entry) => dayStart(entry.plannedAt) === dayStart(date)).sort((a, b) => a.rank - b.rank);
          const current = dayStart(date) === dayStart(now);
          return <section key={date} className={`scheduleCell${current ? " current" : ""}`} onDragOver={(event) => { event.preventDefault(); }} onDrop={(event) => { dropOn(event, date); }}>
            <header><strong>{new Date(date).getDate()}</strong><button type="button" aria-label="在此日安排" onClick={() => { openForm(date); }}>＋</button></header>
            <div>{entries.map((entry) => {
              const color = state.settings.milestoneColors[entry.milestone];
              return <article key={entry.id} className={entry.completedAt === undefined ? "" : "complete"} draggable onDragStart={(event) => {
                const value = JSON.stringify({ kind: "schedule", id: entry.id });
                event.dataTransfer.setData("application/x-creator-schedule", value);
                event.dataTransfer.setData("text/plain", value);
              }} style={{ "--schedule-color": color } as React.CSSProperties}>
                <button type="button" className="scheduleCardMain" onClick={() => { if (entry.contentId !== undefined) openContent(entry.contentId); }}><span>{t(`operations.schedule.milestone.${entry.milestone}` as CreatorKey)}</span><strong>{entry.title}</strong></button>
                <div><button type="button" aria-label={t("operations.schedule.done")} onClick={() => { void commit(face.updateScheduleItem({ id: entry.id, patch: { completed: entry.completedAt === undefined } })); }}>{entry.completedAt === undefined ? "✓" : "↶"}</button><button type="button" aria-label={t("operations.edit")} onClick={() => { openForm(date, entry); }}><IconEditOutline16 size={13} /></button><button type="button" aria-label={t("operations.delete")} onClick={() => { if (window.confirm(t("operations.schedule.deleteConfirm"))) void commit(face.deleteScheduleItem(entry.id)); }}><IconTrashOutline16 size={13} /></button></div>
              </article>;
            })}</div>
          </section>;
        })}</div>
      </div>
    </div>

    <Modal open={formOpen} onClose={() => { if (!saving) setFormOpen(false); }} title={editing === undefined ? t("operations.schedule.create") : t("operations.edit")} closeLabel={t("create.cancel")} footer={<><Button variant="outline" disabled={saving} onClick={() => { setFormOpen(false); }}>{t("create.cancel")}</Button><Button variant="primary" disabled={saving || draft.title.trim() === ""} onClick={() => { void save(); }}>{t("settings.save")}</Button></>}>
      <div data-plugin="dsh-oil-creator" data-surface="operations-dialog" className="operationsFormGrid">
        <label className="full"><span>{t("operations.schedule.field.title")}</span><input autoFocus value={draft.title} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); }} /></label>
        <label><span>{t("operations.schedule.field.date")}</span><input type="date" value={draft.plannedDate} onChange={(event) => { setDraft({ ...draft, plannedDate: event.target.value }); }} /></label>
        <label><span>{t("operations.schedule.field.kind")}</span><select value={draft.kind} onChange={(event) => { setDraft({ ...draft, kind: event.target.value as ScheduleItem["kind"] }); }}><option value="content">{t("operations.schedule.kind.content")}</option><option value="review">{t("operations.schedule.kind.review")}</option><option value="live">{t("operations.schedule.kind.live")}</option><option value="custom">{t("operations.schedule.kind.custom")}</option></select></label>
        <label><span>{t("operations.schedule.field.milestone")}</span><select value={draft.milestone} onChange={(event) => { setDraft({ ...draft, milestone: event.target.value as ScheduleItem["milestone"] }); }}>{(["topic", "script", "recording", "editing", "publishing", "review", "custom"] as const).map((value) => <option key={value} value={value}>{t(`operations.schedule.milestone.${value}` as CreatorKey)}</option>)}</select></label>
        <label><span>{t("operations.schedule.field.content")}</span><select value={draft.contentId} onChange={(event) => { const contentId = event.target.value; const item = itemById.get(contentId); setDraft({ ...draft, contentId, title: draft.title === "" ? item?.title ?? "" : draft.title, milestone: item === undefined ? draft.milestone : WORKFLOW_MILESTONE[item.workflow] }); }}><option value="">{t("operations.none")}</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        {draft.kind !== "content" && <label><span>事项类型</span><select value={draft.typeId} onChange={(event) => { setDraft({ ...draft, typeId: event.target.value }); }}><option value="">默认</option>{state.settings.scheduleTypes.filter((item) => !item.archived).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label className="full"><span>{t("operations.schedule.field.note")}</span><textarea value={draft.note} onChange={(event) => { setDraft({ ...draft, note: event.target.value }); }} /></label>
      </div>
    </Modal>
  </section>;
}
