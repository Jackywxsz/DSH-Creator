import { useEffect, useState } from "react";
import { Button, IconEditOutline16, IconPlusOutline16, IconTrashOutline16, Input, Modal } from "@deepseek-ai/dsh-client-ui-primitives";

import type { CockpitState, ContentOperationsMeta } from "../../cockpit/schemas.ts";
import type { ContentDetail, ContentSummary } from "../../types.ts";
import type { CreatorKey } from "../locales.ts";
import type { CreatorCockpitFace } from "./face.ts";
import { evaluationFingerprint } from "./fingerprint.ts";
import { sendCockpitInstruction } from "./sessionBridge.tsx";
import "./OperationsForms.css";

function localDate(timestamp?: number): string {
  if (timestamp === undefined) return "";
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const HOOK_OPTIONS = [
  ["information-gap", "信息差"], ["nonconsensus", "反常识"], ["pain", "痛点"],
  ["result", "先给结果"], ["value-promise", "价值承诺"], ["identity", "身份认同"],
  ["contrast", "对比"], ["proof", "证据"], ["custom", "自定义"],
] as const;

const STRUCTURE_OPTIONS = [
  ["pyramid", "金字塔"], ["problem-cause-solution", "问题、原因、方案"],
  ["result-method-proof", "结果、方法、证据"], ["pain-misconception-solution", "痛点、误区、方案"],
  ["value-steps-delivery", "价值、步骤、交付"], ["comparison-judgment", "对比、判断"],
  ["story-turn-insight", "故事、转折、洞察"], ["list", "清单"],
  ["case-study", "案例拆解"], ["custom", "自定义"],
] as const;

const EVALUATION_LABELS: Record<"audience" | "pain" | "differentiation" | "assets" | "hook" | "structure", string> = {
  audience: "受众",
  pain: "痛点",
  differentiation: "差异化",
  assets: "素材",
  hook: "开头",
  structure: "结构",
};

function MetadataEditor({
  item,
  meta,
  state,
  face,
  t,
  commit,
  openContent,
}: {
  item: ContentSummary;
  meta?: ContentOperationsMeta;
  state: CockpitState;
  face: CreatorCockpitFace;
  t: (key: CreatorKey) => string;
  commit: (operation: Promise<CockpitState>) => Promise<void>;
  openContent: (id: string) => void;
}) {
  const [contentType, setContentType] = useState(meta?.contentType ?? "");
  const [tier, setTier] = useState(meta?.tier ?? "");
  const [priority, setPriority] = useState(meta?.priority ?? "");
  const [nextAction, setNextAction] = useState(meta?.nextAction ?? "");
  const [goalIds, setGoalIds] = useState(meta?.goalIds ?? []);
  const [tags, setTags] = useState(meta?.tags ?? []);
  const [hookType, setHookType] = useState(meta?.hookType ?? "");
  const [customHook, setCustomHook] = useState(meta?.customHook ?? "");
  const [structureType, setStructureType] = useState(meta?.structureType ?? "");
  const [customStructure, setCustomStructure] = useState(meta?.customStructure ?? "");
  const [knowledgeIds, setKnowledgeIds] = useState(meta?.knowledgeIds ?? []);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const nextScheduled = state.scheduleItems.filter((entry) => entry.contentId === item.id && entry.completedAt === undefined).sort((a, b) => a.plannedAt - b.plannedAt || a.rank - b.rank)[0];

  useEffect(() => {
    setContentType(meta?.contentType ?? "");
    setTier(meta?.tier ?? "");
    setPriority(meta?.priority ?? "");
    setNextAction(meta?.nextAction ?? "");
    setGoalIds(meta?.goalIds ?? []);
    setTags(meta?.tags ?? []);
    setHookType(meta?.hookType ?? "");
    setCustomHook(meta?.customHook ?? "");
    setStructureType(meta?.structureType ?? "");
    setCustomStructure(meta?.customStructure ?? "");
    setKnowledgeIds(meta?.knowledgeIds ?? []);
  }, [meta?.updatedAt]);

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      await commit(face.setContentMeta({
        contentId: item.id,
        patch: {
          contentType: contentType.trim() === "" ? null : contentType.trim(),
          tier: tier.trim() === "" ? null : tier.trim(),
          priority: priority === "" ? null : priority as "low" | "normal" | "high",
          nextAction: nextAction.trim() === "" ? null : nextAction.trim(),
          goalIds,
          tags,
          hookType: hookType === "" ? null : hookType as NonNullable<ContentOperationsMeta["hookType"]>,
          customHook: hookType === "custom" && customHook.trim() !== "" ? customHook.trim() : null,
          structureType: structureType === "" ? null : structureType as NonNullable<ContentOperationsMeta["structureType"]>,
          customStructure: structureType === "custom" && customStructure.trim() !== "" ? customStructure.trim() : null,
          knowledgeIds,
        },
      }));
    } catch {
      return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="operationsMetaCard">
      <button type="button" className="operationsMetaCardMain" onClick={() => { openContent(item.id); }}>
        <span className="operationsMetaTitle"><strong>{item.title}</strong><small>{meta?.nextAction || t("operations.notRecorded")}</small></span>
        <span className="operationsMetaCardFacts"><em className={`operationsPriority ${meta?.priority ?? "none"}`}>{meta?.priority === undefined ? t("operations.notRecorded") : t(`operations.priority.${meta.priority}` as CreatorKey)}</em><em>{meta?.contentType ?? t("operations.notRecorded")}</em><em>{nextScheduled === undefined ? "未排期" : localDate(nextScheduled.plannedAt)}</em></span>
        <small>{t(`inspector.stage.${item.workflow}` as CreatorKey)} · {t(`operations.pipeline.${item.pipeline}` as CreatorKey)}</small>
      </button>
      <div className="operationsMetaQuickActions">
        <button type="button" disabled={nextScheduled !== undefined} onClick={() => { void commit(face.createScheduleItem({ kind: "content", milestone: item.workflow === "idle" ? "topic" : item.workflow === "record" ? "recording" : item.workflow === "publish" ? "publishing" : item.workflow === "live" ? "review" : "editing", title: meta?.nextAction || item.title, contentId: item.id, plannedAt: new Date().setHours(12, 0, 0, 0), note: meta?.nextAction ?? "" })); }}><IconPlusOutline16 size={14} />{nextScheduled === undefined ? "安排今天" : `已排 ${localDate(nextScheduled.plannedAt)}`}</button>
        <button type="button" aria-expanded={expanded} onClick={() => { setExpanded((value) => !value); }}><IconEditOutline16 size={14} />{expanded ? "收起策略" : "编辑策略"}</button>
      </div>
      {expanded && <><div className="operationsMetaFields">
        <label><span>{t("operations.meta.contentType")}</span><select value={contentType} onChange={(event) => { setContentType(event.target.value); }}><option value="">{t("operations.notRecorded")}</option>{state.settings.contentTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>{t("operations.meta.tier")}</span><select value={tier} onChange={(event) => { setTier(event.target.value); }}><option value="">{t("operations.notRecorded")}</option>{state.settings.tiers.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>{t("operations.meta.priority")}</span><select value={priority} onChange={(event) => { setPriority(event.target.value); }}><option value="">{t("operations.notRecorded")}</option><option value="high">{t("operations.priority.high")}</option><option value="normal">{t("operations.priority.normal")}</option><option value="low">{t("operations.priority.low")}</option></select></label>
        <label className="full"><span>{t("operations.meta.nextAction")}</span><input value={nextAction} onChange={(event) => { setNextAction(event.target.value); }} /></label>
        <label><span>{t("operations.meta.hookType")}</span><select value={hookType} onChange={(event) => { setHookType(event.target.value as typeof hookType); }}><option value="">{t("operations.notRecorded")}</option>{HOOK_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>{t("operations.meta.structureType")}</span><select value={structureType} onChange={(event) => { setStructureType(event.target.value as typeof structureType); }}><option value="">{t("operations.notRecorded")}</option>{STRUCTURE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {hookType === "custom" && <label><span>{t("operations.meta.customHook")}</span><input value={customHook} onChange={(event) => { setCustomHook(event.target.value); }} /></label>}
        {structureType === "custom" && <label><span>{t("operations.meta.customStructure")}</span><input value={customStructure} onChange={(event) => { setCustomStructure(event.target.value); }} /></label>}
        <fieldset className="full"><legend>{t("operations.meta.tags")}</legend>{state.settings.tags.map((tag) => <label key={tag} className="check"><input type="checkbox" checked={tags.includes(tag)} onChange={(event) => { setTags(event.target.checked ? [...tags, tag] : tags.filter((value) => value !== tag)); }} />#{tag}</label>)}</fieldset>
        <fieldset className="full"><legend>{t("operations.meta.goals")}</legend>{state.goals.length === 0 ? <span>{t("operations.goals.empty")}</span> : state.goals.map((goal) => <label key={goal.id} className="check"><input type="checkbox" checked={goalIds.includes(goal.id)} onChange={(event) => { setGoalIds(event.target.checked ? [...goalIds, goal.id] : goalIds.filter((id) => id !== goal.id)); }} />{goal.name}</label>)}</fieldset>
        <fieldset className="full"><legend>{t("operations.meta.knowledge")}</legend>{state.knowledgeItems.filter((entry) => entry.active).length === 0 ? <span>{t("operations.knowledge.empty")}</span> : state.knowledgeItems.filter((entry) => entry.active).map((entry) => <label key={entry.id} className="check"><input type="checkbox" checked={knowledgeIds.includes(entry.id)} onChange={(event) => { setKnowledgeIds(event.target.checked ? [...knowledgeIds, entry.id] : knowledgeIds.filter((id) => id !== entry.id)); }} />{entry.kind === "rule" ? "规则" : "模板"} · {entry.title}</label>)}</fieldset>
      </div>
      <div className="operationsEditorActions">
        <button type="button" onClick={() => { openContent(item.id); }}>{t("operations.openContent")}</button>
        {meta !== undefined && <button type="button" className="danger" onClick={() => { if (window.confirm(t("operations.meta.deleteConfirm"))) void commit(face.deleteContentMeta(item.id)).catch(() => {}); }}><IconTrashOutline16 size={14} />{t("operations.meta.clear")}</button>}
        <button type="button" className="save" disabled={saving} onClick={() => { void save(); }}>{saving ? t("settings.saving") : t("settings.save")}</button>
      </div>
      </>}
    </article>
  );
}

export function ContentOperationsPage({
  state,
  items,
  face,
  t,
  commit,
  openContent,
  getContent,
  createContent,
}: {
  state: CockpitState;
  items: ContentSummary[];
  face: CreatorCockpitFace;
  t: (key: CreatorKey) => string;
  commit: (operation: Promise<CockpitState>) => Promise<void>;
  openContent: (id: string) => void;
  getContent: (id: string) => Promise<ContentDetail>;
  createContent: (title: string) => Promise<{ id: string; folderPath: string }>;
}) {
  const [query, setQuery] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState("");
  const [freshness, setFreshness] = useState<Record<string, boolean>>({});
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);

  const closeCreate = (): void => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError(undefined);
  };

  const createNow = async (): Promise<void> => {
    const title = newTitle.trim();
    if (title === "" || creating) return;
    setCreating(true);
    setCreateError(undefined);
    try {
      const created = await createContent(title);
      setNewTitle("");
      setCreateOpen(false);
      openContent(created.id);
    } catch (cause) {
      setCreateOpen(true);
      setCreateError(cause instanceof Error ? cause.message : t("create.failed"));
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    let live = true;
    const candidates = items.filter((item) => (state.contentMeta[item.id]?.evaluations.length ?? 0) > 0);
    void Promise.all(candidates.map(async (item) => {
      const evaluation = state.contentMeta[item.id]?.evaluations.at(-1);
      if (evaluation === undefined) return [item.id, true] as const;
      const detail = await getContent(item.id);
      return [item.id, await evaluationFingerprint(detail.topicNote, detail.script, evaluation.rubricVersion) === evaluation.inputFingerprint] as const;
    })).then((entries) => { if (live) setFreshness(Object.fromEntries(entries)); }).catch(() => {});
    return () => { live = false; };
  }, [items, state.revision]);
  const liveIds = new Set(items.map((item) => item.id));
  const orphanIds = Object.keys(state.contentMeta).filter((id) => !liveIds.has(id));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleItems = items.filter((item) => {
    const meta = state.contentMeta[item.id];
    const matchesQuery = normalizedQuery === ""
      || item.title.toLocaleLowerCase().includes(normalizedQuery)
      || (meta?.nextAction ?? "").toLocaleLowerCase().includes(normalizedQuery)
      || (meta?.tags ?? []).some((tag) => tag.toLocaleLowerCase().includes(normalizedQuery));
    const matchesType = contentTypeFilter === "" || meta?.contentType === contentTypeFilter;
    return matchesQuery && matchesType;
  });
  const columns = [
    { id: "idea", label: t("operations.board.idea"), items: visibleItems.filter((item) => item.workflow === "idle") },
    { id: "making", label: t("operations.board.making"), items: visibleItems.filter((item) => ["record", "cut", "finish"].includes(item.workflow)) },
    { id: "publish", label: t("operations.board.publish"), items: visibleItems.filter((item) => item.workflow === "publish") },
    { id: "live", label: t("operations.board.live"), items: visibleItems.filter((item) => item.workflow === "live") },
  ];
  return (
    <section className="operationsCrudPage">
      <div className="operationsCrudToolbar operationsPipelineToolbar">
        <div><h2>{t("operations.meta.title")}</h2><p>{t("operations.meta.hint")}</p></div>
        <div className="operationsPipelineFilters">
          <input
            type="search"
            aria-label={t("toolbar.search.aria")}
            placeholder={t("toolbar.search")}
            value={query}
            onChange={(event) => { setQuery(event.target.value); }}
          />
          <select
            aria-label={t("operations.meta.contentType")}
            value={contentTypeFilter}
            onChange={(event) => { setContentTypeFilter(event.target.value); }}
          >
            <option value="">{t("operations.queue.all")}</option>
            {state.settings.contentTypes.map((value) => <option key={value}>{value}</option>)}
          </select>
          <span>{visibleItems.length} / {items.length}</span>
          <span className="operationsNewContent"><input aria-label="新内容标题" placeholder="新内容标题" value={newTitle} onChange={(event) => { setNewTitle(event.target.value); }} /><button type="button" disabled={creating} onClick={() => { if (newTitle.trim() === "") { setCreateError(undefined); setCreateOpen(true); return; } void createNow(); }}>{creating ? "创建中" : "新建内容"}</button></span>
        </div>
      </div>
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title={t("create.title")}
        closeLabel={t("create.cancel")}
        footer={(
          <>
            <Button variant="outline" disabled={creating} onClick={closeCreate}>{t("create.cancel")}</Button>
            <Button variant="primary" disabled={creating || newTitle.trim() === ""} onClick={() => { void createNow(); }}>{creating ? "创建中" : t("create.confirm")}</Button>
          </>
        )}
      >
        <div data-plugin="dsh-oil-creator" data-surface="operations-dialog" className="operationsFormGrid">
          <label className="full"><span>{t("create.name")}</span><Input id="operations-create-name" autoFocus value={newTitle} placeholder={t("create.name.placeholder")} disabled={creating} onChange={(event) => { setNewTitle(event.target.value); }} onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); void createNow(); }} /></label>
          {createError !== undefined && <div className="createError">{createError}</div>}
        </div>
      </Modal>
      <div className="operationsPipelineBoard">
        {columns.map((column) => <section key={column.id} className="operationsPipelineColumn"><header><strong>{column.label}</strong><span>{column.items.length}</span></header><div>{column.items.length === 0 ? <div className="operationsColumnEmpty">{t("operations.today.none")}</div> : column.items.map((item) => {
          const meta = state.contentMeta[item.id];
          const evaluation = meta?.evaluations.at(-1);
          return <div key={item.id} className="operationsContentMetaGroup"><MetadataEditor item={item} {...(meta === undefined ? {} : { meta })} state={state} face={face} t={t} commit={commit} openContent={openContent} /><div className="operationsEvaluationRow"><span>{evaluation === undefined ? t("operations.evaluation.none") : `${evaluation.total} / 30`}</span>{evaluation !== undefined && freshness[item.id] === false && <em>{t("operations.evaluation.stale")}</em>}<button type="button" onClick={() => { const sent = sendCockpitInstruction(`请为 Creator Cockpit 中 contentId=${item.id} 的《${item.title}》执行六维评分。先调用 cockpit_get_evaluation_context 读取当前内容与评分标准，逐项给出 0 到 5 的整数分、对应证据和改进建议，再调用 cockpit_save_evaluation 保存。不要伪造总分，Host 会重新计算。`); if (!sent) window.alert(t("operations.ai.noSession")); }}>{evaluation === undefined ? t("operations.evaluation.ai") : t("operations.evaluation.again")}</button></div>{evaluation !== undefined && <details className="operationsEvaluationDetails"><summary>查看六维证据与建议</summary><div className="operationsScoreGrid">{Object.entries(EVALUATION_LABELS).map(([key, label]) => <article key={key}><span>{label}</span><strong>{evaluation.scores[key as keyof typeof evaluation.scores]}<small>/5</small></strong><p>{evaluation.evidence[key] || "暂未记录证据"}</p></article>)}</div>{evaluation.suggestions.length > 0 && <div className="operationsSuggestions"><strong>下一步改进</strong>{evaluation.suggestions.map((value) => <p key={value}>· {value}</p>)}</div>}</details>}</div>;
        })}</div></section>)}
      </div>
      {orphanIds.length > 0 && <section className="operationsOrphans"><h3>{t("operations.meta.orphans")}</h3><p>{t("operations.meta.orphansHint")}</p>{orphanIds.map((id) => <div key={id}><code>{id}</code><button type="button" onClick={() => { if (window.confirm(t("operations.meta.deleteConfirm"))) void commit(face.deleteContentMeta(id)).catch(() => {}); }}>{t("operations.meta.clear")}</button></div>)}</section>}
    </section>
  );
}
