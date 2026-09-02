import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

describe("Bilibili collector response contract", () => {
  async function loadResponseParser(): Promise<(response: {
    http?: number;
    contentType?: string;
    text?: string;
  }, label: string) => unknown> {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const source = await readFile(`${root}/scripts/collect-publish.mjs`, "utf8");
    const start = source.indexOf("function parseCollectorJsonResponse");
    expect(start).toBeGreaterThan(-1);
    if (start < 0) throw new Error("parseCollectorJsonResponse is missing");
    const end = source.indexOf("\n}\n", start);
    expect(end).toBeGreaterThan(start);
    const declaration = source.slice(start, end + 3);
    return runInNewContext(`${declaration}; parseCollectorJsonResponse`);
  }

  it("parses response text as JSON", async () => {
    const parseResponse = await loadResponseParser();

    expect(parseResponse({
      http: 200,
      contentType: "application/json",
      text: JSON.stringify({ data: { arc_audits: [] } }),
    }, "Bilibili creator API")).toEqual({ data: { arc_audits: [] } });
  });

  it("reports HTML or invalid JSON without exposing a raw SyntaxError", async () => {
    const parseResponse = await loadResponseParser();

    expect(() => parseResponse({
      http: 200,
      contentType: "text/html; charset=utf-8",
      text: "<html>login</html>",
    }, "Bilibili creator API")).toThrow(
      "Bilibili creator API returned HTML; login or endpoint may have changed (HTTP 200)",
    );
    expect(() => parseResponse({
      http: 200,
      contentType: "application/json",
      text: "not json",
    }, "Bilibili creator API")).toThrow(
      "Bilibili creator API returned invalid JSON; login or endpoint may have changed (HTTP 200)",
    );
  });
});
