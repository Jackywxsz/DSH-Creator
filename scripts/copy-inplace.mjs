#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const src = resolve(process.argv[2] ?? "scripts/collect-publish.mjs");
const dest = resolve(process.argv[3] ?? "lib/collect-publish.mjs");
const body = readFileSync(src);
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, body);
const packed = resolve(homedir(), ".dsh/profiles/web/node_modules/dsh-oil-creator/lib/collect-publish.mjs");
if (existsSync(packed) && packed !== dest) writeFileSync(packed, body);
