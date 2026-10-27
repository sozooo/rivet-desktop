export type LineKind = "context" | "add" | "del";
export type DiffLine = { kind: LineKind; text: string };
export type Hunk = { header: string; lines: DiffLine[]; staged: boolean };

export type FileStatus = "added" | "modified" | "deleted" | "renamed";
/** A changed file. `path` is repository-relative and identifies the file. */
export type FileChange = { path: string; status: FileStatus; hunks: Hunk[] };

export type Person = { name: string; email: string };

export type Commit = {
  sha: string;
  summary: string;
  description: string;
  author: Person;
  /** Unix time in milliseconds. */
  date: number;
  parents: string[];
  /** Branch and tag names pointing at this commit, besides the current branch. */
  refs?: string[];
};

export type StashEntry = {
  index: number;
  message: string;
  branch: string;
  date: number;
  fileCount: number;
};

export type Branches = {
  current: string;
  local: string[];
  remote: string[];
  tags: string[];
};

export type SyncState = {
  /** Remote branch the current branch tracks, or null when it has none. */
  upstream: string | null;
  ahead: number;
  behind: number;
  lastFetched: number | null;
};

export type RepoSnapshot = {
  user: Person;
  files: FileChange[];
  commits: Commit[];
  branches: Branches;
  stashes: StashEntry[];
  sync: SyncState;
};

/** What a commit includes: only selected changes, or everything when nothing is selected. */
export type CommitScope = "staged" | "all";

export type Divergence = { base: string; ahead: number; behind: number };
