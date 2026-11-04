import type { TransferOptions } from "../backend";
import { during } from "../cancel";
import {
  ProgressTracker,
  withoutProgress,
  type ProgressListener,
} from "../progress";
import type { GitRunner, RunOptions } from "./runner";

/** Runner options that feed a command's progress lines to `tracker` and report changes. */
export function reportProgress(
  tracker: ProgressTracker,
  onProgress?: ProgressListener,
): RunOptions {
  if (!onProgress) return {};
  return {
    onLine: (source, line) => {
      const progress = tracker.line(source, line);
      if (progress) onProgress(progress);
    },
  };
}

/**
 * The Git LFS files of a commit (HEAD by default) that aren't on this
 * computer yet, from `git lfs ls-files`, which doesn't ask the server; null
 * when git-lfs can't tell.
 */
export async function pendingLfs(git: GitRunner, ref?: string) {
  const result = await git.text([
    "lfs",
    "ls-files",
    "--json",
    ...(ref ? [ref] : []),
  ]);
  if (result.code !== 0) return null;
  try {
    const { files } = JSON.parse(result.stdout) as {
      files: { size: number; downloaded: boolean }[] | null;
    };
    const pending = (files ?? []).filter((f) => !f.downloaded);
    return {
      files: pending.length,
      bytes: pending.reduce((total, f) => total + f.size, 0),
    };
  } catch {
    return null;
  }
}

/**
 * Makes and removes the folder a clone goes into (src-tauri/src/clone_folder.rs).
 * Only a folder made here is ever removed.
 */
export type CloneFolders = {
  /** Makes the folder; false when it was there already. */
  create(path: string): Promise<boolean>;
  /** The clone is over; `discard` removes the folder `create` made for it. */
  finish(path: string, discard: boolean): Promise<void>;
};

/**
 * The project arrived and can be opened, but not all of its Git LFS files
 * did. `reason`: the error, CancelledError, or null when an earlier attempt
 * left the project in the folder like that. `resumeClone` downloads the rest.
 */
export class IncompleteClone extends Error {
  constructor(
    readonly path: string,
    readonly reason: unknown,
  ) {
    super(
      reason instanceof Error
        ? reason.message
        : "Some Git LFS files are not downloaded yet.",
    );
    this.name = "IncompleteClone";
  }
}

/** The same repository address, however it was written. */
const sameUrl = (a: string, b: string) => {
  const plain = (url: string) =>
    url
      .trim()
      .replace(/^(https?:\/\/)[^@/]+@/i, "$1")
      .replace(/\/+$/, "")
      .replace(/\.git$/i, "")
      .toLowerCase();
  return plain(a) === plain(b);
};

/** `destination` holds a clone of `url` that git finished: it can be opened. */
async function clonedBefore(repository: GitRunner, url: string) {
  try {
    const [top, head, origin] = await Promise.all([
      repository.text(["rev-parse", "--show-cdup"]),
      repository.text(["rev-parse", "--verify", "-q", "HEAD"]),
      repository.text(["config", "--get", "remote.origin.url"]),
    ]);
    // --show-cdup is empty at the top of a repository, not in a folder inside one.
    return (
      top.code === 0 &&
      !top.stdout.trim() &&
      head.code === 0 &&
      origin.code === 0 &&
      sameUrl(origin.stdout, url)
    );
  } catch {
    // The folder doesn't exist.
    return false;
  }
}

/**
 * Downloads the Git LFS files a cloned project lacks, with `git lfs pull`,
 * which reports them byte by byte; inside a clone git-lfs only says when each
 * file is done, so a big project would look stuck. Only where the clone would
 * have downloaded them itself: with Git LFS set up and not told to skip them.
 */
async function downloadLfs(
  repository: GitRunner,
  tracker: ProgressTracker,
  { onProgress, cancel }: TransferOptions,
) {
  const filters = await repository.text([
    "config",
    "--get-regexp",
    "^filter\\.lfs\\.(process|smudge)$",
  ]);
  if (filters.code !== 0 || filters.stdout.includes("--skip")) return;
  const pending = await pendingLfs(repository);
  if (pending?.files === 0) return;
  if (pending) tracker.expect(pending);
  // Each file is written whole once it has arrived; stopping keeps those.
  await during(cancel, async (signal) => {
    const pulled = await repository.text(["lfs", "pull"], undefined, {
      signal,
      ...reportProgress(tracker, onProgress),
    });
    if (pulled.code !== 0)
      throw new Error(withoutProgress(pulled.stderr) || "git lfs pull failed");
  });
}

/**
 * Clones `url` into `destination`, then downloads its Git LFS files.
 *
 * Cancelling or failing before git has finished removes the folder, if this
 * made it, so the next attempt starts clean. After that the project can be
 * opened, so a broken or cancelled LFS download rejects with IncompleteClone
 * and leaves it in place for `resumeClone`. So does finding the project
 * already here, from an earlier attempt, with files missing.
 */
export async function clone(
  runner: (cwd: string) => GitRunner,
  folders: CloneFolders,
  url: string,
  destination: string,
  transfer: TransferOptions = {},
) {
  const { onProgress, cancel } = transfer;
  const repository = runner(destination);
  if (await clonedBefore(repository, url)) {
    const pending = await pendingLfs(repository);
    if (pending?.files) throw new IncompleteClone(destination, null);
    return;
  }

  const tracker = new ProgressTracker("clone");
  const made = await folders.create(destination);
  let finished = false;
  try {
    await during(cancel, async (signal) => {
      const cloned = await runner(".").text(
        [
          // Leave LFS files as pointers for now.
          ...["-c", "filter.lfs.process=", "-c", "filter.lfs.smudge="],
          ...["-c", "filter.lfs.required=false", "clone"],
          ...(onProgress ? ["--progress"] : []),
          ...["--", url, destination],
        ],
        undefined,
        { signal, ...reportProgress(tracker, onProgress) },
      );
      if (cloned.code !== 0)
        throw new Error(withoutProgress(cloned.stderr) || "git clone failed");
    });
    finished = true;
  } finally {
    if (made) await folders.finish(destination, !finished).catch(() => {});
  }

  try {
    await downloadLfs(repository, tracker, transfer);
  } catch (error) {
    throw new IncompleteClone(destination, error);
  }
}

/** Downloads the Git LFS files a clone left behind (see IncompleteClone). */
export async function resumeClone(
  repository: GitRunner,
  transfer: TransferOptions = {},
) {
  await downloadLfs(repository, new ProgressTracker("lfs"), transfer);
}
