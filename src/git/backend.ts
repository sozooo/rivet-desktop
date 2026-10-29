import type {
  Commit,
  CommitScope,
  Divergence,
  FileChange,
  RepoSnapshot,
  Revision,
  Side,
} from "./types";

/**
 * Everything the UI asks of a repository. The browser build uses MockBackend;
 * the desktop build will implement the same interface by running the git CLI.
 */
export interface GitBackend {
  snapshot(): Promise<RepoSnapshot>;
  commitFiles(sha: string): Promise<FileChange[]>;
  stashFiles(index: number): Promise<FileChange[]>;
  compareBranch(branch: string, base: string): Promise<Divergence>;
  /** Raw bytes of a file at a revision, or null when it does not exist there. */
  readFile(path: string, revision: Revision): Promise<Uint8Array | null>;
  /** The asset a Unity GUID belongs to (found through its .meta file), if any. */
  resolveGuid?(guid: string): Promise<string | null>;

  setStaged(path: string, staged: boolean, hunk?: number): Promise<void>;
  setAllStaged(staged: boolean): Promise<void>;
  discard(path: string): Promise<void>;
  commit(
    message: { summary: string; description: string },
    scope: CommitScope,
  ): Promise<Commit>;

  stash(): Promise<void>;
  stashPop(index: number): Promise<void>;
  stashDrop(index: number): Promise<void>;

  createBranch(name: string): Promise<void>;
  switchBranch(name: string): Promise<void>;

  fetch(): Promise<void>;
  /** Stopping on conflicts is not a failure: the snapshot then has an operation. */
  pull(): Promise<void>;
  push(): Promise<void>;

  /** Settles a conflicted file with one side's version, or that side's deletion. */
  resolveConflict(path: string, side: Side): Promise<void>;
  /** A conflicted file was fixed by hand. */
  markResolved(path: string): Promise<void>;
  /** Goes back to where things were before the merge, rebase or cherry-pick. */
  abortOperation(): Promise<void>;
  /** Commits the merge with git's prepared message, or continues a rebase or cherry-pick. */
  finishOperation(): Promise<void>;

  /** Turns Git LFS on for the repository and sends files matching the patterns through it. */
  setupLfs(patterns: string[]): Promise<void>;
  /** Downloads LFS files that are only pointers so far. */
  lfsPull(): Promise<void>;
  /** Lets git merge Unity scenes and prefabs with UnityYAMLMerge at `tool`. */
  setupSmartMerge(tool: string): Promise<void>;
}
