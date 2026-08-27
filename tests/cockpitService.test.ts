import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CreatorCockpitService } from "../src/cockpit/service.ts";
import { CockpitStore } from "../src/cockpit/store.ts";

async function serviceAt(now = 1_000, oil?: object): Promise<CreatorCockpitService> {
  const folder = await mkdtemp(join(tmpdir(), "creator-cockpit-service-"));
  const service = Object.create(CreatorCockpitService.prototype) as CreatorCockpitService;
  Object.assign(service, { store: new CockpitStore(folder), now: () => now, oil, promotions: new Map() });
  return service;
}

const signal = () => new AbortController().signal;

describe("CreatorCockpitService CRUD", () => {
  it("stores ideas and metadata without duplicating content facts", async () => {
    const service = await serviceAt();
    let state = await service.createIdea({
      title: "  Harness 运营复盘  ",
      note: "一句话说明",
      tags: ["AI", "AI", " 工作流 "],
    }, signal());
    const idea = state.ideas[0]!;
    expect(idea).toMatchObject({
      title: "Harness 运营复盘",
      tags: ["AI", "工作流"],
      status: "inbox",
      createdAt: 1_000,
    });

    state = await service.updateIdea({
      id: idea.id,
      patch: { status: "considering", source: "访谈" },
    }, signal());
    expect(state.ideas[0]).toMatchObject({ status: "considering", source: "访谈" });

    state = await service.setContentMeta({
      contentId: "content-1",
      patch: {
        priority: "high",
        nextAction: "补齐案例证据",
        supplementalMetrics: { saves: 12 },
      },
    }, signal());
    expect(state.contentMeta["content-1"]).toEqual({
      contentId: "content-1",
      priority: "high",
      nextAction: "补齐案例证据",
      tags: [],
      knowledgeIds: [],
      goalIds: [],
      supplementalMetrics: { saves: 12 },
      evaluations: [],
      reviews: [],
      updatedAt: 1_000,
    });
    state = await service.createScheduleItem({
      kind: "content",
      milestone: "script",
      title: "补齐案例证据",
      contentId: "content-1",
      plannedAt: 2_000,
      note: "",
    }, signal());
    expect(state.scheduleItems[0]).toMatchObject({
      kind: "content",
      milestone: "script",
      title: "补齐案例证据",
      contentId: "content-1",
      plannedAt: 2_000,
      rank: 0,
    });
    expect(state.contentMeta["content-1"]?.supplementalMetrics?.followerGain).toBeUndefined();
  });

  it("creates goals and removes their references when deleted", async () => {
    const service = await serviceAt();
    let state = await service.createGoal({
      name: "每周发布",
      metric: "published",
      target: 3,
      startAt: 1_000,
      endAt: 9_000,
      contentIds: ["content-1", "content-1"],
      note: "",
    }, signal());
    const goal = state.goals[0]!;
    expect(goal.contentIds).toEqual(["content-1"]);

    state = await service.setContentMeta({
      contentId: "content-1",
      patch: { goalIds: [goal.id] },
    }, signal());
    expect(state.contentMeta["content-1"]?.goalIds).toEqual([goal.id]);

    state = await service.deleteGoal({ id: goal.id }, signal());
    expect(state.goals).toEqual([]);
    expect(state.contentMeta["content-1"]?.goalIds).toEqual([]);
  });

  it("persists follower snapshots in chronological order", async () => {
    const service = await serviceAt();
    await service.createFollowerSnapshot({ followers: 120, capturedAt: 2_000 }, signal());
    const state = await service.createFollowerSnapshot({ followers: 100, capturedAt: 1_000 }, signal());
    expect(state.followerSnapshots.map((entry) => entry.followers)).toEqual([100, 120]);
    expect(state.revision).toBe(2);
  });

  it("stores schedule items, customizable options, and script strategy without copying a script", async () => {
    const content = { id: "content-1", title: "Demo", topicNote: "真实选题", script: "原脚本" };
    const service = await serviceAt(5_000, { getContent: async () => content });
    let state = await service.updateSettings({
      contentTypes: ["教程", "教程", "案例"],
      tiers: ["S", "A"],
      tags: ["AI", "实测"],
    }, signal());
    expect(state.settings.contentTypes).toEqual(["教程", "案例"]);
    state = await service.createScheduleItem({
      kind: "content",
      milestone: "script",
      title: "完成脚本",
      contentId: content.id,
      plannedAt: 8_000,
      note: "",
    }, signal());
    const schedule = state.scheduleItems[0]!;
    expect(schedule).toMatchObject({ title: "完成脚本", contentId: content.id });
    expect(schedule.completedAt).toBeUndefined();
    state = await service.updateScheduleItem({ id: schedule.id, patch: { completed: true } }, signal());
    expect(state.scheduleItems[0]?.completedAt).toBe(5_000);
    state = await service.setContentMeta({
      contentId: content.id,
      patch: {
        contentType: "教程",
        tier: "S",
        tags: ["AI"],
        hookType: "proof",
        structureType: "result-method-proof",
      },
    }, signal());
    expect(state.contentMeta[content.id]).not.toHaveProperty("script");
    const context = await service.getScriptContext({ id: content.id }, signal());
    expect(context).toMatchObject({
      topicNote: "真实选题",
      strategy: { contentType: "教程", tier: "S", hookType: "proof" },
      knowledge: [],
    });
    expect(context).not.toHaveProperty("script");
  });

  it("recomputes evaluation totals and rejects a stale fingerprint", async () => {
    const content = { id: "content-1", title: "Demo", topicNote: "topic", script: "script" };
    const oil = { getContent: async () => content };
    const service = await serviceAt(2_000, oil);
    const context = await service.getEvaluationContext({ id: content.id }, signal());
    const state = await service.saveEvaluation({
      contentId: content.id,
      rubricVersion: context.rubricVersion,
      scores: { audience: 5, pain: 4, differentiation: 3, assets: 2, hook: 1, structure: 0 },
      evidence: { audience: "明确" },
      suggestions: ["补证据"],
      inputFingerprint: context.inputFingerprint,
    }, signal());
    expect(state.contentMeta[content.id]?.evaluations[0]?.total).toBe(15);
    await expect(service.saveEvaluation({
      contentId: content.id,
      rubricVersion: context.rubricVersion,
      scores: { audience: 1, pain: 1, differentiation: 1, assets: 1, hook: 1, structure: 1 },
      evidence: {},
      suggestions: [],
      inputFingerprint: "stale",
    }, signal())).rejects.toThrow("content changed");
    expect((await service.store.load()).revision).toBe(1);
  });

  it("keeps AI reviews as drafts until confirmation writes review Markdown", async () => {
    const content = {
      id: "content-1",
      title: "Demo",
      topicNote: "topic",
      script: "script",
      workflow: "live",
      publish: { bilibili: { status: "published", syncedAt: 1_000 } },
    };
    const service = await serviceAt(3_000, { getContent: async () => content });
    const context = await service.getReviewContext({ id: content.id }, signal());
    let state = await service.saveReviewDraft({
      contentId: content.id,
      rating: 4,
      analysis: "有效证据",
      learnedRule: "保留真实案例",
      inputFingerprint: context.inputFingerprint,
    }, signal());
    const review = state.contentMeta[content.id]?.reviews[0]!;
    expect(review.status).toBe("draft");
    state = await service.confirmReview({ contentId: content.id, id: review.id }, signal());
    expect(state.contentMeta[content.id]?.reviews[0]).toMatchObject({ status: "confirmed", confirmedAt: 3_000 });
    const saved = await service.saveRule({ contentId: content.id, reviewId: review.id, title: "规则", body: "保留真实案例", tags: ["案例"] }, signal());
    expect(saved).toMatchObject({ path: expect.stringContaining("knowledge/rules") });
    expect(saved.state.knowledgeItems[0]).toMatchObject({ kind: "rule", title: "规则", tags: ["案例"], active: true });
  });

  it("lets a person save a review draft without an AI context fingerprint", async () => {
    const content = {
      id: "content-1",
      title: "Demo",
      topicNote: "topic",
      script: "script",
      workflow: "live",
      publish: { bilibili: { status: "published", publishedAt: 1_000 } },
    };
    const service = await serviceAt(3_000, { getContent: async () => content });
    const state = await (service as CreatorCockpitService & {
      saveManualReviewDraft: (
        request: { contentId: string; rating?: number; analysis: string; learnedRule?: string },
        signal: AbortSignal,
      ) => Promise<Awaited<ReturnType<CreatorCockpitService["getState"]>>>;
    }).saveManualReviewDraft({
      contentId: content.id,
      rating: 4,
      analysis: "结果：已发布\n有效做法：案例清楚\n问题：开头偏慢\n下一次实验：先给结果",
      learnedRule: "真实案例前置",
    }, signal());

    expect(state.contentMeta[content.id]?.reviews[0]).toMatchObject({
      status: "draft",
      rating: 4,
      learnedRule: "真实案例前置",
    });
  });

  it("keeps a review draft when its confirmed Markdown cannot be written", async () => {
    const content = { id: "content-1", title: "Demo", topicNote: "topic", script: "script", workflow: "live", publish: { bilibili: { status: "published", syncedAt: 1_000 } } };
    const service = await serviceAt(3_000, { getContent: async () => content });
    const context = await service.getReviewContext({ id: content.id }, signal());
    const state = await service.saveReviewDraft({
      contentId: content.id,
      analysis: "有效证据",
      inputFingerprint: context.inputFingerprint,
    }, signal());
    const review = state.contentMeta[content.id]?.reviews[0]!;
    await writeFile(join(service.store.dataDir, "knowledge", "reviews", `内容复盘 content-1-${review.id}.md`), "different\n", "utf8");

    await expect(service.confirmReview({ contentId: content.id, id: review.id }, signal())).rejects.toThrow("different content");
    expect((await service.store.load()).contentMeta[content.id]?.reviews[0]?.status).toBe("draft");
  });

  it("refuses to draft a post-publication review for unpublished content", async () => {
    const content = { id: "content-1", title: "Demo", topicNote: "topic", script: "script", workflow: "record", publish: {} };
    const service = await serviceAt(3_000, { getContent: async () => content });
    await expect(service.getReviewContext({ id: content.id }, signal())).rejects.toThrow("published content");
  });

  it("promotes one idea only once when confirmations race", async () => {
    const libraryRoot = await mkdtemp(join(tmpdir(), "creator-cockpit-library-"));
    const folderPath = join(libraryRoot, "2026-08-24_demo");
    await mkdir(folderPath);
    let creates = 0;
    const oil = {
      listContents: async () => ({ settings: { libraryRoot } }),
      createContent: async () => { creates += 1; return { id: "content-1", folderPath }; },
      setTopicNote: async () => ({}),
    };
    const service = await serviceAt(4_000, oil);
    const state = await service.createIdea({ title: "Demo", note: "Topic", tags: [] }, signal());
    const request = { ideaId: state.ideas[0]!.id, expectedRevision: state.revision, title: "Demo", topicNote: "Topic" };
    const [first, second] = await Promise.all([service.promoteIdea(request, signal()), service.promoteIdea(request, signal())]);
    expect(creates).toBe(1);
    expect(first.contentId).toBe("content-1");
    expect(second.contentId).toBe("content-1");
    expect(first.state.ideas[0]).toMatchObject({ status: "promoted", promotedContentId: "content-1" });
  });
});
