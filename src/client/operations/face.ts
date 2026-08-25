import type {
  CockpitState,
  CreateFollowerSnapshotRequest,
  CreateGoalRequest,
  CreateIdeaRequest,
  CreateScheduleItemRequest,
  SetContentMetaRequest,
  UpdateGoalRequest,
  UpdateIdeaRequest,
  UpdateCockpitSettingsRequest,
  UpdateKnowledgeRequest,
  UpdateScheduleItemRequest,
  KnowledgeRequest,
  PromoteIdeaRequest,
  PromotionResult,
  RestoreCockpitStateRequest,
} from "../../cockpit/schemas.ts";

export interface CreatorCockpitFace {
  cockpitReady: () => boolean;
  getCockpitState: () => Promise<CockpitState>;
  getCockpitRevision: () => Promise<number>;
  restoreState: (request: RestoreCockpitStateRequest) => Promise<CockpitState>;
  createIdea: (request: CreateIdeaRequest) => Promise<CockpitState>;
  updateIdea: (request: UpdateIdeaRequest) => Promise<CockpitState>;
  deleteIdea: (id: string) => Promise<CockpitState>;
  setContentMeta: (request: SetContentMetaRequest) => Promise<CockpitState>;
  deleteContentMeta: (contentId: string) => Promise<CockpitState>;
  createGoal: (request: CreateGoalRequest) => Promise<CockpitState>;
  updateGoal: (request: UpdateGoalRequest) => Promise<CockpitState>;
  deleteGoal: (id: string) => Promise<CockpitState>;
  createFollowerSnapshot: (request: CreateFollowerSnapshotRequest) => Promise<CockpitState>;
  deleteFollowerSnapshot: (id: string) => Promise<CockpitState>;
  createScheduleItem: (request: CreateScheduleItemRequest) => Promise<CockpitState>;
  updateScheduleItem: (request: UpdateScheduleItemRequest) => Promise<CockpitState>;
  deleteScheduleItem: (id: string) => Promise<CockpitState>;
  updateSettings: (request: UpdateCockpitSettingsRequest) => Promise<CockpitState>;
  confirmReview: (contentId: string, id: string) => Promise<CockpitState>;
  saveRule: (request: KnowledgeRequest) => Promise<{ state: CockpitState; path: string; entryId: string }>;
  saveTemplate: (request: KnowledgeRequest) => Promise<{ state: CockpitState; path: string; entryId: string }>;
  updateKnowledge: (request: UpdateKnowledgeRequest) => Promise<CockpitState>;
  promoteIdea: (request: PromoteIdeaRequest) => Promise<PromotionResult>;
}
