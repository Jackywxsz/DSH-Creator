import { randomUUID } from "node:crypto";

import type { Context } from "@deepseek-ai/cordis";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

import type { OilCreatorService } from "../service.ts";
import { EVALUATION_RUBRIC, EVALUATION_RUBRIC_VERSION, evaluationFingerprint, evaluationTotal } from "./evaluation.ts";
import { writeKnowledgeMarkdown } from "./knowledge.ts";
import { validateCreatedContentPath } from "./promotion.ts";
import { reviewFingerprint } from "./review.ts";

import {
  type CockpitState,
  type ContentOperationsMeta,
  type CreateFollowerSnapshotRequest,
  type CreateGoalRequest,
  type CreateIdeaRequest,
  type CreateScheduleItemRequest,
  type SetContentMetaRequest,
  type KnowledgeRequest,
  type PromoteIdeaRequest,
  type PromotionResult,
  type RestoreCockpitStateRequest,
  type SaveEvaluationRequest,
  type SaveManualReviewDraftRequest,
  type SaveReviewDraftRequest,
  type UpdateGoalRequest,
  type UpdateIdeaRequest,
  type UpdateCockpitSettingsRequest,
  type UpdateKnowledgeRequest,
  type UpdateScheduleItemRequest,
} from "./schemas.ts";
import { CockpitStore, migrateCockpitState } from "./store.ts";

export const CREATOR_COCKPIT_SERVICE = "creatorCockpit";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function missing(kind: string, id: string): Error {
  return new Error(`${kind} not found: ${id}`);
}

function newContentMeta(contentId: string, timestamp: number): ContentOperationsMeta {
  return {
    contentId,
    tags: [],
    knowledgeIds: [],
    goalIds: [],
    evaluations: [],
    reviews: [],
    updatedAt: timestamp,
  };
}

export class CreatorCockpitService extends TypertRemoteService {
  readonly store: CockpitStore;
  readonly now: () => number;
  readonly oil: OilCreatorService | undefined;
  readonly promotions = new Map<string, Promise<PromotionResult>>();

  constructor(ctx: Context, dataDir: string, oil?: OilCreatorService, now: () => number = Date.now) {
    super(ctx, CREATOR_COCKPIT_SERVICE);
    this.store = new CockpitStore(dataDir);
    this.now = now;
    this.oil = oil;
  }

  async getState(_request: Record<string, never>, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    return this.store.load();
  }

  async getRevision(_request: Record<string, never>, signal: AbortSignal): Promise<{ revision: number }> {
    signal.throwIfAborted();
    return { revision: (await this.store.load()).revision };
  }

  async restoreState(request: RestoreCockpitStateRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const imported = migrateCockpitState(request.state);
    return this.store.replace(imported, request.expectedRevision, async (draft) => {
      for (const item of draft.knowledgeItems) {
        signal.throwIfAborted();
        item.markdownPath = await writeKnowledgeMarkdown(
          this.store.dataDir,
          item.kind === "rule" ? "rules" : "templates",
          item.sourceReviewId,
          item.title,
          item.body,
        );
      }
    });
  }

