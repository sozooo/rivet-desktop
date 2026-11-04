import type { CancelHandle } from "./cancel";
import type { ProgressListener } from "./progress";
import type {
  Commit,
  CommitMessage,
  CommitScope,
  Divergence,
  FileChange,
  FileVersion,
  RepoSnapshot,
  Revision,
  Side,
} from "./types";

/** What a long transfer reports to, and how the person can stop it. */
export type TransferOptions = {
  /** Hears how far it got. */
  onProgress?: ProgressListener;
  /**
   * Offers cancelling while that is safe: during downloads and sending, not
   * while a pull merges. A cancelled operation rejects with CancelledError
   * and leaves the repository as it was, apart from what it had downloaded.
   */
  cancel?: CancelHandle;
};

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
  /** Commits that changed a file, newest first, following renames. */
  fileHistory(path: string): Promise<FileVersion[]>;

  setStaged(path: string, staged: boolean, hunk?: number): Promise<void>;
  setAllStaged(staged: boolean): Promise<void>;
  discard(path: string): Promise<void>;
  commit(message: CommitMessage, scope: CommitScope): Promise<Commit>;
  /**
   * Takes back the latest commit if nobody has it yet: its changes stay in
   * the files and are selected again. Returns its message.
   */
  undoLastCommit(): Promise<CommitMessage>;
  /** Puts a file back the way it was at a revision; that becomes an ordinary change. */
  restoreFile(path: string, revision: Revision): Promise<void>;

  stash(): Promise<void>;
  stashPop(index: number): Promise<void>;
  stashDrop(index: number): Promise<void>;

  createBranch(name: string): Promise<void>;
  switchBranch(name: string): Promise<void>;

  /**
   * `background`: nobody asked, so never ask for a password either, and
   * report no progress.
   */
  fetch(options?: TransferOptions & { background?: boolean }): Promise<void>;
  /**
   * Stopping on conflicts is not a failure: the snapshot then has an
   * operation. With progress or a cancel handle, everything new is downloaded
   * first (commits, then LFS files), which can be cancelled; the merge after can't.
   */
  pull(options?: TransferOptions): Promise<void>;
  push(options?: TransferOptions): Promise<void>;

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
  lfsPull(options?: TransferOptions): Promise<void>;
  /** Lets git merge Unity scenes and prefabs with UnityYAMLMerge at `tool`. */
  setupSmartMerge(tool: string): Promise<void>;

  /**
   * Writes Unity's .gitignore into each Unity project in the repository, or
   * adds the lines an existing one lacks. Returns the files it changed.
   */
  ignoreUnityGenerated(): Promise<string[]>;
  /**
   * Stops saving what Unity generates that was committed earlier: takes it out
   * of git, keeping the files on disk, and commits that with the .gitignore.
   * Changes selected before stay selected and out of this commit.
   */
  untrackUnityGenerated(message: CommitMessage): Promise<Commit>;
}
