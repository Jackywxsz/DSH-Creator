import { z } from "zod";

export const COCKPIT_SCHEMA_VERSION = 3 as const;

export const DEFAULT_CONTENT_TYPES = ["观点", "教程", "案例", "工具实测"] as const;
export const DEFAULT_TIERS = ["S", "A", "B"] as const;
export const DEFAULT_TAGS = ["AI", "创作", "效率", "商业"] as const;
export const DEFAULT_SCHEDULE_TYPES = [
  { id: "review-day", name: "复盘日", color: "#ff4054", archived: false },
  { id: "live-session", name: "直播", color: "#008e67", archived: false },
  { id: "custom", name: "其他事项", color: "#1f5fff", archived: false },
] as const;
export const DEFAULT_MILESTONE_COLORS = {
  topic: "#1f5fff",
  script: "#7b61a8",
  recording: "#e45c27",
  editing: "#008e67",
  publishing: "#ff4054",
  review: "#a36a45",
  custom: "#59606d",
} as const;

export const ideaStatusSchema = z.enum(["inbox", "considering", "promoted", "archived"]);
export const prioritySchema = z.enum(["low", "normal", "high"]);
export const hookTypeSchema = z.enum([
  "information-gap",
  "nonconsensus",
  "pain",
  "result",
  "value-promise",
  "identity",
  "contrast",
  "proof",
  "custom",
]);
export const structureTypeSchema = z.enum([
  "pyramid",
  "problem-cause-solution",
  "result-method-proof",
  "pain-misconception-solution",
  "value-steps-delivery",
  "comparison-judgment",
  "story-turn-insight",
  "list",
  "case-study",
  "custom",
]);
export const scheduleKindSchema = z.enum(["content", "review", "live", "custom"]);
export const scheduleMilestoneSchema = z.enum([
  "topic",
  "script",
  "recording",
  "editing",
  "publishing",
  "review",
  "custom",
]);
export const knowledgeKindSchema = z.enum(["rule", "template"]);
export const goalMetricSchema = z.enum([
  "published",
  "views",
  "likes",
  "comments",
  "followers",
  "custom",
]);

export const evaluationScoresSchema = z.object({
  audience: z.number().int().min(0).max(5),
  pain: z.number().int().min(0).max(5),
  differentiation: z.number().int().min(0).max(5),
  assets: z.number().int().min(0).max(5),
  hook: z.number().int().min(0).max(5),
  structure: z.number().int().min(0).max(5),
}).strict();

export const contentEvaluationSchema = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  rubricVersion: z.string().min(1),
  scores: evaluationScoresSchema,
  total: z.number().int().min(0).max(30),
  evidence: z.record(z.string(), z.string()),
  suggestions: z.array(z.string()),
  inputFingerprint: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  confirmedAt: z.number().int().nonnegative().optional(),
}).strict().superRefine((evaluation, context) => {
  const total = Object.values(evaluation.scores).reduce((sum, score) => sum + score, 0);
  if (evaluation.total !== total) context.addIssue({ code: "custom", message: "evaluation total must equal score sum", path: ["total"] });
});

export const contentReviewSchema = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  status: z.enum(["draft", "confirmed"]),
  rating: z.number().int().min(1).max(5).optional(),
  analysis: z.string(),
  learnedRule: z.string().optional(),
  inputFingerprint: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  confirmedAt: z.number().int().nonnegative().optional(),
}).strict().superRefine((review, context) => {
  if (review.status === "confirmed" && review.confirmedAt === undefined) context.addIssue({ code: "custom", message: "confirmed review requires confirmedAt", path: ["confirmedAt"] });
  if (review.status === "draft" && review.confirmedAt !== undefined) context.addIssue({ code: "custom", message: "draft review cannot have confirmedAt", path: ["confirmedAt"] });
});

export const supplementalMetricsSchema = z.object({
  saves: z.number().int().nonnegative().optional(),
  followerGain: z.number().int().optional(),
  clickRate: z.number().min(0).max(100).optional(),
  retentionRate: z.number().min(0).max(100).optional(),
  note: z.string().optional(),
}).strict();

export const ideaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  note: z.string(),
  source: z.string().optional(),
  tags: z.array(z.string()),
  contentType: z.string().optional(),
  tier: z.string().optional(),
  status: ideaStatusSchema,
  goalId: z.string().min(1).optional(),
  promotedContentId: z.string().min(1).optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict();

