import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

const runtimeCopyFiles = [
  "src/client/locales.ts",
  "src/client/index.tsx",
  "src/client/ContentInspector.tsx",
  "src/client/sidebar/OperationsSidebarPanel.tsx",
  "src/client/operations/ContentOperationsPage.tsx",
  "src/client/operations/ReviewsPage.tsx",
  "src/cockpit/service.ts",
  "src/cockpit/tools.ts",
  "src/creatorSkill.ts",
  "src/guide.ts",
  "src/libraryPrompt.ts",
  "src/capabilities.ts",
  "src/generate.ts",
  "src/tools.ts",
];

describe("Jacky Creator product terminology", () => {
  it("does not expose legacy Agent tool names in runtime sources", async () => {
    const sources = await Promise.all(
      runtimeCopyFiles.map(async (path) => `${path}\n${await readFile(`${root}/${path}`, "utf8")}`),
    );
    expect(sources.join("\n")).not.toMatch(
      /\boil_(?:creator_guide|script_rules|creator_setup|create_content|update_content|creator_profile|organize_library|sync_publish|open_studio|wait_export|open_subtitle_preview|burn_subtitles|generate_subtitles|generate_cover)\b|\bcockpit_(?:get_script_context|get_evaluation_context|save_evaluation|get_review_context|save_review_draft)\b/,
    );
  });

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

  it("uses the Jacky Creator identity for the installable plugin", async () => {
    const [manifestText, patch, host, contract, settings, build] = await Promise.all([
      readFile(`${root}/package.json`, "utf8"),
      readFile(`${root}/cordis.patch.yml`, "utf8"),
      readFile(`${root}/src/index.ts`, "utf8"),
      readFile(`${root}/src/remote-contract.ts`, "utf8"),
      readFile(`${root}/src/settingsContract.ts`, "utf8"),
      readFile(`${root}/tsdown.config.ts`, "utf8"),
    ]);
    const manifest = JSON.parse(manifestText) as { name?: string; version?: string };
    const identitySurfaces = [patch, host, contract, settings, build].join("\n");

    expect(manifest.name).toBe("jacky-creator");
    expect(manifest.version).toBe("0.1.0-beta.8");
    expect(identitySurfaces).toContain("jacky-creator");
    expect(identitySurfaces).not.toContain("dsh-oil-creator");
  });

  it("keeps beginner-facing docs concise and product-branded", async () => {
    const [readme, installation, usage, files, security, contributing, hero] = await Promise.all([
      readFile(`${root}/README.md`, "utf8"),
      readFile(`${root}/docs/installation.md`, "utf8"),
      readFile(`${root}/docs/usage.md`, "utf8"),
      readFile(`${root}/docs/files.md`, "utf8"),
      readFile(`${root}/SECURITY.md`, "utf8"),
      readFile(`${root}/CONTRIBUTING.md`, "utf8"),
      readFile(`${root}/assets/readme/source/hero-layout.svg`, "utf8"),
    ]);
    const onboarding = `${readme}\n${installation}`;
    const publicDocs = [readme, installation, usage, files, security, contributing]
      .join("\n");

    expect(onboarding).not.toMatch(/这是 .*测试版|不跟随开发分支|真实用户测试|测试用户/);
    expect(readme).not.toContain("dsh plugin remove dsh-oil-creator");
    expect(installation.match(/dsh plugin remove dsh-oil-creator/g)).toHaveLength(1);
    expect(onboarding).not.toContain("dsh-oil-creator-0.1.0-beta.2.tgz");
    expect(onboarding).toContain("jacky-creator-0.1.0-beta.8.tgz");
    expect(publicDocs).not.toContain("~/.dsh-oil-creator");
    expect(publicDocs).not.toContain("今天做一期 DeepSeek Harness 安装上手");
    expect(hero).not.toContain("<circle");
    expect(hero).not.toContain("DEEPSEEK HARNESS PLUGIN · BETA");
    expect(hero).not.toContain('stroke="#79C800"');
    expect(hero).toMatch(
      /<text x="56" y="39" text-anchor="middle"[^>]*>灵感<\/text>/,
    );
  });
});
