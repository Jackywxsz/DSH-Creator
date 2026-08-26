export interface NativePathHost {
  openPath: (
    request: { path: string },
    signal: AbortSignal,
  ) => Promise<{
    result: {
      ok: boolean;
      error?: { message?: string };
    };
  }>;
}

/**
 * Open a directory through the Host OS instead of the shared workspace funnel.
 * The latter may be intercepted by dsh-better-sidebar's file editor, which only
 * accepts files and reports directories as "is a directory".
 */
export async function openNativePath(
  host: NativePathHost | undefined,
  fallback: (path: string) => Promise<void>,
  path: string,
): Promise<void> {
  if (host === undefined) {
    await fallback(path);
    return;
  }

  const response = await host.openPath({ path }, new AbortController().signal);
  if (!response.result.ok) {
    throw new Error(response.result.error?.message ?? "path open failed");
  }
}
