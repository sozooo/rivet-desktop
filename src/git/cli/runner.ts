import type { ProgressSource } from "../progress";

export type GitResult = { code: number; stdout: string; stderr: string };

export type RunOptions = {
  /** Nobody is watching, so git fails instead of asking for a password. */
  background?: boolean;
  /**
   * Streams progress while git runs: its stderr split at \r and \n, and the
   * lines git-lfs writes to GIT_LFS_PROGRESS (at least the latest per file).
   * Callers add --progress; git reports none to a pipe otherwise. No stdin.
   */
  onLine?: (source: ProgressSource, line: string) => void;
};

/** Runs git inside one repository. Tauri and the tests provide implementations. */
export interface GitRunner {
  text(
    args: string[],
    stdin?: string,
    options?: RunOptions,
  ): Promise<GitResult>;
  /** Raw stdout; rejects when git fails. */
  bytes(args: string[]): Promise<Uint8Array>;
  /** A working-tree file, or null when it doesn't exist. */
  readWorktree(path: string): Promise<Uint8Array | null>;
  /** Modification time of a path relative to the repository root, in ms. */
  modifiedTime(path: string): Promise<number | null>;
  /** Sizes of working-tree files in bytes; null for ones that don't exist. */
  fileSizes(paths: string[]): Promise<(number | null)[]>;
  /** Writes a text file inside the working tree, e.g. .gitattributes. */
  writeWorktree(path: string, text: string): Promise<void>;
}

export class GitError extends Error {
  constructor(
    message: string,
    readonly args: string[],
    readonly code: number,
  ) {
    super(message);
  }
}
