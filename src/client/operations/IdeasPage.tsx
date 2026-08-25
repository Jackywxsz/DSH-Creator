import { useEffect, useRef, useState } from "react";
import { Button, IconEditOutline16, IconTrashOutline16, Modal } from "@deepseek-ai/dsh-client-ui-primitives";

import type { CockpitState, Idea } from "../../cockpit/schemas.ts";
import { useIdeaCaptureEpoch } from "../contentSelection.ts";
import type { CreatorKey } from "../locales.ts";
import type { CreatorCockpitFace } from "./face.ts";
import "./OperationsForms.css";

interface IdeaDraft {
  title: string;
  note: string;
  source: string;
  tags: string[];
  contentType: string;
  tier: string;
  goalId: string;
}

const EMPTY_DRAFT: IdeaDraft = {
  title: "",
  note: "",
  source: "",
  tags: [],
  contentType: "",
  tier: "",
  goalId: "",
};

function draftOf(idea: Idea): IdeaDraft {
  return {
    title: idea.title,
    note: idea.note,
    source: idea.source ?? "",
    tags: idea.tags,
    contentType: idea.contentType ?? "",
    tier: idea.tier ?? "",
    goalId: idea.goalId ?? "",
  };
}

function splitOptions(value: string): string[] {
  return [...new Set(value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean))];
}

