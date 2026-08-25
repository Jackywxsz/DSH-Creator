import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  cockpitStateSchema,
  createIdeaRequestSchema,
} from "../src/cockpit/schemas.ts";
import {
  CockpitStore,
  emptyCockpitState,
  migrateCockpitState,
} from "../src/cockpit/store.ts";

describe("Cockpit state schema", () => {
  it("migrates the minimal legacy shape without inventing content facts", () => {
    expect(migrateCockpitState({ schemaVersion: 0, revision: 4 })).toEqual({
      ...emptyCockpitState(),
      revision: 4,
    });
  });

  it("migrates legacy operations state to v3 catalogs, canonical schedule, and empty relationships", () => {
    const migrated = migrateCockpitState({
      schemaVersion: 1,
      revision: 7,
      ideas: [],
      contentMeta: {
        demo: {
          contentId: "demo",
          goalIds: [],
          evaluations: [],
          reviews: [],
          dueAt: 2_000,
          updatedAt: 1,
        },
      },
      goals: [],
      followerSnapshots: [],
      settings: { reviewDelayDays: 4 },
    });
    expect(migrated).toMatchObject({
      schemaVersion: 3,
      revision: 7,
      scheduleItems: [{
        id: "legacy-due:demo",
        kind: "content",
        milestone: "custom",
        contentId: "demo",
        plannedAt: 2_000,
        rank: 0,
      }],
      knowledgeItems: [],
      contentMeta: { demo: { tags: [], knowledgeIds: [] } },
      settings: { reviewDelayDays: 4 },
    });
    expect(migrated.settings.contentTypes.length).toBeGreaterThan(0);
    expect(migrated.settings.scheduleTypes.length).toBeGreaterThan(0);
  });

  it("rejects duplicated Oil Creator facts and unknown request fields", () => {
    const state = emptyCockpitState();
    expect(() => cockpitStateSchema.parse({
      ...state,
      contentMeta: {
        demo: {
          contentId: "demo",
          title: "must not be copied",
          goalIds: [],
          evaluations: [],
          reviews: [],
          updatedAt: 1,
        },
      },
    })).toThrow();
    expect(() => createIdeaRequestSchema.parse({
      title: "Idea",
      note: "",
      tags: [],
      workflow: "record",
    })).toThrow();
  });
});

describe("CockpitStore", () => {
  it("serializes concurrent mutations and increments revision once per write", async () => {
    const folder = await mkdtemp(join(tmpdir(), "creator-cockpit-store-"));
    const store = new CockpitStore(folder);
    const first = store.update((draft) => {
      draft.settings.reviewDelayDays = 4;
    });
    const second = store.update((draft) => {
      draft.settings.reviewDelayDays = 5;
    });
    await Promise.all([first, second]);

    const state = await store.load();
    expect(state.revision).toBe(2);
    expect(state.settings.reviewDelayDays).toBe(5);
    expect((await readdir(join(folder, "backups"))).filter((name) => name.endsWith(".json"))).toHaveLength(1);
    expect(JSON.parse(await readFile(join(folder, "state.json"), "utf8"))).toEqual(state);
  });

  it("recovers the newest valid backup and preserves the corrupt file", async () => {
    const folder = await mkdtemp(join(tmpdir(), "creator-cockpit-recover-"));
    const store = new CockpitStore(folder);
    await store.update((draft) => {
      draft.settings.reviewDelayDays = 4;
    });
    await store.update((draft) => {
      draft.settings.reviewDelayDays = 5;
    });
    await writeFile(join(folder, "state.json"), "{broken", "utf8");

    const recovered = await store.load();
    expect(recovered.revision).toBe(1);
    expect(recovered.settings.reviewDelayDays).toBe(4);
    expect((await readdir(folder)).some((name) => name.startsWith("state.corrupt-"))).toBe(true);
    expect(cockpitStateSchema.parse(JSON.parse(await readFile(join(folder, "state.json"), "utf8")))).toEqual(recovered);
  });

  it("sorts double-digit backup revisions numerically during recovery", async () => {
    const folder = await mkdtemp(join(tmpdir(), "creator-cockpit-recover-order-"));
    const store = new CockpitStore(folder);
    for (let delay = 1; delay <= 11; delay += 1) {
      await store.update((draft) => {
        draft.settings.reviewDelayDays = delay;
      });
    }
    await writeFile(join(folder, "state.json"), "{broken", "utf8");

    const recovered = await store.load();
    expect(recovered.revision).toBe(10);
    expect(recovered.settings.reviewDelayDays).toBe(10);
  });

  it("does not replace valid state when a mutation fails", async () => {
    const folder = await mkdtemp(join(tmpdir(), "creator-cockpit-failed-write-"));
    const store = new CockpitStore(folder);
    await store.update((draft) => {
      draft.settings.reviewDelayDays = 4;
    });
    await expect(store.update(() => {
      throw new Error("stop");
    })).rejects.toThrow("stop");
    expect(await store.load()).toMatchObject({ revision: 1, settings: { reviewDelayDays: 4 } });
  });

  it("restores a validated backup, preserves the current state, and rejects stale revisions", async () => {
    const folder = await mkdtemp(join(tmpdir(), "creator-cockpit-restore-"));
    const store = new CockpitStore(folder);
    const current = await store.update((draft) => {
      draft.settings.reviewDelayDays = 8;
    });
    const imported = {
      ...emptyCockpitState(),
      revision: 42,
      settings: { ...emptyCockpitState().settings, reviewDelayDays: 2, tags: ["AI", "增长"] },
    };

    const restored = await store.replace(imported, current.revision);

    expect(restored).toMatchObject({ revision: 2, settings: { reviewDelayDays: 2, tags: ["AI", "增长"] } });
    const backups = (await readdir(join(folder, "backups"))).filter((name) => name.endsWith(".json"));
    expect(backups).toHaveLength(1);
    expect(JSON.parse(await readFile(join(folder, "backups", backups[0]!), "utf8"))).toEqual(current);
    await expect(store.replace(imported, current.revision)).rejects.toThrow("cockpit state changed");
    expect((await store.load()).revision).toBe(2);
  });

  it("checks the restore revision before running its serialized preparation", async () => {
    const folder = await mkdtemp(join(tmpdir(), "creator-cockpit-restore-race-"));
    const store = new CockpitStore(folder);
    const current = await store.update((draft) => {
      draft.settings.reviewDelayDays = 8;
    });
    const imported = {
      ...emptyCockpitState(),
      settings: { ...emptyCockpitState().settings, reviewDelayDays: 2 },
    };
    let prepared = false;

    const mutation = store.update((draft) => {
      draft.settings.reviewDelayDays = 9;
    });
    const restore = store.replace(imported, current.revision, async () => {
      prepared = true;
    });

    await mutation;
    await expect(restore).rejects.toThrow("cockpit state changed");
    expect(prepared).toBe(false);
    expect(await store.load()).toMatchObject({ revision: 2, settings: { reviewDelayDays: 9 } });
  });
});
