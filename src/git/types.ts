export type LineKind = "context" | "add" | "del";
export type DiffLine = { kind: LineKind; text: string };
export type Hunk = { header: string; lines: DiffLine[]; staged: boolean };

export type FileStatus = "added" | "modified" | "deleted" | "renamed";
/** A changed file. `path` is repository-relative and identifies the file. */
export type FileChange = {
  path: string;
  status: FileStatus;
  hunks: Hunk[];
  /** Where a renamed file came from. */
  oldPath?: string;
  /** Git could not diff it as text; show a preview instead of hunks. */
  binary?: boolean;
  /** Whether a binary change is selected for the next commit (it has no hunks to tick). */
  staged?: boolean;
  /**
   * Both sides of a merge changed the file. Its status then compares my
   * version with theirs, and its hunks show what theirs does differently.
   */
  conflict?: Conflict;
  /** Size in the working tree, in bytes. */
  size?: number;
  /** Git stores the file through Git LFS. */
  lfs?: boolean;
};

export type Side = "mine" | "theirs";

export type Conflict = {
  /** Whether each side has the file; a side without it deleted it. */
  mine: boolean;
  theirs: boolean;
  /** Which version was kept, once one was ("manual" for a hand-made mix). */
  resolution?: Side | "manual";
};

export type OperationKind = "merge" | "rebase" | "cherry-pick" | "revert";

/** A merge, rebase, cherry-pick or revert that stopped halfway, usually on conflicts. */
export type Operation = {
  kind: OperationKind;
  /** The first line of the commit message git prepared, e.g. "Merge branch 'main' of …". */
  message: string;
  /** Commits that hold my version and the incoming one, for files already resolved. */
  mine: string;
  theirs: string;
};

/**
 * Which version of a file to read: the file on disk, the version selected
 * for the next commit, or any commit-ish git understands ("a7c92e1",
 * "a7c92e1^", "HEAD", "stash@{0}").
 */
export type Revision = "worktree" | "index" | (string & {});

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

export type CommitMessage = { summary: string; description: string };

/** A commit that changed one file, and the file's path and status in it. */
export type FileVersion = { commit: Commit; path: string; status: FileStatus };

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
  /** Files in commits not pushed yet that are too large for GitHub. */
  tooLarge?: { path: string; size: number }[];
};

export type LfsState = {
  /** git-lfs is installed on this computer. */
  installed: boolean;
  /** .gitattributes sends some files through Git LFS. */
  tracking: boolean;
};

export type RepoSnapshot = {
  user: Person;
  files: FileChange[];
  commits: Commit[];
  branches: Branches;
  stashes: StashEntry[];
  sync: SyncState;
  operation: Operation | null;
  lfs: LfsState;
  /** Unity projects only: whether git merges scenes and prefabs with Unity's Smart Merge. */
  smartMerge?: boolean;
};

/** What a commit includes: only selected changes, or everything when nothing is selected. */
export type CommitScope = "staged" | "all";

export type Divergence = { base: string; ahead: number; behind: number };
