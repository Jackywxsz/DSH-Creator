import { useEffect, useRef, useState } from "react";

import type { CockpitState } from "../../cockpit/schemas.ts";
import type { CreatorKey } from "../locales.ts";
import type { CreatorCockpitFace } from "./face.ts";

function backupName(): string {
  return `creator-cockpit-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

function ChipEditor({ label, values, setValues, markDirty }: { label: string; values: string[]; setValues: (values: string[]) => void; markDirty: () => void }) {
  const [draft, setDraft] = useState("");
  const add = (): void => {
    const value = draft.trim();
    if (value === "" || values.includes(value)) return;
    setValues([...values, value]);
    setDraft("");
    markDirty();
  };
  return <fieldset className="settingsChipEditor"><legend>{label}</legend><div>{values.map((value) => <span key={value}>{value}<button type="button" aria-label={`删除 ${value}`} onClick={() => { setValues(values.filter((item) => item !== value)); markDirty(); }}>×</button></span>)}</div><label><input value={draft} placeholder={`添加${label}`} onChange={(event) => { setDraft(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} /><button type="button" onClick={add}>添加</button></label></fieldset>;
}

export function SettingsPage({ state, face, t, commit }: {
  state: CockpitState;
  face: CreatorCockpitFace;
  t: (key: CreatorKey) => string;
  commit: (operation: Promise<CockpitState>) => Promise<void>;
}) {
  const [reviewDelayDays, setReviewDelayDays] = useState(String(state.settings.reviewDelayDays));
  const [contentTypes, setContentTypes] = useState([...state.settings.contentTypes]);
  const [tiers, setTiers] = useState([...state.settings.tiers]);
  const [tags, setTags] = useState([...state.settings.tags]);
  const [scheduleTypes, setScheduleTypes] = useState(state.settings.scheduleTypes.map((item) => ({ ...item })));
  const [newScheduleType, setNewScheduleType] = useState("");
  const [milestoneColors, setMilestoneColors] = useState({ ...state.settings.milestoneColors });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | undefined>();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dirty) return;
    setReviewDelayDays(String(state.settings.reviewDelayDays));
    setContentTypes([...state.settings.contentTypes]);
    setTiers([...state.settings.tiers]);
    setTags([...state.settings.tags]);
    setScheduleTypes(state.settings.scheduleTypes.map((item) => ({ ...item })));
    setMilestoneColors({ ...state.settings.milestoneColors });
  }, [state.revision, dirty]);

  const save = async (): Promise<void> => {
    setSaving(true);
    setRestoreMessage(undefined);
    try {
      await commit(face.updateSettings({ reviewDelayDays: Number(reviewDelayDays), contentTypes, tiers, tags, scheduleTypes, milestoneColors }));
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const exportState = (): void => {
    const blob = new Blob([`${JSON.stringify(state, null, 2)}\n`], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = backupName();
    anchor.click();
    window.setTimeout(() => { URL.revokeObjectURL(href); }, 0);
  };

  const restoreState = async (file: File): Promise<void> => {
    setSaving(true);
    setRestoreMessage(undefined);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("备份文件超过 5 MB，请先确认来源和内容。");
      const imported: unknown = JSON.parse(await file.text());
      if (!window.confirm(t("operations.settings.restoreConfirm"))) return;
      await commit(face.restoreState({ expectedRevision: state.revision, state: imported }));
      setDirty(false);
      setRestoreMessage(t("operations.settings.restored"));
    } catch (cause) {
      setRestoreMessage(cause instanceof Error ? cause.message : t("operations.settings.invalid"));
    } finally {
      setSaving(false);
      if (fileInput.current !== null) fileInput.current.value = "";
    }
  };

  const milestoneLabels: Record<keyof typeof milestoneColors, string> = {
    topic: "选题", script: "脚本", recording: "录制", editing: "剪辑", publishing: "发布", review: "复盘", custom: "自定义",
  };

  const addScheduleType = (): void => {
    const name = newScheduleType.trim();
    if (name === "" || scheduleTypes.some((item) => item.name === name)) return;
    setScheduleTypes([...scheduleTypes, {
      id: `custom-${crypto.randomUUID()}`,
      name,
      color: "#275df5",
      archived: false,
    }]);
    setNewScheduleType("");
    setDirty(true);
  };

  return <section className="operationsSettingsPage">
    <div className="operationsSettingsSaveBar"><span>{dirty ? "有未保存的自定义选项" : "所有设置已保存"}</span><button type="button" disabled={saving || !dirty || reviewDelayDays === ""} onClick={() => { void save(); }}>{saving ? t("settings.saving") : t("settings.save")}</button></div>
    <article className="operationsSettingsCard accent">
      <header><span>01</span><div><h2>{t("operations.settings.optionsTitle")}</h2><p>用可选标签维护常用分类，灵感、管线、目标和复盘共用同一组选项。</p></div></header>
      <div className="operationsSettingsGrid">
        <label><span>{t("operations.settings.reviewDelay")}</span><input type="number" min={0} max={30} value={reviewDelayDays} onChange={(event) => { setReviewDelayDays(event.target.value); setDirty(true); }} /></label>
        <ChipEditor label={t("operations.options.contentTypes")} values={contentTypes} setValues={setContentTypes} markDirty={() => { setDirty(true); }} />
        <ChipEditor label={t("operations.options.tiers")} values={tiers} setValues={setTiers} markDirty={() => { setDirty(true); }} />
        <ChipEditor label={t("operations.options.tags")} values={tags} setValues={setTags} markDirty={() => { setDirty(true); }} />
      </div>
    </article>

    <article className="operationsSettingsCard">
      <header><span>02</span><div><h2>档期类型与颜色</h2><p>阶段颜色会同步到日历卡片；自定义事项可以停用，但不会删除历史排期。</p></div></header>
      <div className="milestoneColorGrid">{Object.entries(milestoneColors).map(([key, color]) => <label key={key}><input type="color" value={color} onChange={(event) => { setMilestoneColors({ ...milestoneColors, [key]: event.target.value }); setDirty(true); }} /><span>{milestoneLabels[key as keyof typeof milestoneLabels]}</span><code>{color}</code></label>)}</div>
      <div className="scheduleTypeSettings">{scheduleTypes.map((entry) => <div key={entry.id}><input type="color" value={entry.color} onChange={(event) => { setScheduleTypes(scheduleTypes.map((item) => item.id === entry.id ? { ...item, color: event.target.value } : item)); setDirty(true); }} /><input value={entry.name} onChange={(event) => { setScheduleTypes(scheduleTypes.map((item) => item.id === entry.id ? { ...item, name: event.target.value } : item)); setDirty(true); }} /><button type="button" onClick={() => { setScheduleTypes(scheduleTypes.map((item) => item.id === entry.id ? { ...item, archived: !item.archived } : item)); setDirty(true); }}>{entry.archived ? "启用" : "停用"}</button></div>)}</div>
      <div className="scheduleTypeCreate"><input value={newScheduleType} placeholder="新增档期类型" onChange={(event) => { setNewScheduleType(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addScheduleType(); } }} /><button type="button" onClick={addScheduleType}>添加类型</button></div>
    </article>

    <article className="operationsSettingsCard">
      <header><span>03</span><div><h2>{t("operations.settings.backupTitle")}</h2><p>{t("operations.settings.backupHint")}</p></div></header>
      <div className="operationsBackupFacts"><span>{t("operations.settings.revision")}<strong>R{state.revision}</strong></span><span>{t("operations.nav.ideas")}<strong>{state.ideas.length}</strong></span><span>{t("operations.nav.reviews")}<strong>{Object.values(state.contentMeta).reduce((sum, meta) => sum + meta.reviews.length, 0)}</strong></span><span>{t("operations.settings.knowledge")}<strong>{state.knowledgeItems.length}</strong></span></div>
      <div className="operationsBackupActions"><button type="button" onClick={exportState}>{t("operations.settings.export")}</button><button type="button" disabled={saving} onClick={() => { fileInput.current?.click(); }}>{t("operations.settings.restore")}</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file !== undefined) void restoreState(file); }} /></div>
      <p className="operationsRestoreHint">{t("operations.settings.restoreHint")}</p>{restoreMessage !== undefined && <div className="operationsRestoreMessage" role="status">{restoreMessage}</div>}
    </article>
  </section>;
}
