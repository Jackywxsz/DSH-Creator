import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("Bilibili collector response contract", () => {
  it("reads response text and reports HTML or invalid JSON without exposing a raw SyntaxError", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const source = await readFile(`${root}/scripts/collect-publish.mjs`, "utf8");
    const block = source.slice(source.indexOf("async function collectBilibili"), source.indexOf("async function collectWechat"));

    expect(block).toContain("await r.text()");
    expect(block).toContain("creator API returned HTML; login or endpoint may have changed");
    expect(block).toContain("creator API returned invalid JSON; login or endpoint may have changed");
    expect(block).not.toContain(".then((r) => r.json())");
  });
});
