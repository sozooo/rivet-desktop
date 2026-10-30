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
 * The Git LFS files `git lfs pull` would download, from `git lfs ls-files`
 * (which reads them from the commit, without the server); null when git-lfs
 * can't tell.
 */
export async function pendingLfs(git: GitRunner) {
  const result = await git.text(["lfs", "ls-files", "--json"]);
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
 * Clones `url` into `destination`. Git LFS files come after, through `git lfs
 * pull`, which reports them byte by byte; inside the clone git-lfs only says
 * when each file is done, so a big project would look stuck.
 */
export async function clone(
  runner: (cwd: string) => GitRunner,
  url: string,
  destination: string,
  onProgress?: ProgressListener,
) {
  const tracker = new ProgressTracker("clone");
  const options = reportProgress(tracker, onProgress);
  const cloned = await runner(".").text(
    [
      // Leave LFS files as pointers for now.
      ...["-c", "filter.lfs.process=", "-c", "filter.lfs.smudge="],
      ...["-c", "filter.lfs.required=false", "clone"],
      ...(onProgress ? ["--progress"] : []),
      ...["--", url, destination],
    ],
    undefined,
    options,
  );
  if (cloned.code !== 0)
    throw new Error(withoutProgress(cloned.stderr) || "git clone failed");

  // Only where the clone itself would have downloaded them: with Git LFS set
  // up and not told to skip downloads.
  const repository = runner(destination);
  const filters = await repository.text([
    "config",
    "--get-regexp",
    "^filter\\.lfs\\.(process|smudge)$",
  ]);
  if (filters.code !== 0 || filters.stdout.includes("--skip")) return;
  const pending = await pendingLfs(repository);
  if (pending?.files === 0) return;
  if (pending) tracker.expect(pending);
  const pulled = await repository.text(["lfs", "pull"], undefined, options);
  if (pulled.code !== 0)
    throw new Error(withoutProgress(pulled.stderr) || "git lfs pull failed");
}
