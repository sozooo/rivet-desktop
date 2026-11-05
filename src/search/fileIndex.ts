import { useEffect, useSyncExternalStore } from "react";
import type { GitBackend } from "../git/backend";
import type { RepoSnapshot } from "../git/types";
import { fileSearch, indexFiles, type IndexedFile } from "./rank";

/** How far back search looks for files that changed lately, deleted ones too. */
const RECENT_COMMITS = 400;
/** The first list waits a moment, so opening a project shows its changes first. */
const FIRST_LOAD_AFTER = 600;

export type FileIndexState = {
  /** Null until the first list arrives. */
  files: IndexedFile[] | null;
  search: ReturnType<typeof fileSearch> | null;
  /** Listing them failed; search goes on without them. */
  failed: boolean;
};

const EMPTY: FileIndexState = { files: null, search: null, failed: false };

/**
 * The project's files, listed in the background and kept in memory per
 * repository. A new list comes when HEAD moves (commits, syncs, branch
 * switches); until it arrives the old one goes on answering.
 */
class FileIndex {
  state = EMPTY;
  private listeners = new Set<() => void>();
  /** The HEAD the list is for, or is being made for. */
  private wanted: string | null = null;
  private run = 0;

  constructor(private backend: GitBackend) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async update(head: string) {
    if (head === this.wanted) return;
    this.wanted = head;
    const run = ++this.run;
    try {
      const [tracked, recent] = await Promise.all([
        this.backend.trackedFiles(),
        this.backend.recentFiles(RECENT_COMMITS),
      ]);
      if (run !== this.run) return;
      const files = indexFiles(tracked, recent);
      this.state = { files, search: fileSearch(files), failed: false };
    } catch {
      if (run !== this.run) return;
      // Asked again the next time search opens.
      this.wanted = null;
      this.state = { ...this.state, failed: !this.state.files };
    }
    for (const listener of this.listeners) listener();
  }
}

const indexes = new WeakMap<GitBackend, FileIndex>();

/** What changes the list of files: the branch and the commit it is on. */
const headOf = (snapshot: RepoSnapshot) =>
  `${snapshot.branches.current}\n${snapshot.commits[0]?.sha ?? ""}\n${snapshot.commits.length}`;

/**
 * The open repository's files for search. Returns the state and a function
 * that makes sure a list is on its way, for when search opens.
 */
export function useFileIndex(backend: GitBackend, snapshot: RepoSnapshot) {
  let index = indexes.get(backend);
  if (!index) indexes.set(backend, (index = new FileIndex(backend)));
  const head = headOf(snapshot);
  useEffect(() => {
    const timer = setTimeout(
      () => index.update(head),
      index.state.files ? 0 : FIRST_LOAD_AFTER,
    );
    return () => clearTimeout(timer);
  }, [index, head]);
  const state = useSyncExternalStore(index.subscribe, () => index.state);
  return { ...state, ensure: () => index.update(head) };
}
