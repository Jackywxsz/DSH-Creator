#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const src = resolve(repositoryRoot, process.argv[2] ?? "scripts/collect-publish.mjs");
const dest = resolve(repositoryRoot, process.argv[3] ?? "lib/collect-publish.mjs");
const libDirectory = resolve(repositoryRoot, "lib");

if (dest !== libDirectory && !dest.startsWith(`${libDirectory}${sep}`)) {
  throw new Error(
    `copy-inplace destination must stay inside ${libDirectory}: ${relative(repositoryRoot, dest)}`,
  );
}

const body = readFileSync(src);
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, body);
