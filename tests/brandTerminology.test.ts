import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

const runtimeCopyFiles = [
  "src/client/locales.ts",
  "src/client/ContentInspector.tsx",
  "src/client/sidebar/OperationsSidebarPanel.tsx",
  "src/client/operations/ContentOperationsPage.tsx",
  "src/client/operations/ReviewsPage.tsx",
  "src/cockpit/service.ts",
  "src/cockpit/tools.ts",
  "src/guide.ts",
  "src/capabilities.ts",
  "src/generate.ts",
  "src/tools.ts",
];

describe("Jacky Creator product terminology", () => {
  it("does not expose the upstream product brand in runtime copy", async () => {
    const sources = await Promise.all(
      runtimeCopyFiles.map(async (path) => `${path}\n${await readFile(`${root}/${path}`, "utf8")}`),
    );
    expect(sources.join("\n")).not.toMatch(/Oil Creator|Oil Cover|oil creator|Creator Cockpit/i);
  });

  it("keeps upstream attribution in the public README", async () => {
    const readme = await readFile(`${root}/README.md`, "utf8");
    expect(readme).toContain("## 项目来源");
    expect(readme).toContain("https://github.com/oil-oil/dsh-oil-creator");
    expect(readme).toContain("Creator Cockpit");
  });
});
