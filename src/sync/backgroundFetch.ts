import { useEffect, useRef } from "react";
import type { GitBackend } from "../git/backend";
import { unresolved } from "../git/conflicts";
import type { RepoSnapshot } from "../git/types";

/** How often an open repository is checked for teammates' work. */
export const CHECK_EVERY = 5 * 60_000;
/** Coming back to the window checks again once the last check is this old. */
export const CHECK_ON_FOCUS = 90_000;
const LONGEST_WAIT = 60 * 60_000;
const TICK = 30_000;

/**
 * When the next quiet check may run, given the last one (or the last fetch
 * anyone ran). After failures it waits longer each time: no network or an
 * expired sign-in shouldn't mean a failing git run every few minutes.
 */
export function nextCheck(last: number, failures: number, minAge: number) {
  const backoff = failures
    ? Math.min(CHECK_EVERY * 2 ** failures, LONGEST_WAIT)
    : 0;
  return last + Math.max(minAge, backoff);
}

/** Whether the repository can be fetched without getting in anyone's way. */
export function canCheck(snapshot: RepoSnapshot | undefined, busy: boolean) {
  return (
    !!snapshot?.sync.upstream &&
    !busy &&
    !snapshot.operation &&
    !unresolved(snapshot.files).length
  );
}

/** A fetch brought commits that weren't there before it. */
export const broughtNew = (before: RepoSnapshot, after: RepoSnapshot) =>
  after.sync.upstream === before.sync.upstream &&
  after.sync.behind > before.sync.behind;

/**
 * Fetches quietly while a repository is open: every few minutes, and when
 * the window comes back after a while. Says nothing unless teammates' work
 * arrived, and then only when the window has focus and nothing else is
 * going on. Failures stay silent; a sync the user asks for shows them.
 */
export function useBackgroundFetch({
  backend,
  snapshot,
  busy,
  refresh,
  onIncoming,
}: {
  backend: GitBackend;
  snapshot: RepoSnapshot | undefined;
  /** Another operation or a dialog is open: wait. */
  busy: boolean;
  refresh: () => Promise<RepoSnapshot | null>;
  /** Teammates' work arrived; the snapshot says how much is waiting. */
  onIncoming: (snapshot: RepoSnapshot) => void;
}) {
  const latest = useRef({ snapshot, busy, onIncoming });
  latest.current = { snapshot, busy, onIncoming };
  const state = useRef({
    lastAttempt: 0,
    failures: 0,
    running: false,
    /** News to tell once the window has focus. */
    pending: false,
  });

  useEffect(() => {
    /** `fresh`: a snapshot newer than the last render, straight from a fetch. */
    const announce = (fresh?: RepoSnapshot) => {
      const { busy, onIncoming } = latest.current;
      const snapshot = fresh ?? latest.current.snapshot;
      const s = state.current;
      if (!s.pending || !document.hasFocus() || !canCheck(snapshot, busy))
        return;
      s.pending = false;
      // Pulled in the meantime: nothing left to say.
      if (snapshot!.sync.behind) onIncoming(snapshot!);
    };
    const check = async (minAge: number) => {
      const { snapshot: before, busy } = latest.current;
      const s = state.current;
      if (s.running || !canCheck(before, busy)) return;
      const last = Math.max(s.lastAttempt, before!.sync.lastFetched ?? 0);
      if (Date.now() < nextCheck(last, s.failures, minAge)) return;
      s.running = true;
      s.lastAttempt = Date.now();
      let after: RepoSnapshot | null = null;
      try {
        await backend.fetch({ background: true });
        s.failures = 0;
        after = await refresh();
        if (after && broughtNew(before!, after)) s.pending = true;
      } catch {
        s.failures++;
      } finally {
        s.running = false;
      }
      announce(after ?? undefined);
    };

    const first = setTimeout(() => check(CHECK_EVERY), 5_000);
    const timer = setInterval(() => {
      announce();
      check(CHECK_EVERY);
    }, TICK);
    const onFocus = () => {
      announce();
      check(CHECK_ON_FOCUS);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [backend, refresh]);
}
