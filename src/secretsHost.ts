import { emptySecretView, refsFor, viewFromDescribe } from "./secrets.ts";
import type { CreatorSecrets, SecretKind } from "./types.ts";

interface HostCredentials {
  resolve: (ref: string) => Promise<{ value: string } | undefined>;
  describe: (ref: string) => Promise<{
    configured: boolean;
    writable: boolean;
    source?: string;
  }>;
}

function credentialsOf(ctx: { get: (name: string) => unknown }): HostCredentials | undefined {
  const value = ctx.get("credentials");
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Partial<HostCredentials>;
  if (typeof record.resolve !== "function" || typeof record.describe !== "function") return undefined;
  return record as HostCredentials;
}

function envView(kind: SecretKind): ReturnType<typeof emptySecretView> {
  const configured = refsFor(kind).some((ref) => (process.env[ref] ?? "").trim() !== "");
  const view = emptySecretView(kind);
  return configured ? { ...view, configured: true, source: "env", writable: false } : view;
}

export async function describeCreatorSecrets(
  ctx: { get: (name: string) => unknown },
): Promise<CreatorSecrets> {
  const credentials = credentialsOf(ctx);
  if (credentials === undefined) {
    return { subtitle: envView("subtitle"), cover: envView("cover") };
  }
  const described: Record<string, { configured: boolean; writable: boolean; source?: string }> = {};
  for (const ref of [...refsFor("subtitle"), ...refsFor("cover")]) {
    described[ref] = await credentials.describe(ref);
  }
  return {
    subtitle: viewFromDescribe("subtitle", described),
    cover: viewFromDescribe("cover", described),
  };
}

export async function resolveCreatorSecret(
  ctx: { get: (name: string) => unknown },
  kind: SecretKind,
): Promise<string | undefined> {
  const credentials = credentialsOf(ctx);
  if (credentials !== undefined) {
    for (const ref of refsFor(kind)) {
      const hit = await credentials.resolve(ref);
      const value = hit?.value.trim();
      if (value !== undefined && value !== "") return value;
    }
  }
  for (const ref of refsFor(kind)) {
    const value = process.env[ref]?.trim();
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

export function secretEnv(kind: SecretKind, value: string): Record<string, string> {
  return { [kind === "subtitle" ? "DASHSCOPE_API_KEY" : "ZENMUX_API_KEY"]: value };
}