  async createIdea(request: CreateIdeaRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const timestamp = this.now();
    return this.store.update((draft) => {
      draft.ideas.push({
        id: randomUUID(),
        title: request.title.trim(),
        note: request.note,
        ...(request.source === undefined || request.source.trim() === "" ? {} : { source: request.source.trim() }),
        tags: unique(request.tags.map((tag) => tag.trim()).filter(Boolean)),
        ...(request.contentType === undefined ? {} : { contentType: request.contentType.trim() }),
        ...(request.tier === undefined ? {} : { tier: request.tier.trim() }),
        status: "inbox",
        ...(request.goalId === undefined ? {} : { goalId: request.goalId }),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  }

  async updateIdea(request: UpdateIdeaRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const timestamp = this.now();
    return this.store.update((draft) => {
      const idea = draft.ideas.find((entry) => entry.id === request.id);
      if (idea === undefined) throw missing("idea", request.id);
      const patch = request.patch;
      if (patch.title !== undefined) idea.title = patch.title.trim();
      if (patch.note !== undefined) idea.note = patch.note;
      if (patch.tags !== undefined) idea.tags = unique(patch.tags.map((tag) => tag.trim()).filter(Boolean));
      if (patch.contentType === null) delete idea.contentType;
      else if (patch.contentType !== undefined) idea.contentType = patch.contentType.trim();
      if (patch.tier === null) delete idea.tier;
      else if (patch.tier !== undefined) idea.tier = patch.tier.trim();
      if (patch.status !== undefined) idea.status = patch.status;
      if (patch.source === null) delete idea.source;
      else if (patch.source !== undefined) idea.source = patch.source.trim();
      if (patch.goalId === null) delete idea.goalId;
      else if (patch.goalId !== undefined) idea.goalId = patch.goalId;
      idea.updatedAt = timestamp;
    });
  }

  async deleteIdea(request: { id: string }, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    return this.store.update((draft) => {
      const next = draft.ideas.filter((entry) => entry.id !== request.id);
      if (next.length === draft.ideas.length) throw missing("idea", request.id);
      draft.ideas = next;
    });
  }

  async setContentMeta(request: SetContentMetaRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const timestamp = this.now();
    return this.store.update((draft) => {
      const meta = draft.contentMeta[request.contentId] ?? newContentMeta(request.contentId, timestamp);
      const patch = request.patch;
      for (const key of ["contentType", "tier", "priority", "nextAction", "supplementalMetrics", "hookType", "customHook", "structureType", "customStructure"] as const) {
        const value = patch[key];
        if (value === null) delete meta[key];
        else if (value !== undefined) Object.assign(meta, { [key]: value });
      }
      if (patch.goalIds !== undefined) meta.goalIds = unique(patch.goalIds);
      if (patch.tags !== undefined) meta.tags = unique(patch.tags.map((tag) => tag.trim()).filter(Boolean));
      if (patch.knowledgeIds !== undefined) meta.knowledgeIds = unique(patch.knowledgeIds);
      meta.updatedAt = timestamp;
      draft.contentMeta[request.contentId] = meta;
    });
  }

  async deleteContentMeta(request: { id: string }, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    return this.store.update((draft) => {
      if (draft.contentMeta[request.id] === undefined) throw missing("content metadata", request.id);
      delete draft.contentMeta[request.id];
    });
  }

  async createGoal(request: CreateGoalRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const timestamp = this.now();
    return this.store.update((draft) => {
      if (request.primary === true) {
        for (const goal of draft.goals) {
          if (goal.archivedAt === undefined) goal.primary = false;
        }
      }
      draft.goals.push({
        id: randomUUID(),
        name: request.name.trim(),
        metric: request.metric,
        target: request.target,
        ...(request.manualCurrent === undefined ? {} : { manualCurrent: request.manualCurrent }),
        startAt: request.startAt,
        endAt: request.endAt,
        contentIds: unique(request.contentIds),
        primary: request.primary ?? false,
        contentTypeTargets: unique((request.contentTypeTargets ?? []).map((item) => item.contentType.trim())).map((contentType) => ({
          contentType,
          target: request.contentTypeTargets?.find((item) => item.contentType.trim() === contentType)?.target ?? 0,
        })),
        ...(request.followerStart === undefined ? {} : { followerStart: request.followerStart }),
        ...(request.followerTarget === undefined ? {} : { followerTarget: request.followerTarget }),
        note: request.note,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  }

  async updateGoal(request: UpdateGoalRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const timestamp = this.now();
    return this.store.update((draft) => {
      const goal = draft.goals.find((entry) => entry.id === request.id);
      if (goal === undefined) throw missing("goal", request.id);
      const patch = request.patch;
      if (patch.name !== undefined) goal.name = patch.name.trim();
      if (patch.target !== undefined) goal.target = patch.target;
      if (patch.startAt !== undefined) goal.startAt = patch.startAt;
      if (patch.endAt !== undefined) goal.endAt = patch.endAt;
      if (patch.contentIds !== undefined) goal.contentIds = unique(patch.contentIds);
      if (patch.primary === true) {
        for (const entry of draft.goals) entry.primary = entry.id === goal.id && entry.archivedAt === undefined;
      } else if (patch.primary === false) goal.primary = false;
      if (patch.contentTypeTargets !== undefined) {
        const names = unique(patch.contentTypeTargets.map((item) => item.contentType.trim()));
        goal.contentTypeTargets = names.map((contentType) => ({
          contentType,
          target: patch.contentTypeTargets?.find((item) => item.contentType.trim() === contentType)?.target ?? 0,
        }));
      }
      if (patch.followerStart === null) delete goal.followerStart;
      else if (patch.followerStart !== undefined) goal.followerStart = patch.followerStart;
      if (patch.followerTarget === null) delete goal.followerTarget;
      else if (patch.followerTarget !== undefined) goal.followerTarget = patch.followerTarget;
      if (patch.archived === true) {
        goal.archivedAt = goal.archivedAt ?? timestamp;
        goal.primary = false;
      } else if (patch.archived === false) delete goal.archivedAt;
      if (patch.note !== undefined) goal.note = patch.note;
      if (patch.manualCurrent === null) delete goal.manualCurrent;
      else if (patch.manualCurrent !== undefined) goal.manualCurrent = patch.manualCurrent;
      goal.updatedAt = timestamp;
    });
  }

  async deleteGoal(request: { id: string }, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    return this.store.update((draft) => {
      const next = draft.goals.filter((entry) => entry.id !== request.id);
      if (next.length === draft.goals.length) throw missing("goal", request.id);
      draft.goals = next;
      for (const idea of draft.ideas) {
        if (idea.goalId === request.id) delete idea.goalId;
      }
      for (const meta of Object.values(draft.contentMeta)) {
        meta.goalIds = meta.goalIds.filter((id) => id !== request.id);
      }
    });
  }

  async createFollowerSnapshot(
    request: CreateFollowerSnapshotRequest,
    signal: AbortSignal,
  ): Promise<CockpitState> {
    signal.throwIfAborted();
    return this.store.update((draft) => {
      draft.followerSnapshots.push({
        id: randomUUID(),
        followers: request.followers,
        capturedAt: request.capturedAt,
        ...(request.note === undefined || request.note.trim() === "" ? {} : { note: request.note.trim() }),
      });
      draft.followerSnapshots.sort((a, b) => a.capturedAt - b.capturedAt);
    });
  }

  async deleteFollowerSnapshot(request: { id: string }, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    return this.store.update((draft) => {
      const next = draft.followerSnapshots.filter((entry) => entry.id !== request.id);
      if (next.length === draft.followerSnapshots.length) throw missing("follower snapshot", request.id);
      draft.followerSnapshots = next;
    });
  }

  async createScheduleItem(request: CreateScheduleItemRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const timestamp = this.now();
    return this.store.update((draft) => {
      draft.scheduleItems.push({
        id: randomUUID(),
        kind: request.kind,
        milestone: request.milestone,
        title: request.title.trim(),
        ...(request.contentId === undefined ? {} : { contentId: request.contentId }),
        ...(request.typeId === undefined ? {} : { typeId: request.typeId }),
        plannedAt: request.plannedAt,
        rank: request.rank ?? draft.scheduleItems.filter((item) => item.plannedAt === request.plannedAt).length,
        note: request.note,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      draft.scheduleItems.sort((a, b) => a.plannedAt - b.plannedAt || a.rank - b.rank);
    });
  }

  async updateScheduleItem(request: UpdateScheduleItemRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const timestamp = this.now();
    return this.store.update((draft) => {
      const item = draft.scheduleItems.find((entry) => entry.id === request.id);
      if (item === undefined) throw missing("schedule item", request.id);
      const patch = request.patch;
      if (patch.kind !== undefined) item.kind = patch.kind;
      if (patch.milestone !== undefined) item.milestone = patch.milestone;
      if (patch.title !== undefined) item.title = patch.title.trim();
      if (patch.plannedAt !== undefined) item.plannedAt = patch.plannedAt;
      if (patch.rank !== undefined) item.rank = patch.rank;
      if (patch.note !== undefined) item.note = patch.note;
      if (patch.contentId === null) delete item.contentId;
      else if (patch.contentId !== undefined) item.contentId = patch.contentId;
      if (patch.typeId === null) delete item.typeId;
      else if (patch.typeId !== undefined) item.typeId = patch.typeId;
      if (patch.completed === true) item.completedAt = item.completedAt ?? timestamp;
      if (patch.completed === false) delete item.completedAt;
      item.updatedAt = timestamp;
      draft.scheduleItems.sort((a, b) => a.plannedAt - b.plannedAt || a.rank - b.rank);
    });
  }

  async deleteScheduleItem(request: { id: string }, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    return this.store.update((draft) => {
      const next = draft.scheduleItems.filter((entry) => entry.id !== request.id);
      if (next.length === draft.scheduleItems.length) throw missing("schedule item", request.id);
      draft.scheduleItems = next;
    });
  }

  async updateSettings(request: UpdateCockpitSettingsRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    return this.store.update((draft) => {
      if (request.reviewDelayDays !== undefined) draft.settings.reviewDelayDays = request.reviewDelayDays;
      if (request.contentTypes !== undefined) draft.settings.contentTypes = unique(request.contentTypes.map((value) => value.trim()).filter(Boolean));
      if (request.tiers !== undefined) draft.settings.tiers = unique(request.tiers.map((value) => value.trim()).filter(Boolean));
      if (request.tags !== undefined) draft.settings.tags = unique(request.tags.map((value) => value.trim()).filter(Boolean));
      if (request.scheduleTypes !== undefined) draft.settings.scheduleTypes = request.scheduleTypes.map((item) => ({ ...item, id: item.id.trim(), name: item.name.trim() }));
      if (request.milestoneColors !== undefined) draft.settings.milestoneColors = { ...request.milestoneColors };
    });
  }

  private requireOil(): OilCreatorService {
    if (this.oil === undefined) throw new Error("Jacky Creator content service is unavailable");
    return this.oil;
  }

  async getEvaluationContext(request: { id: string }, signal: AbortSignal) {
    signal.throwIfAborted();
    const content = await this.requireOil().getContent(request, signal);
    const inputFingerprint = evaluationFingerprint(content.topicNote, content.script);
    return {
      contentId: content.id,
      title: content.title,
      topicNote: content.topicNote,
      script: content.script,
      rubricVersion: EVALUATION_RUBRIC_VERSION,
      rubric: EVALUATION_RUBRIC,
      inputFingerprint,
    };
  }

  async saveEvaluation(request: SaveEvaluationRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const context = await this.getEvaluationContext({ id: request.contentId }, signal);
    if (request.rubricVersion !== context.rubricVersion || request.inputFingerprint !== context.inputFingerprint) {
      throw new Error("content changed after the evaluation context was read");
    }
    const timestamp = this.now();
    return this.store.update((draft) => {
      const meta = draft.contentMeta[request.contentId] ?? newContentMeta(request.contentId, timestamp);
      meta.evaluations.push({
        id: randomUUID(),
        contentId: request.contentId,
        rubricVersion: request.rubricVersion,
        scores: request.scores,
        total: evaluationTotal(request.scores),
        evidence: request.evidence,
        suggestions: request.suggestions,
        inputFingerprint: context.inputFingerprint,
        createdAt: timestamp,
      });
      meta.updatedAt = timestamp;
      draft.contentMeta[request.contentId] = meta;
    });
  }

  async getReviewContext(request: { id: string }, signal: AbortSignal) {
    signal.throwIfAborted();
    const content = await this.requireOil().getContent(request, signal);
    if (!Object.values(content.publish).some((entry) => entry.status === "published")) {
      throw new Error("a published content item is required for a post-publication review");
    }
    const state = await this.store.load();
    const meta = state.contentMeta[content.id];
    const context = {
      contentId: content.id,
      title: content.title,
      topicNote: content.topicNote,
      script: content.script,
      workflow: content.workflow,
      publish: content.publish,
      supplementalMetrics: meta?.supplementalMetrics,
      latestEvaluation: meta?.evaluations.at(-1),
    };
    return { ...context, inputFingerprint: reviewFingerprint(context) };
  }

  async saveReviewDraft(request: SaveReviewDraftRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const context = await this.getReviewContext({ id: request.contentId }, signal);
    if (request.inputFingerprint !== context.inputFingerprint) throw new Error("content or metrics changed after the review context was read");
    const timestamp = this.now();
    return this.store.update((draft) => {
      const meta = draft.contentMeta[request.contentId] ?? newContentMeta(request.contentId, timestamp);
      meta.reviews.push({
        id: randomUUID(),
        contentId: request.contentId,
        status: "draft",
        ...(request.rating === undefined ? {} : { rating: request.rating }),
        analysis: request.analysis,
        ...(request.learnedRule === undefined || request.learnedRule.trim() === "" ? {} : { learnedRule: request.learnedRule.trim() }),
        inputFingerprint: context.inputFingerprint,
        createdAt: timestamp,
      });
      meta.updatedAt = timestamp;
      draft.contentMeta[request.contentId] = meta;
    });
  }

  async saveManualReviewDraft(request: SaveManualReviewDraftRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const context = await this.getReviewContext({ id: request.contentId }, signal);
    return this.saveReviewDraft({ ...request, inputFingerprint: context.inputFingerprint }, signal);
  }

  async confirmReview(request: { contentId: string; id: string }, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const before = await this.store.load();
    const pending = before.contentMeta[request.contentId]?.reviews.find((entry) => entry.id === request.id);
    if (pending === undefined) throw missing("review", request.id);
    await writeKnowledgeMarkdown(this.store.dataDir, "reviews", pending.id, `内容复盘 ${request.contentId}`, pending.analysis);
    const timestamp = this.now();
    return this.store.update((draft) => {
      const review = draft.contentMeta[request.contentId]?.reviews.find((entry) => entry.id === request.id);
      if (review === undefined) throw missing("review", request.id);
      review.status = "confirmed";
      review.confirmedAt = review.confirmedAt ?? timestamp;
    });
  }

  async saveKnowledge(kind: "rules" | "templates", request: KnowledgeRequest, signal: AbortSignal) {
    signal.throwIfAborted();
    const review = (await this.store.load()).contentMeta[request.contentId]?.reviews.find((entry) => entry.id === request.reviewId);
    if (review?.status !== "confirmed") throw new Error("a confirmed review is required before knowledge can be saved");
    const path = await writeKnowledgeMarkdown(this.store.dataDir, kind, request.reviewId, request.title, request.body);
    const timestamp = this.now();
    let entryId = "";
    const state = await this.store.update((draft) => {
      const existing = draft.knowledgeItems.find((entry) => entry.sourceReviewId === request.reviewId && entry.kind === (kind === "rules" ? "rule" : "template"));
      if (existing !== undefined) {
        existing.title = request.title.trim();
        existing.body = request.body;
        existing.tags = unique((request.tags ?? []).map((tag) => tag.trim()).filter(Boolean));
        existing.markdownPath = path;
        existing.active = true;
        existing.updatedAt = timestamp;
        entryId = existing.id;
        return;
      }
      entryId = randomUUID();
      draft.knowledgeItems.push({
        id: entryId,
        kind: kind === "rules" ? "rule" : "template",
        title: request.title.trim(),
        body: request.body,
        tags: unique((request.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
        sourceContentId: request.contentId,
        sourceReviewId: request.reviewId,
        markdownPath: path,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
    return { state, path, entryId };
  }

  async saveRule(request: KnowledgeRequest, signal: AbortSignal) {
    return this.saveKnowledge("rules", request, signal);
  }

  async saveTemplate(request: KnowledgeRequest, signal: AbortSignal) {
    return this.saveKnowledge("templates", request, signal);
  }

  async updateKnowledge(request: UpdateKnowledgeRequest, signal: AbortSignal): Promise<CockpitState> {
    signal.throwIfAborted();
    const timestamp = this.now();
    return this.store.update((draft) => {
      const item = draft.knowledgeItems.find((entry) => entry.id === request.id);
      if (item === undefined) throw missing("knowledge", request.id);
      if (request.patch.title !== undefined) item.title = request.patch.title.trim();
      if (request.patch.body !== undefined) item.body = request.patch.body;
      if (request.patch.tags !== undefined) item.tags = unique(request.patch.tags.map((tag) => tag.trim()).filter(Boolean));
      if (request.patch.active !== undefined) item.active = request.patch.active;
      item.updatedAt = timestamp;
    });
  }

  async getScriptContext(request: { id: string }, signal: AbortSignal) {
    signal.throwIfAborted();
    const content = await this.requireOil().getContent(request, signal);
    const state = await this.store.load();
    const meta = state.contentMeta[content.id];
    const selected = (meta?.knowledgeIds ?? [])
      .map((id) => state.knowledgeItems.find((entry) => entry.id === id))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined && entry.active);
    const relevantGoals = state.goals.filter((goal) => goal.archivedAt === undefined && (goal.primary || meta?.goalIds.includes(goal.id)));
    return {
      contentId: content.id,
      title: content.title,
      topicNote: content.topicNote,
      strategy: {
        contentType: meta?.contentType,
        tier: meta?.tier,
        tags: meta?.tags ?? [],
        hookType: meta?.hookType,
        customHook: meta?.customHook,
        structureType: meta?.structureType,
        customStructure: meta?.customStructure,
      },
      goals: relevantGoals.map((goal) => ({
        id: goal.id,
        name: goal.name,
        metric: goal.metric,
        target: goal.target,
        startAt: goal.startAt,
        endAt: goal.endAt,
        primary: goal.primary,
        contentTypeTargets: goal.contentTypeTargets,
        note: goal.note,
      })),
      knowledge: selected.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        title: entry.title,
        body: entry.body,
        tags: entry.tags,
        sourceContentId: entry.sourceContentId,
        sourceReview: state.contentMeta[entry.sourceContentId]?.reviews.find((review) => review.id === entry.sourceReviewId && review.status === "confirmed") === undefined ? undefined : {
          rating: state.contentMeta[entry.sourceContentId]?.reviews.find((review) => review.id === entry.sourceReviewId)?.rating,
          analysis: state.contentMeta[entry.sourceContentId]?.reviews.find((review) => review.id === entry.sourceReviewId)?.analysis,
        },
      })),
      instruction: "Read jacky_creator_script_rules, use this Jacky operations context as supporting evidence, then write the finished draft to this content item's real script.md.",
    };
  }

  async promoteIdea(request: PromoteIdeaRequest, signal: AbortSignal): Promise<PromotionResult> {
    const existing = this.promotions.get(request.ideaId);
    if (existing !== undefined) return existing;
    const operation = this.promoteIdeaOnce(request, signal);
    this.promotions.set(request.ideaId, operation);
    try {
      return await operation;
    } finally {
      this.promotions.delete(request.ideaId);
    }
  }

  private async promoteIdeaOnce(request: PromoteIdeaRequest, signal: AbortSignal): Promise<PromotionResult> {
    signal.throwIfAborted();
    const before = await this.store.load();
    if (before.revision !== request.expectedRevision) throw new Error("cockpit state changed; reopen the promotion preview");
    const idea = before.ideas.find((entry) => entry.id === request.ideaId);
    if (idea === undefined) throw missing("idea", request.ideaId);
    if (idea.status === "promoted" && idea.promotedContentId !== undefined) {
      return { state: before, contentId: idea.promotedContentId, topicWritten: true };
    }
    const oil = this.requireOil();
    const listed = await oil.listContents({ query: "", filter: "all" }, signal);
    const created = await oil.createContent({ title: request.title }, signal);
    try {
      await validateCreatedContentPath(listed.settings.libraryRoot, created.folderPath);
    } catch (error) {
      throw new Error(`内容 ${created.id} 已创建在 ${created.folderPath}，但路径安全校验失败；请先人工核对，勿直接重试。原因：${error instanceof Error ? error.message : String(error)}`);
    }
    let topicWritten = true;
    let recovery: string | undefined;
    try {
      await oil.setTopicNote({ id: created.id, text: request.topicNote }, signal);
    } catch (error) {
      topicWritten = false;
      recovery = `内容已创建在 ${created.folderPath}，请手动把预览文本写入 topic.md。原因：${error instanceof Error ? error.message : String(error)}`;
    }
    const timestamp = this.now();
    let state: CockpitState;
    try {
      state = await this.store.update((draft) => {
        const current = draft.ideas.find((entry) => entry.id === request.ideaId);
        if (current === undefined) throw missing("idea", request.ideaId);
        if (current.status === "promoted") throw new Error("idea was already promoted");
        current.status = "promoted";
        current.promotedContentId = created.id;
        current.updatedAt = timestamp;
      });
    } catch (error) {
      throw new Error(`内容 ${created.id} 已创建在 ${created.folderPath}，但灵感状态未能关联；请人工核对后再处理，勿直接重试。原因：${error instanceof Error ? error.message : String(error)}`);
    }
    return { state, contentId: created.id, folderPath: created.folderPath, topicWritten, ...(recovery === undefined ? {} : { recovery }) };
  }
}