export function IdeasPage({
  state,
  face,
  t,
  commit,
  openContent,
}: {
  state: CockpitState;
  face: CreatorCockpitFace;
  t: (key: CreatorKey) => string;
  commit: (operation: Promise<CockpitState>) => Promise<void>;
  openContent: (id: string) => void;
}) {
  const captureEpoch = useIdeaCaptureEpoch();
  const titleRef = useRef<HTMLInputElement>(null);
  const [quick, setQuick] = useState<IdeaDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<Idea | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<IdeaDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<"active" | Idea["status"]>("active");
  const [promoting, setPromoting] = useState<Idea | undefined>(undefined);
  const [promotionTitle, setPromotionTitle] = useState("");
  const [promotionTopic, setPromotionTopic] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [contentTypes, setContentTypes] = useState(state.settings.contentTypes.join("，"));
  const [tiers, setTiers] = useState(state.settings.tiers.join("，"));
  const [tags, setTags] = useState(state.settings.tags.join("，"));

  useEffect(() => {
    if (captureEpoch > 0) window.requestAnimationFrame(() => { titleRef.current?.focus(); });
  }, [captureEpoch]);

  useEffect(() => {
    setContentTypes(state.settings.contentTypes.join("，"));
    setTiers(state.settings.tiers.join("，"));
    setTags(state.settings.tags.join("，"));
  }, [state.settings]);

  const toggleTag = (current: IdeaDraft, tag: string): IdeaDraft => ({
    ...current,
    tags: current.tags.includes(tag)
      ? current.tags.filter((value) => value !== tag)
      : [...current.tags, tag],
  });

  const saveQuick = async (): Promise<void> => {
    if (saving || quick.title.trim() === "") return;
    setSaving(true);
    try {
      await commit(face.createIdea({
        title: quick.title,
        note: quick.note,
        tags: quick.tags,
        ...(quick.source.trim() === "" ? {} : { source: quick.source }),
        ...(quick.contentType === "" ? {} : { contentType: quick.contentType }),
        ...(quick.tier === "" ? {} : { tier: quick.tier }),
        ...(quick.goalId === "" ? {} : { goalId: quick.goalId }),
      }));
      setQuick(EMPTY_DRAFT);
      titleRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  const openForm = (idea: Idea): void => {
    setEditing(idea);
    setDraft(draftOf(idea));
    setFormOpen(true);
  };

  const saveEdit = async (): Promise<void> => {
    if (saving || editing === undefined || draft.title.trim() === "") return;
    setSaving(true);
    try {
      await commit(face.updateIdea({
        id: editing.id,
        patch: {
          title: draft.title,
          note: draft.note,
          tags: draft.tags,
          source: draft.source.trim() === "" ? null : draft.source,
          contentType: draft.contentType === "" ? null : draft.contentType,
          tier: draft.tier === "" ? null : draft.tier,
          goalId: draft.goalId === "" ? null : draft.goalId,
        },
      }));
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const visible = [...state.ideas]
    .filter((idea) => statusFilter === "active"
      ? idea.status !== "archived"
      : idea.status === statusFilter)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const fields = (
    value: IdeaDraft,
    setValue: (next: IdeaDraft) => void,
    autoFocus = false,
  ) => (
    <>
      <label className="full"><span>{t("operations.ideas.field.title")}</span><input autoFocus={autoFocus} value={value.title} onChange={(event) => { setValue({ ...value, title: event.target.value }); }} /></label>
      <label className="full"><span>{t("operations.ideas.field.note")}</span><textarea value={value.note} onChange={(event) => { setValue({ ...value, note: event.target.value }); }} /></label>
      <label><span>{t("operations.ideas.field.source")}</span><input value={value.source} onChange={(event) => { setValue({ ...value, source: event.target.value }); }} /></label>
      <label><span>{t("operations.meta.contentType")}</span><select value={value.contentType} onChange={(event) => { setValue({ ...value, contentType: event.target.value }); }}><option value="">{t("operations.none")}</option>{state.settings.contentTypes.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label><span>{t("operations.meta.tier")}</span><select value={value.tier} onChange={(event) => { setValue({ ...value, tier: event.target.value }); }}><option value="">{t("operations.none")}</option>{state.settings.tiers.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label><span>{t("operations.ideas.field.goal")}</span><select value={value.goalId} onChange={(event) => { setValue({ ...value, goalId: event.target.value }); }}><option value="">{t("operations.none")}</option>{state.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label>
      <fieldset className="full ideaTagField"><legend>{t("operations.ideas.field.tags")}</legend><div className="ideaTagChoices">{state.settings.tags.map((tag) => <button type="button" key={tag} className={value.tags.includes(tag) ? "selected" : ""} onClick={() => { setValue(toggleTag(value, tag)); }}>#{tag}</button>)}</div></fieldset>
    </>
  );

  return (
    <section className="operationsCrudPage ideasCockpitPage">
      <div className="operationsCrudToolbar">
        <div><h2>{t("operations.ideas.title")}</h2><p>{t("operations.ideas.hint")}</p></div>
        <button type="button" className="operationsQuietAction" onClick={() => { setOptionsOpen(true); }}>{t("operations.options.edit")}</button>
      </div>

      <div className="ideaCockpitLayout">
        <form className="ideaQuickCapture" onSubmit={(event) => { event.preventDefault(); void saveQuick(); }}>
          <div className="ideaPanelEyebrow">QUICK CAPTURE</div>
          <h3>{t("operations.quickCapture")}</h3>
          <p>{t("operations.quickCaptureHint")}</p>
          <input ref={titleRef} aria-label={t("operations.ideas.field.title")} placeholder={t("operations.quickCapturePlaceholder")} value={quick.title} onChange={(event) => { setQuick({ ...quick, title: event.target.value }); }} />
          <textarea aria-label={t("operations.ideas.field.note")} placeholder={t("operations.quickCaptureNote")} value={quick.note} onChange={(event) => { setQuick({ ...quick, note: event.target.value }); }} />
          <div className="ideaQuickSelects">
            <select aria-label={t("operations.meta.contentType")} value={quick.contentType} onChange={(event) => { setQuick({ ...quick, contentType: event.target.value }); }}><option value="">{t("operations.meta.contentType")}</option>{state.settings.contentTypes.map((option) => <option key={option}>{option}</option>)}</select>
            <select aria-label={t("operations.meta.tier")} value={quick.tier} onChange={(event) => { setQuick({ ...quick, tier: event.target.value }); }}><option value="">{t("operations.meta.tier")}</option>{state.settings.tiers.map((option) => <option key={option}>{option}</option>)}</select>
          </div>
          <div className="ideaTagChoices">{state.settings.tags.map((tag) => <button type="button" key={tag} className={quick.tags.includes(tag) ? "selected" : ""} onClick={() => { setQuick(toggleTag(quick, tag)); }}>#{tag}</button>)}</div>
          <button type="submit" className="operationsPrimaryAction" disabled={saving || quick.title.trim() === ""}>{saving ? t("settings.saving") : t("operations.ideas.capture")}</button>
        </form>

        <div className="ideaLibrary">
          <div className="ideaLibraryHeader">
            <div><strong>{visible.length}</strong><span>{t("operations.ideas.count")}</span></div>
            <div className="ideaFilters">{(["active", "inbox", "considering", "promoted", "archived"] as const).map((status) => <button type="button" key={status} className={statusFilter === status ? "active" : ""} onClick={() => { setStatusFilter(status); }}>{status === "active" ? t("operations.ideas.active") : t(`operations.ideaStatus.${status}` as CreatorKey)}</button>)}</div>
          </div>
          {visible.length === 0 ? <div className="operationsInlineEmpty">{t("operations.ideas.empty")}</div> : (
            <div className="ideaCardList">{visible.map((idea, index) => {
              const expanded = selectedId === idea.id;
              return <article key={idea.id} className={expanded ? "ideaReferenceCard selected" : "ideaReferenceCard"}>
                <button type="button" className="ideaCardSelect" aria-expanded={expanded} onClick={() => { setSelectedId(expanded ? undefined : idea.id); }}>
                  <span className="ideaCardNumber">{String(index + 1).padStart(2, "0")}</span>
                  <span className="ideaCardBody"><span className="ideaCardBadges">{idea.tier !== undefined && <b>{idea.tier}</b>}{idea.contentType !== undefined && <em>{idea.contentType}</em>}<em>{t(`operations.ideaStatus.${idea.status}` as CreatorKey)}</em></span><strong>{idea.title}</strong><small>{idea.note || t("operations.notRecorded")}</small><span className="ideaCardTags">{idea.tags.map((tag) => <i key={tag}>#{tag}</i>)}</span></span>
                </button>
                {expanded && <div className="ideaCardActions">
                  {idea.status === "promoted" && idea.promotedContentId !== undefined ? <button type="button" onClick={() => { openContent(idea.promotedContentId!); }}>{t("operations.openContent")}</button> : <button type="button" className="promote" onClick={() => { setPromoting(idea); setPromotionTitle(idea.title); setPromotionTopic(idea.note); }}>{t("operations.ideas.promote")}</button>}
                  <button type="button" onClick={() => { openForm(idea); }}><IconEditOutline16 size={15} />{t("operations.edit")}</button>
                  <button type="button" className="danger" onClick={() => { if (window.confirm(t("operations.ideas.deleteConfirm"))) void commit(face.deleteIdea(idea.id)); }}><IconTrashOutline16 size={15} />{t("operations.delete")}</button>
                </div>}
              </article>;
            })}</div>
          )}
        </div>
      </div>

      <Modal open={formOpen} onClose={() => { if (!saving) setFormOpen(false); }} title={t("operations.ideas.edit")} closeLabel={t("create.cancel")} footer={<><Button variant="outline" disabled={saving} onClick={() => { setFormOpen(false); }}>{t("create.cancel")}</Button><Button variant="primary" disabled={saving || draft.title.trim() === ""} onClick={() => { void saveEdit(); }}>{t("settings.save")}</Button></>}>
        <div data-plugin="dsh-oil-creator" data-surface="operations-dialog" className="operationsFormGrid">{fields(draft, setDraft, true)}</div>
      </Modal>

      <Modal open={optionsOpen} onClose={() => { if (!saving) setOptionsOpen(false); }} title={t("operations.options.title")} closeLabel={t("create.cancel")} footer={<><Button variant="outline" disabled={saving} onClick={() => { setOptionsOpen(false); }}>{t("create.cancel")}</Button><Button variant="primary" disabled={saving} onClick={() => { setSaving(true); void commit(face.updateSettings({ contentTypes: splitOptions(contentTypes), tiers: splitOptions(tiers), tags: splitOptions(tags) })).then(() => { setOptionsOpen(false); }).finally(() => { setSaving(false); }); }}>{t("settings.save")}</Button></>}>
        <div data-plugin="dsh-oil-creator" data-surface="operations-dialog" className="operationsFormGrid"><p className="full operationsPromotionWarning">{t("operations.options.hint")}</p><label className="full"><span>{t("operations.options.contentTypes")}</span><textarea value={contentTypes} onChange={(event) => { setContentTypes(event.target.value); }} /></label><label><span>{t("operations.options.tiers")}</span><textarea value={tiers} onChange={(event) => { setTiers(event.target.value); }} /></label><label><span>{t("operations.options.tags")}</span><textarea value={tags} onChange={(event) => { setTags(event.target.value); }} /></label></div>
      </Modal>

      <Modal open={promoting !== undefined} onClose={() => { if (!saving) setPromoting(undefined); }} title={t("operations.ideas.promoteTitle")} closeLabel={t("create.cancel")} footer={<><Button variant="outline" disabled={saving} onClick={() => { setPromoting(undefined); }}>{t("create.cancel")}</Button><Button variant="primary" disabled={saving || promotionTitle.trim() === ""} onClick={() => { const idea = promoting; if (idea === undefined || saving) return; setSaving(true); void face.promoteIdea({ ideaId: idea.id, expectedRevision: state.revision, title: promotionTitle, topicNote: promotionTopic }).then(async (result) => { await commit(Promise.resolve(result.state)); setPromoting(undefined); if (result.recovery !== undefined) window.alert(result.recovery); openContent(result.contentId); }).catch((cause: unknown) => { window.alert(cause instanceof Error ? cause.message : t("operations.state.writeFailed")); }).finally(() => { setSaving(false); }); }}>{saving ? t("settings.saving") : t("operations.ideas.promoteConfirm")}</Button></>}>
        <div data-plugin="dsh-oil-creator" data-surface="operations-dialog" className="operationsFormGrid"><p className="full operationsPromotionWarning">{t("operations.ideas.promoteHint")}</p><label className="full"><span>{t("operations.ideas.field.title")}</span><input value={promotionTitle} onChange={(event) => { setPromotionTitle(event.target.value); }} /></label><label className="full"><span>topic.md</span><textarea value={promotionTopic} onChange={(event) => { setPromotionTopic(event.target.value); }} /></label></div>
      </Modal>
    </section>
  );
}
