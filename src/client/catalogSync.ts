import { bumpLibrary } from "./contentSelection.ts";

export const LIBRARY_POLL_MS = 1000;

export function startLibraryLiveSync(
  readRevision: () => Promise<number>,
  intervalMs = LIBRARY_POLL_MS,
): () => void {
  let last = -1;
  let inFlight = false;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const revision = await readRevision();
      if (stopped) return;
      if (last < 0) {
        last = revision;
        if (revision > 0) bumpLibrary();
        return;
      }
      if (revision !== last) {
        last = revision;
        bumpLibrary();
      }
    } catch {
      // Remote may not be mounted yet.
    } finally {
      inFlight = false;
    }
  };

  void tick();
  const timer = globalThis.setInterval(() => {
    void tick();
  }, intervalMs);
  return () => {
    stopped = true;
    globalThis.clearInterval(timer);
  };
}
