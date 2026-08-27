import type { InvocationDescriptor } from "@deepseek-ai/dsh-typert-protocol";
import { z } from "zod";

import { PACKAGE_NAME } from "../remote-contract.ts";
import {
  cockpitRevisionSchema,
  cockpitStateSchema,
  createFollowerSnapshotRequestSchema,
  createGoalRequestSchema,
  createIdeaRequestSchema,
  createScheduleItemRequestSchema,
  emptyRequestSchema,
  idRequestSchema,
  contentRecordRequestSchema,
  knowledgeRequestSchema,
  knowledgeResultSchema,
  promoteIdeaRequestSchema,
  promotionResultSchema,
  restoreCockpitStateRequestSchema,
  saveManualReviewDraftRequestSchema,
  setContentMetaRequestSchema,
  updateGoalRequestSchema,
  updateIdeaRequestSchema,
  updateCockpitSettingsRequestSchema,
  updateKnowledgeRequestSchema,
  updateScheduleItemRequestSchema,
} from "./schemas.ts";

export const CREATOR_COCKPIT_NAMESPACE = "creatorCockpit";

function codec(typeSymbol: string, schema: z.ZodType<unknown>) {
  return { mode: "strict" as const, typeSymbol, schema };
}

function jsonParam(
  name: string,
  typeSymbol: string,
  schema: z.ZodType<unknown>,
): InvocationDescriptor["parameters"][number] {
  return {
    name,
    wire: name,
    source: "json",
    codec: codec(typeSymbol, schema),
  };
}

function invocation(
  method: string,
  request: z.ZodType<unknown>,
  result: z.ZodType<unknown>,
): InvocationDescriptor {
  return {
    id: `${PACKAGE_NAME}#${CREATOR_COCKPIT_NAMESPACE}/${method}`,
    service: CREATOR_COCKPIT_NAMESPACE,
    namespace: CREATOR_COCKPIT_NAMESPACE,
    method,
    invocation: { kind: "direct" },
    parameters: [jsonParam("request", `${PACKAGE_NAME}#cockpit/${method}Request`, request)],
    cancellation: { parameter: "signal" },
    result: codec(`${PACKAGE_NAME}#cockpit/${method}Result`, result),
    sourceLocation: { file: "src/cockpit/service.ts", line: 1, column: 1 },
  };
}

export const CREATOR_COCKPIT_INVOCATIONS: readonly InvocationDescriptor[] = [
  invocation("getState", emptyRequestSchema, cockpitStateSchema),
  invocation("getRevision", emptyRequestSchema, cockpitRevisionSchema),
  invocation("restoreState", restoreCockpitStateRequestSchema, cockpitStateSchema),
  invocation("createIdea", createIdeaRequestSchema, cockpitStateSchema),
  invocation("updateIdea", updateIdeaRequestSchema, cockpitStateSchema),
  invocation("deleteIdea", idRequestSchema, cockpitStateSchema),
  invocation("setContentMeta", setContentMetaRequestSchema, cockpitStateSchema),
  invocation("deleteContentMeta", idRequestSchema, cockpitStateSchema),
  invocation("createGoal", createGoalRequestSchema, cockpitStateSchema),
  invocation("updateGoal", updateGoalRequestSchema, cockpitStateSchema),
  invocation("deleteGoal", idRequestSchema, cockpitStateSchema),
  invocation("createFollowerSnapshot", createFollowerSnapshotRequestSchema, cockpitStateSchema),
  invocation("deleteFollowerSnapshot", idRequestSchema, cockpitStateSchema),
  invocation("createScheduleItem", createScheduleItemRequestSchema, cockpitStateSchema),
  invocation("updateScheduleItem", updateScheduleItemRequestSchema, cockpitStateSchema),
  invocation("deleteScheduleItem", idRequestSchema, cockpitStateSchema),
  invocation("updateSettings", updateCockpitSettingsRequestSchema, cockpitStateSchema),
  invocation("saveManualReviewDraft", saveManualReviewDraftRequestSchema, cockpitStateSchema),
  invocation("confirmReview", contentRecordRequestSchema, cockpitStateSchema),
  invocation("saveRule", knowledgeRequestSchema, knowledgeResultSchema),
  invocation("saveTemplate", knowledgeRequestSchema, knowledgeResultSchema),
  invocation("updateKnowledge", updateKnowledgeRequestSchema, cockpitStateSchema),
  invocation("promoteIdea", promoteIdeaRequestSchema, promotionResultSchema),
];
