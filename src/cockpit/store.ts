import {
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

import {
  COCKPIT_SCHEMA_VERSION,
  DEFAULT_CONTENT_TYPES,
  DEFAULT_MILESTONE_COLORS,
  DEFAULT_SCHEDULE_TYPES,
  DEFAULT_TAGS,
  DEFAULT_TIERS,
  cockpitStateSchema,
  type CockpitState,
} from "./schemas.ts";

export const COCKPIT_STATE_FILE = "state.json";

export function emptyCockpitState(): CockpitState {
  return {
    schemaVersion: COCKPIT_SCHEMA_VERSION,
    revision: 0,
    ideas: [],
    contentMeta: {},
    goals: [],
    followerSnapshots: [],
    scheduleItems: [],
    knowledgeItems: [],
    settings: {
      reviewDelayDays: 3,
      contentTypes: [...DEFAULT_CONTENT_TYPES],
      tiers: [...DEFAULT_TIERS],
      tags: [...DEFAULT_TAGS],
      scheduleTypes: DEFAULT_SCHEDULE_TYPES.map((item) => ({ ...item })),
      milestoneColors: { ...DEFAULT_MILESTONE_COLORS },
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function migrateCockpitState(value: unknown): CockpitState {
  if (!isObject(value)) throw new Error("cockpit state must be an object");
  if (value.schemaVersion === COCKPIT_SCHEMA_VERSION) {
    return cockpitStateSchema.parse(value);
  }
  if (value.schemaVersion !== undefined && value.schemaVersion !== 0 && value.schemaVersion !== 1 && value.schemaVersion !== 2) {
    throw new Error(`unsupported cockpit schema version: ${String(value.schemaVersion)}`);
  }
  const legacyContentMeta = isObject(value.contentMeta) ? value.contentMeta : {};
  const legacyDueItems: Array<Record<string, unknown>> = [];
  const contentMeta = Object.fromEntries(Object.entries(legacyContentMeta).map(([id, raw]) => {
    if (!isObject(raw)) return [id, raw];
    const { dueAt, ...rest } = raw;
    if (typeof dueAt === "number" && Number.isInteger(dueAt) && dueAt >= 0) {
      legacyDueItems.push({
        id: `legacy-due:${id}`,
        kind: "content",
        milestone: "custom",
        title: typeof raw.nextAction === "string" && raw.nextAction.trim() !== "" ? raw.nextAction : "推进内容",
        contentId: id,
        plannedAt: dueAt,
        rank: legacyDueItems.length,
        note: "由旧版内容期限迁移",
        createdAt: typeof raw.updatedAt === "number" ? raw.updatedAt : dueAt,
        updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : dueAt,
      });
    }
    return [id, {
      ...rest,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      knowledgeIds: Array.isArray(raw.knowledgeIds) ? raw.knowledgeIds : [],
    }];
  }));
  const settings = isObject(value.settings) ? value.settings : {};
  const legacySchedule = Array.isArray(value.scheduleItems) ? value.scheduleItems : [];
  const scheduleItems = [...legacySchedule, ...legacyDueItems.filter((candidate) => !legacySchedule.some((raw) => (
    isObject(raw)
    && raw.contentId === candidate.contentId
    && raw.plannedAt === candidate.plannedAt
  )))].map((raw, index) => isObject(raw) ? { ...raw, rank: typeof raw.rank === "number" ? raw.rank : index } : raw);
  const legacyGoals = Array.isArray(value.goals) ? value.goals : [];
  let primaryAssigned = false;
  const goals = legacyGoals.map((raw) => {
    if (!isObject(raw)) return raw;
    const canBePrimary = raw.archivedAt === undefined && raw.metric === "published";
    const primary = typeof raw.primary === "boolean" ? raw.primary : canBePrimary && !primaryAssigned;
    if (primary) primaryAssigned = true;
    return {
      ...raw,
      primary,
      contentTypeTargets: Array.isArray(raw.contentTypeTargets) ? raw.contentTypeTargets : [],
    };
  });
  return cockpitStateSchema.parse({
    schemaVersion: COCKPIT_SCHEMA_VERSION,
    revision: typeof value.revision === "number" ? value.revision : 0,
    ideas: Array.isArray(value.ideas) ? value.ideas : [],
    contentMeta,
    goals,
    followerSnapshots: Array.isArray(value.followerSnapshots) ? value.followerSnapshots : [],
    scheduleItems,
    knowledgeItems: Array.isArray(value.knowledgeItems) ? value.knowledgeItems : [],
    settings: {
      reviewDelayDays: settings.reviewDelayDays ?? 3,
      contentTypes: Array.isArray(settings.contentTypes) ? settings.contentTypes : [...DEFAULT_CONTENT_TYPES],
      tiers: Array.isArray(settings.tiers) ? settings.tiers : [...DEFAULT_TIERS],
      tags: Array.isArray(settings.tags) ? settings.tags : [...DEFAULT_TAGS],
      scheduleTypes: Array.isArray(settings.scheduleTypes) ? settings.scheduleTypes : DEFAULT_SCHEDULE_TYPES.map((item) => ({ ...item })),
      milestoneColors: isObject(settings.milestoneColors) ? settings.milestoneColors : { ...DEFAULT_MILESTONE_COLORS },
    },
  });
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function syncDirectory(path: string): Promise<void> {
  try {
    const handle = await open(path, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // Some filesystems do not allow syncing a directory handle.
  }
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const parent = dirname(path);
  await mkdir(parent, { recursive: true });
  const temp = join(parent, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temp, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temp, path);
    await syncDirectory(parent);
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temp).catch(() => {});
    throw error;
  }
}

export class CockpitStore {
  readonly dataDir: string;
  readonly statePath: string;
  readonly backupsDir: string;
  mutationTail: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.statePath = join(dataDir, COCKPIT_STATE_FILE);
    this.backupsDir = join(dataDir, "backups");
  }

  async ensureLayout(): Promise<void> {
    await Promise.all([
      mkdir(this.backupsDir, { recursive: true }),
      mkdir(join(this.dataDir, "knowledge", "reviews"), { recursive: true }),
      mkdir(join(this.dataDir, "knowledge", "templates"), { recursive: true }),
      mkdir(join(this.dataDir, "knowledge", "rules"), { recursive: true }),
      mkdir(join(this.dataDir, "logs"), { recursive: true }),
    ]);
  }

  async load(): Promise<CockpitState> {
    try {
      return migrateCockpitState(await readJson(this.statePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return emptyCockpitState();
      return this.recover(error);
    }
  }

  async recover(originalError: unknown): Promise<CockpitState> {
    let names: string[];
    try {
      names = (await readdir(this.backupsDir))
        .filter((name) => /^state-r\d+-\d+\.json$/.test(name))
        .sort((left, right) => {
          const [, leftRevision = "0", leftTimestamp = "0"] = /^state-r(\d+)-(\d+)\.json$/.exec(left) ?? [];
          const [, rightRevision = "0", rightTimestamp = "0"] = /^state-r(\d+)-(\d+)\.json$/.exec(right) ?? [];
          return Number(rightRevision) - Number(leftRevision) || Number(rightTimestamp) - Number(leftTimestamp);
        });
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") throw originalError;
      throw error;
    }
    for (const name of names) {
      let recovered: CockpitState;
      try {
        recovered = migrateCockpitState(await readJson(join(this.backupsDir, name)));
      } catch {
        continue;
      }
      const corruptPath = join(this.dataDir, `state.corrupt-${Date.now()}.json`);
      await rename(this.statePath, corruptPath);
      await writeJsonAtomic(this.statePath, recovered);
      return recovered;
    }
    throw originalError;
  }

  async backup(state: CockpitState): Promise<void> {
    try {
      await readFile(this.statePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return;
      throw error;
    }
    await mkdir(this.backupsDir, { recursive: true });
    const target = join(this.backupsDir, `state-r${state.revision}-${Date.now()}.json`);
    await copyFile(this.statePath, target);
  }

  async update(mutator: (draft: CockpitState) => CockpitState | void | Promise<CockpitState | void>): Promise<CockpitState> {
    let resolveResult!: (state: CockpitState) => void;
    let rejectResult!: (error: unknown) => void;
    const result = new Promise<CockpitState>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    this.mutationTail = this.mutationTail.then(async () => {
      try {
        const current = await this.load();
        const draft = structuredClone(current);
        const changed = (await mutator(draft)) ?? draft;
        const next = cockpitStateSchema.parse({
          ...changed,
          schemaVersion: COCKPIT_SCHEMA_VERSION,
          revision: current.revision + 1,
        });
        await this.ensureLayout();
        await this.backup(current);
        await writeJsonAtomic(this.statePath, next);
        resolveResult(next);
      } catch (error) {
        rejectResult(error);
      }
    });
    return result;
  }

  async replace(
    value: unknown,
    expectedRevision: number,
    prepare?: (imported: CockpitState) => Promise<void>,
  ): Promise<CockpitState> {
    const imported = migrateCockpitState(value);
    return this.update(async (current) => {
      if (current.revision !== expectedRevision) {
        throw new Error("cockpit state changed; export again or reopen restore before retrying");
      }
      await prepare?.(imported);
      return imported;
    });
  }
}
