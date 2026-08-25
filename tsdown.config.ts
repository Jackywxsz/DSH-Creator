import { readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "tsdown";

const PLUGIN_ID = "dsh-oil-creator";
const CSS_PREFIX = "\0dsh-oil-creator-css:";
const CSS_SUFFIX = ".mjs";
const REPOSITORY_ROOT = dirname(fileURLToPath(import.meta.url));
const CLIENT_EXTERNALS = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "@deepseek-ai/cordis",
  "@deepseek-ai/dsh-client-runtime/client",
  "@deepseek-ai/dsh-client-locale/client",
  "@deepseek-ai/dsh-client-ui-primitives",
  "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-api-remotes/client",
  "@deepseek-ai/dsh-client-connection/client",
] as const;

function inlineCssPlugin() {
  return {
    name: "dsh-oil-creator-inline-css",
    resolveId(source: string, importer?: string) {
      if (!source.endsWith(".css")) return null;
      const file =
        importer === undefined ? source : resolve(dirname(importer), source);
      const repositoryPath = relative(REPOSITORY_ROOT, file);
      if (repositoryPath === ".." || repositoryPath.startsWith(`..${sep}`) || isAbsolute(repositoryPath)) {
        throw new Error(`CSS import must stay inside the repository: ${file}`);
      }
      return `${CSS_PREFIX}${repositoryPath.split(sep).join("/")}${CSS_SUFFIX}`;
    },
    async load(id: string) {
      if (!id.startsWith(CSS_PREFIX)) return null;
      const repositoryPath = id.slice(CSS_PREFIX.length, -CSS_SUFFIX.length);
      const file = resolve(REPOSITORY_ROOT, ...repositoryPath.split("/"));
      const css = await readFile(file, "utf8");
      const tagId = `${PLUGIN_ID}/${basename(file)}`;
      const registry = resolve(REPOSITORY_ROOT, "src/client/pluginCss.ts");
      return [
        `import { registerPluginCss } from ${JSON.stringify(registry)};`,
        `registerPluginCss(${JSON.stringify(tagId)}, ${JSON.stringify(css)});`,
        "export default {};",
      ].join("\n");
    },
  };
}

export default defineConfig([
  {
    name: `${PLUGIN_ID}/host`,
    entry: { index: "src/index.ts" },
    outDir: "lib",
    format: "esm",
    platform: "node",
    target: "es2024",
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    name: `${PLUGIN_ID}/typert`,
    entry: { "typert.host": "src/typert.host.ts" },
    outDir: "lib",
    format: "esm",
    platform: "node",
    target: "es2024",
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    name: `${PLUGIN_ID}/client`,
    entry: { client: "src/client/index.tsx" },
    outDir: "lib",
    format: "cjs",
    platform: "browser",
    target: "es2022",
    fixedExtension: false,
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: [...CLIENT_EXTERNALS],
      alwaysBundle: (id: string) =>
        CLIENT_EXTERNALS.includes(id as (typeof CLIENT_EXTERNALS)[number])
          ? undefined
          : true,
      onlyBundle: false,
    },
    plugins: [inlineCssPlugin()],
    outputOptions: {
      entryFileNames: "client.js",
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      intro: "var module = { exports: {} }; var exports = module.exports;",
      footer: "return module.exports; } });",
    },
  },
]);
