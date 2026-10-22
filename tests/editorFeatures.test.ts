import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { OilCreatorService } from "../src/service.ts";

function ctxStub(): any {
  return {
    effect: (fn: () => unknown) => { const disposer = fn(); return () => { if (typeof disposer === "function") disposer(); }; },
    inject: () => undefined,
    get: () => undefined,
    provide: () => undefined,
    reflect: { provide: () => {}, get: () => undefined },
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  };
}

async function serviceAt(): Promise<{ service: OilCreatorService; root: string; id: string }> {
  const root = await mkdtemp(join(tmpdir(), "creator-editor-"));
  const id = "2026-10-21_测试内容";
  await mkdir(join(root, id, "演示"), { recursive: true });
  await writeFile(join(root, id, "topic.md"), "# 测试选题\n", "utf8");
  await writeFile(join(root, id, "script.md"), "第一句。\n\n第二句。\n", "utf8");
  await writeFile(join(root, id, "演示", "presentation.json"), JSON.stringify({
    aspect: "16x9",
    pages: [
      { id: "p1", title: "第一页", body: "正文一", notes: "" },
      { id: "p2", title: "第二页", body: "正文二", notes: "" },
    ],
  }), "utf8");
  const service = new OilCreatorService(ctxStub(), {
    libraryRoot: root,
    dataDir: join(root, ".data"),
    cockpitDataDir: join(root, ".cockpit"),
    subtitleSkillDir: join(root, ".skills/subtitle"),
    coverSkillDir: join(root, ".skills/cover"),
  });
  return { service, root, id };
}

const signal = () => new AbortController().signal;

describe("editable content features", () => {
  it("reads and saves presentation pages as JSON and HTML", async () => {
    const { service, root, id } = await serviceAt();
    const deck = await service.getPresentationDeck({ id }, signal());
    expect(deck.pages.map((page) => page.title)).toEqual(["第一页", "第二页"]);
    deck.pages.push({ id: "p3", title: "第三页", body: "正文三", notes: "备注" });
    const next = await service.savePresentationDeck({ id, deck }, signal());
    expect(next.presentations["16x9"]).toBeDefined();
    expect(existsSync(join(root, id, "演示", "presentation.json"))).toBe(true);
    expect(existsSync(join(root, id, "演示", `${id}-16x9.html`))).toBe(true);
    service.stopWatch();
  });

  it("saves article, SRT and cover title", async () => {
    const { service, id } = await serviceAt();
    const article = await service.setArticle({ id, text: "# 文章\n\n正文" }, signal());
    expect(article.article).toContain("正文");
    const srt = await service.saveSubtitleSrt({ id, text: "1\n00:00:00,000 --> 00:00:02,000\n测试字幕\n" }, signal());
    expect(srt.subtitles.srt).toBeDefined();
    const titled = await service.setCoverTitle({ id, title: "测试封面" }, signal());
    expect(titled.coverTitle).toBe("测试封面");
    service.stopWatch();
  });

  it("renames and soft-deletes content", async () => {
    const { service, root, id } = await serviceAt();
    const renamed = await service.renameContent({ id, title: "改名后" }, signal());
    expect(existsSync(join(root, renamed.id))).toBe(true);
    const deleted = await service.deleteContent({ id: renamed.id }, signal());
    expect(existsSync(deleted.trashPath)).toBe(true);
    expect(existsSync(join(root, renamed.id))).toBe(false);
    service.stopWatch();
  });
});
