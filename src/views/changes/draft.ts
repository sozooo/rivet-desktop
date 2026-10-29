import { useCallback, useEffect, useState } from "react";
import type { CommitMessage } from "../../git/types";

const EMPTY: CommitMessage = { summary: "", description: "" };
const CHANGED = "rivet-draft";
const storageKey = (repositoryId: string) => `rivet.draft.${repositoryId}`;

function load(repositoryId: string): CommitMessage {
  try {
    const stored = localStorage.getItem(storageKey(repositoryId));
    return stored ? { ...EMPTY, ...JSON.parse(stored) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(repositoryId: string, draft: CommitMessage) {
  try {
    localStorage.setItem(storageKey(repositoryId), JSON.stringify(draft));
  } catch {}
}

/** The commit message being written, kept per repository across restarts. */
export function useDraft(repositoryId: string) {
  const [draft, setDraft] = useState(() => load(repositoryId));
  useEffect(() => {
    setDraft(load(repositoryId));
    // An undone commit hands its message back from elsewhere in the app.
    const reload = (e: Event) =>
      (e as CustomEvent<string>).detail === repositoryId &&
      setDraft(load(repositoryId));
    window.addEventListener(CHANGED, reload);
    return () => window.removeEventListener(CHANGED, reload);
  }, [repositoryId]);
  const update = useCallback(
    (next: CommitMessage) => {
      setDraft(next);
      save(repositoryId, next);
    },
    [repositoryId],
  );
  return [draft, update] as const;
}

/** Puts an undone commit's message back in the form, unless something new is being written. */
export function restoreDraft(repositoryId: string, message: CommitMessage) {
  const current = load(repositoryId);
  if (current.summary.trim() || current.description.trim()) return;
  save(repositoryId, message);
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: repositoryId }));
}
