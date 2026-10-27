import type {
  Commit,
  CommitScope,
  Divergence,
  FileChange,
  RepoSnapshot,
  Revision,
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
  pull(): Promise<void>;
  push(): Promise<void>;
}
