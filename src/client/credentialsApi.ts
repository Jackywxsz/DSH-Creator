import type { ClientRemote } from "@deepseek-ai/dsh-api-remotes/client";
import type { SecretView } from "../types.ts";

/** Adapt the official Remote result to the settings card's local interface. */
export function credentialsClient(remote: ClientRemote["credentials"]): CredentialsClient {
  return {
    async describe({ refs }) {
      const result = await remote.describe(refs);
      return { result: result.ok
        ? { ok: true, value: { credentials: result.value } }
        : { ok: false } };
    },
    async set({ ref, value }) {
      return { result: await remote.set(ref, value) };
    },
  };
}

export interface CredentialView {
  configured: boolean;
  writable: boolean;
  source?: string;
}

export interface CredentialsClient {
  describe: (request: { refs: string[] }) => Promise<{
    result: {
      ok: boolean;
      value?: { credentials: Record<string, CredentialView> };
    };
  }>;
  set: (request: { ref: string; value: string }) => Promise<{
    result: { ok: boolean };
  }>;
}

export interface SecretDraft {
  kind: SecretView["kind"];
  ref: string;
  configured: boolean;
  writable: boolean;
  source?: string;
  nextValue: string;
  loadError: boolean;
}

export function secretDraftOf(view: SecretView): SecretDraft {
  return {
    kind: view.kind,
    ref: view.ref,
    configured: view.configured,
    writable: view.writable,
    ...(view.source === undefined ? {} : { source: view.source }),
    nextValue: "",
    loadError: false,
  };
}

export function applyDescribed(
  draft: SecretDraft,
  credentials: Record<string, CredentialView | undefined>,
): SecretDraft {
  const row = credentials[draft.ref];
  if (row === undefined) {
    return { ...draft, configured: false, writable: true, loadError: false };
  }
  return {
    ...draft,
    configured: row.configured === true,
    writable: row.writable !== false,
    ...(row.source === undefined ? {} : { source: row.source }),
    loadError: false,
  };
}