export const contentOperationsMetaSchema = z.object({
  contentId: z.string().min(1),
  contentType: z.string().optional(),
  tier: z.string().optional(),
  priority: prioritySchema.optional(),
  nextAction: z.string().optional(),
  tags: z.array(z.string()),
  hookType: hookTypeSchema.optional(),
  customHook: z.string().optional(),
  structureType: structureTypeSchema.optional(),
  customStructure: z.string().optional(),
  knowledgeIds: z.array(z.string().min(1)),
  goalIds: z.array(z.string().min(1)),
  supplementalMetrics: supplementalMetricsSchema.optional(),
  evaluations: z.array(contentEvaluationSchema),
  reviews: z.array(contentReviewSchema),
  updatedAt: z.number().int().nonnegative(),
}).strict();

export const scheduleItemSchema = z.object({
  id: z.string().min(1),
  kind: scheduleKindSchema,
  milestone: scheduleMilestoneSchema,
  title: z.string().min(1),
  contentId: z.string().min(1).optional(),
  typeId: z.string().min(1).optional(),
  plannedAt: z.number().int().nonnegative(),
  rank: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative().optional(),
  note: z.string(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict();

export const knowledgeItemSchema = z.object({
  id: z.string().min(1),
  kind: knowledgeKindSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string()),
  sourceContentId: z.string().min(1),
  sourceReviewId: z.string().min(1),
  markdownPath: z.string().min(1),
  active: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict();

export const goalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  metric: goalMetricSchema,
  target: z.number().nonnegative(),
  manualCurrent: z.number().optional(),
  startAt: z.number().int().nonnegative(),
  endAt: z.number().int().nonnegative(),
  contentIds: z.array(z.string().min(1)),
  primary: z.boolean(),
  contentTypeTargets: z.array(z.object({
    contentType: z.string().trim().min(1).max(120),
    target: z.number().int().nonnegative(),
  }).strict()),
  followerStart: z.number().int().nonnegative().optional(),
  followerTarget: z.number().int().nonnegative().optional(),
  archivedAt: z.number().int().nonnegative().optional(),
  note: z.string(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict().superRefine((goal, context) => {
  if (goal.endAt < goal.startAt) {
    context.addIssue({ code: "custom", message: "endAt must not be earlier than startAt", path: ["endAt"] });
  }
  if (goal.metric !== "custom" && goal.manualCurrent !== undefined) {
    context.addIssue({ code: "custom", message: "manualCurrent is only valid for custom goals", path: ["manualCurrent"] });
  }
  const quotaTotal = goal.contentTypeTargets.reduce((sum, item) => sum + item.target, 0);
  if (goal.primary && quotaTotal > goal.target) {
    context.addIssue({ code: "custom", message: "content type targets cannot exceed the output target", path: ["contentTypeTargets"] });
  }
});

export const followerSnapshotSchema = z.object({
  id: z.string().min(1),
  followers: z.number().int().nonnegative(),
  capturedAt: z.number().int().nonnegative(),
  note: z.string().optional(),
}).strict();

export const scheduleTypeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  archived: z.boolean(),
}).strict();

export const milestoneColorsSchema = z.object({
  topic: z.string().regex(/^#[0-9a-f]{6}$/i),
  script: z.string().regex(/^#[0-9a-f]{6}$/i),
  recording: z.string().regex(/^#[0-9a-f]{6}$/i),
  editing: z.string().regex(/^#[0-9a-f]{6}$/i),
  publishing: z.string().regex(/^#[0-9a-f]{6}$/i),
  review: z.string().regex(/^#[0-9a-f]{6}$/i),
  custom: z.string().regex(/^#[0-9a-f]{6}$/i),
}).strict();

export const cockpitSettingsSchema = z.object({
  reviewDelayDays: z.number().int().min(0).max(30),
  contentTypes: z.array(z.string().trim().min(1).max(120)).max(100),
  tiers: z.array(z.string().trim().min(1).max(80)).max(100),
  tags: z.array(z.string().trim().min(1).max(80)).max(300),
  scheduleTypes: z.array(scheduleTypeSchema).max(100),
  milestoneColors: milestoneColorsSchema,
}).strict();

export const cockpitStateSchema = z.object({
  schemaVersion: z.literal(COCKPIT_SCHEMA_VERSION),
  revision: z.number().int().nonnegative(),
  ideas: z.array(ideaSchema),
  contentMeta: z.record(z.string(), contentOperationsMetaSchema),
  goals: z.array(goalSchema),
  followerSnapshots: z.array(followerSnapshotSchema),
  scheduleItems: z.array(scheduleItemSchema),
  knowledgeItems: z.array(knowledgeItemSchema),
  settings: cockpitSettingsSchema,
}).strict().superRefine((state, context) => {
  const goalIds = new Set(state.goals.map((goal) => goal.id));
  const uniqueIds = (values: string[], path: Array<string | number>): void => {
    if (new Set(values).size !== values.length) context.addIssue({ code: "custom", message: "ids must be unique", path });
  };
  uniqueIds(state.ideas.map((idea) => idea.id), ["ideas"]);
  uniqueIds(state.goals.map((goal) => goal.id), ["goals"]);
  uniqueIds(state.followerSnapshots.map((snapshot) => snapshot.id), ["followerSnapshots"]);
  uniqueIds(state.scheduleItems.map((item) => item.id), ["scheduleItems"]);
  uniqueIds(state.knowledgeItems.map((item) => item.id), ["knowledgeItems"]);
  uniqueIds(state.settings.scheduleTypes.map((item) => item.id), ["settings", "scheduleTypes"]);
  const activePrimaryGoals = state.goals.filter((goal) => goal.primary && goal.archivedAt === undefined);
  if (activePrimaryGoals.length > 1) context.addIssue({ code: "custom", message: "only one active primary goal is allowed", path: ["goals"] });
  const knowledgeIds = new Set(state.knowledgeItems.map((item) => item.id));
  for (const [index, idea] of state.ideas.entries()) {
    if (idea.goalId !== undefined && !goalIds.has(idea.goalId)) context.addIssue({ code: "custom", message: "idea goalId must reference a goal", path: ["ideas", index, "goalId"] });
    if ((idea.status === "promoted") !== (idea.promotedContentId !== undefined)) context.addIssue({ code: "custom", message: "promoted status and promotedContentId must agree", path: ["ideas", index, "promotedContentId"] });
  }
  for (const [key, meta] of Object.entries(state.contentMeta)) {
    if (key !== meta.contentId) {
      context.addIssue({
        code: "custom",
        message: "contentMeta key must match contentId",
        path: ["contentMeta", key, "contentId"],
      });
    }
    uniqueIds(meta.goalIds, ["contentMeta", key, "goalIds"]);
    uniqueIds(meta.evaluations.map((evaluation) => evaluation.id), ["contentMeta", key, "evaluations"]);
    uniqueIds(meta.reviews.map((review) => review.id), ["contentMeta", key, "reviews"]);
    uniqueIds(meta.tags, ["contentMeta", key, "tags"]);
    uniqueIds(meta.knowledgeIds, ["contentMeta", key, "knowledgeIds"]);
    for (const goalId of meta.goalIds) {
      if (!goalIds.has(goalId)) context.addIssue({ code: "custom", message: "content goalId must reference a goal", path: ["contentMeta", key, "goalIds"] });
    }
    for (const knowledgeId of meta.knowledgeIds) {
      if (!knowledgeIds.has(knowledgeId)) context.addIssue({ code: "custom", message: "content knowledgeId must reference knowledge", path: ["contentMeta", key, "knowledgeIds"] });
    }
  }
});

export const createIdeaRequestSchema = z.object({
  title: z.string().trim().min(1).max(240),
  note: z.string().max(20_000),
  source: z.string().max(2_000).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(50),
  contentType: z.string().trim().min(1).max(120).optional(),
  tier: z.string().trim().min(1).max(80).optional(),
  goalId: z.string().min(1).optional(),
}).strict();

export const updateIdeaRequestSchema = z.object({
  id: z.string().min(1),
  patch: z.object({
    title: z.string().trim().min(1).max(240).optional(),
    note: z.string().max(20_000).optional(),
    source: z.string().max(2_000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    contentType: z.string().trim().min(1).max(120).nullable().optional(),
    tier: z.string().trim().min(1).max(80).nullable().optional(),
    status: z.enum(["inbox", "considering", "archived"]).optional(),
    goalId: z.string().min(1).nullable().optional(),
  }).strict(),
}).strict();

export const idRequestSchema = z.object({ id: z.string().min(1) }).strict();

export const setContentMetaRequestSchema = z.object({
  contentId: z.string().min(1),
  patch: z.object({
    contentType: z.string().max(120).nullable().optional(),
    tier: z.string().max(80).nullable().optional(),
    priority: prioritySchema.nullable().optional(),
    nextAction: z.string().max(2_000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    hookType: hookTypeSchema.nullable().optional(),
    customHook: z.string().max(2_000).nullable().optional(),
    structureType: structureTypeSchema.nullable().optional(),
    customStructure: z.string().max(2_000).nullable().optional(),
    knowledgeIds: z.array(z.string().min(1)).max(200).optional(),
    goalIds: z.array(z.string().min(1)).max(100).optional(),
    supplementalMetrics: supplementalMetricsSchema.nullable().optional(),
  }).strict(),
}).strict();

export const createGoalRequestSchema = z.object({
  name: z.string().trim().min(1).max(240),
  metric: goalMetricSchema,
  target: z.number().nonnegative(),
  manualCurrent: z.number().optional(),
  startAt: z.number().int().nonnegative(),
  endAt: z.number().int().nonnegative(),
  contentIds: z.array(z.string().min(1)).max(500),
  primary: z.boolean().optional(),
  contentTypeTargets: z.array(z.object({ contentType: z.string().trim().min(1).max(120), target: z.number().int().nonnegative() }).strict()).max(100).optional(),
  followerStart: z.number().int().nonnegative().optional(),
  followerTarget: z.number().int().nonnegative().optional(),
  note: z.string().max(20_000),
}).strict().superRefine((goal, context) => {
  if (goal.endAt < goal.startAt) {
    context.addIssue({ code: "custom", message: "endAt must not be earlier than startAt", path: ["endAt"] });
  }
  if (goal.metric !== "custom" && goal.manualCurrent !== undefined) {
    context.addIssue({ code: "custom", message: "manualCurrent is only valid for custom goals", path: ["manualCurrent"] });
  }
});

export const updateGoalRequestSchema = z.object({
  id: z.string().min(1),
  patch: z.object({
    name: z.string().min(1).max(240).optional(),
    target: z.number().nonnegative().optional(),
    manualCurrent: z.number().nullable().optional(),
    startAt: z.number().int().nonnegative().optional(),
    endAt: z.number().int().nonnegative().optional(),
    contentIds: z.array(z.string().min(1)).max(500).optional(),
    primary: z.boolean().optional(),
    contentTypeTargets: z.array(z.object({ contentType: z.string().trim().min(1).max(120), target: z.number().int().nonnegative() }).strict()).max(100).optional(),
    followerStart: z.number().int().nonnegative().nullable().optional(),
    followerTarget: z.number().int().nonnegative().nullable().optional(),
    archived: z.boolean().optional(),
    note: z.string().max(20_000).optional(),
  }).strict(),
}).strict();

export const createFollowerSnapshotRequestSchema = followerSnapshotSchema.pick({
  followers: true,
  capturedAt: true,
  note: true,
}).strict();

export const createScheduleItemRequestSchema = scheduleItemSchema.pick({
  kind: true,
  milestone: true,
  title: true,
  contentId: true,
  typeId: true,
  plannedAt: true,
  rank: true,
  note: true,
}).extend({
  rank: z.number().int().nonnegative().optional(),
}).strict();

export const updateScheduleItemRequestSchema = z.object({
  id: z.string().min(1),
  patch: z.object({
    kind: scheduleKindSchema.optional(),
    milestone: scheduleMilestoneSchema.optional(),
    title: z.string().trim().min(1).max(240).optional(),
    contentId: z.string().min(1).nullable().optional(),
    typeId: z.string().min(1).nullable().optional(),
    plannedAt: z.number().int().nonnegative().optional(),
    rank: z.number().int().nonnegative().optional(),
    completed: z.boolean().optional(),
    note: z.string().max(20_000).optional(),
  }).strict(),
}).strict();

export const updateCockpitSettingsRequestSchema = z.object({
  reviewDelayDays: z.number().int().min(0).max(30).optional(),
  contentTypes: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
  tiers: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(300).optional(),
  scheduleTypes: z.array(scheduleTypeSchema).max(100).optional(),
  milestoneColors: milestoneColorsSchema.optional(),
}).strict();

export const restoreCockpitStateRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  state: z.unknown(),
}).strict();

export const saveEvaluationRequestSchema = z.object({
  contentId: z.string().min(1),
  rubricVersion: z.string().min(1),
  scores: evaluationScoresSchema,
  evidence: z.record(z.string(), z.string().max(10_000)),
  suggestions: z.array(z.string().max(10_000)).max(50),
  inputFingerprint: z.string().min(1),
}).strict();

export const saveReviewDraftRequestSchema = z.object({
  contentId: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional(),
  analysis: z.string().min(1).max(50_000),
  learnedRule: z.string().max(20_000).optional(),
  inputFingerprint: z.string().min(1),
}).strict();

export const saveManualReviewDraftRequestSchema = saveReviewDraftRequestSchema.omit({
  inputFingerprint: true,
});

export const contentRecordRequestSchema = z.object({
  contentId: z.string().min(1),
  id: z.string().min(1),
}).strict();

export const promoteIdeaRequestSchema = z.object({
  ideaId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(240),
  topicNote: z.string().max(50_000),
}).strict();

export const knowledgeRequestSchema = z.object({
  contentId: z.string().min(1),
  reviewId: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  body: z.string().min(1).max(50_000),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
}).strict();

export const updateKnowledgeRequestSchema = z.object({
  id: z.string().min(1),
  patch: z.object({
    title: z.string().trim().min(1).max(240).optional(),
    body: z.string().min(1).max(50_000).optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    active: z.boolean().optional(),
  }).strict(),
}).strict();

export const promotionResultSchema = z.object({
  state: cockpitStateSchema,
  contentId: z.string().min(1),
  folderPath: z.string().min(1).optional(),
  topicWritten: z.boolean(),
  recovery: z.string().optional(),
}).strict();

export const knowledgeResultSchema = z.object({
  state: cockpitStateSchema,
  path: z.string().min(1),
  entryId: z.string().min(1),
}).strict();

export const cockpitRevisionSchema = z.object({ revision: z.number().int().nonnegative() }).strict();
export const emptyRequestSchema = z.object({}).strict();

export type CockpitState = z.infer<typeof cockpitStateSchema>;
export type Idea = z.infer<typeof ideaSchema>;
export type ContentOperationsMeta = z.infer<typeof contentOperationsMetaSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type FollowerSnapshot = z.infer<typeof followerSnapshotSchema>;
export type ScheduleItem = z.infer<typeof scheduleItemSchema>;
export type KnowledgeItem = z.infer<typeof knowledgeItemSchema>;
export type CreateIdeaRequest = z.infer<typeof createIdeaRequestSchema>;
export type UpdateIdeaRequest = z.infer<typeof updateIdeaRequestSchema>;
export type SetContentMetaRequest = z.infer<typeof setContentMetaRequestSchema>;
export type CreateGoalRequest = z.infer<typeof createGoalRequestSchema>;
export type UpdateGoalRequest = z.infer<typeof updateGoalRequestSchema>;
export type CreateFollowerSnapshotRequest = z.infer<typeof createFollowerSnapshotRequestSchema>;
export type CreateScheduleItemRequest = z.infer<typeof createScheduleItemRequestSchema>;
export type UpdateScheduleItemRequest = z.infer<typeof updateScheduleItemRequestSchema>;
export type UpdateCockpitSettingsRequest = z.infer<typeof updateCockpitSettingsRequestSchema>;
export type RestoreCockpitStateRequest = z.infer<typeof restoreCockpitStateRequestSchema>;
export type EvaluationScores = z.infer<typeof evaluationScoresSchema>;
export type SaveEvaluationRequest = z.infer<typeof saveEvaluationRequestSchema>;
export type SaveReviewDraftRequest = z.infer<typeof saveReviewDraftRequestSchema>;
export type SaveManualReviewDraftRequest = z.infer<typeof saveManualReviewDraftRequestSchema>;
export type PromoteIdeaRequest = z.infer<typeof promoteIdeaRequestSchema>;
export type KnowledgeRequest = z.infer<typeof knowledgeRequestSchema>;
export type UpdateKnowledgeRequest = z.infer<typeof updateKnowledgeRequestSchema>;
export type PromotionResult = z.infer<typeof promotionResultSchema>;
