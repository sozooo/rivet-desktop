import type { GitBackend } from "../backend";
import type {
  Commit,
  CommitScope,
  FileChange,
  Hunk,
  RepoSnapshot,
  Revision,
} from "../types";
import {
  LOG_FORMAT,
  STASH_FORMAT,
  fileStatus,
  looksBinary,
  parseDiff,
  parseLog,
  parseRefs,
  parseStashList,
  parseStatus,
  untrackedDiff,
  type FileDiff,
  type RawHunk,
  type StatusEntry,
} from "./parse";
import { GitError, type GitRunner } from "./runner";

/** Untracked text files larger than this are listed without their contents. */
const MAX_UNTRACKED_TEXT = 512 * 1024;
/** Reading every new file can be slow in big Unity projects. */
const MAX_UNTRACKED_READS = 200;
const LOG_LIMIT = 400;

type Tracked = {
  entry: StatusEntry;
  /** Selected parts first, then the rest, in the same order as FileChange.hunks. */
  hunks: { staged: boolean; patchHeader: string; raw: RawHunk }[];
};

const toHunk = (raw: RawHunk, staged: boolean): Hunk => ({
  header: raw.header,
  lines: raw.lines,
  staged,
});

/** A GitBackend that runs the git command-line tool in a real repository. */
export class CliBackend implements GitBackend {
  /** The last snapshot's files, so hunk indices can be turned back into patches. */
  private tracked = new Map<string, Tracked>();
  private hasHead = false;
  private branch = "";
  private upstream: string | null = null;
  private loaded = false;

  constructor(private git: GitRunner) {}

  /** Methods below rely on the last snapshot; take one if there is none yet. */
  private async ensureLoaded() {
    if (!this.loaded) await this.snapshot();
  }

  private async trackedFile(path: string) {
    await this.ensureLoaded();
    const file = this.tracked.get(path);
    if (!file) throw new Error(`${path} has no changes.`);
    return file;
  }

  private async run(args: string[], stdin?: string) {
    const result = await this.git.text(args, stdin);
    if (result.code !== 0)
      throw new GitError(
        result.stderr.trim() || result.stdout.trim() || `git ${args[0]} failed`,
        args,
        result.code,
      );
    return result.stdout;
  }

  /** Like run, but an error just means "nothing". */
  private async tryRun(args: string[]) {
    const result = await this.git.text(args);
    return result.code === 0 ? result.stdout : "";
  }

  async snapshot(): Promise<RepoSnapshot> {
    const [
      statusOut,
      unstagedOut,
      stagedOut,
      refsOut,
      stashOut,
      name,
      email,
      fetchHead,
    ] = await Promise.all([
      this.run([
        "status",
        "--porcelain=v2",
        "-z",
        "--branch",
        "--untracked-files=all",
      ]),
      this.run(["diff", "--no-color", "--no-ext-diff", "-M"]),
      this.run(["diff", "--cached", "--no-color", "--no-ext-diff", "-M"]),
      this.run([
        "for-each-ref",
        "--format=%(refname)",
        "refs/heads",
        "refs/remotes",
        "refs/tags",
      ]),
      this.tryRun(["stash", "list", `--format=${STASH_FORMAT}`]),
      this.tryRun(["config", "user.name"]),
      this.tryRun(["config", "user.email"]),
      this.tryRun(["rev-parse", "--git-path", "FETCH_HEAD"]),
    ]);
    const status = parseStatus(statusOut);
    this.hasHead = status.oid !== null;
    this.branch = status.head;
    this.upstream = status.upstream;
    this.loaded = true;

    const [commits, files, stashes, lastFetched] = await Promise.all([
      this.hasHead
        ? this.run([
            "log",
            `-n${LOG_LIMIT}`,
            "--date-order",
            `--format=${LOG_FORMAT}`,
            "HEAD",
          ]).then((out) => parseLog(out, status.head))
        : Promise.resolve([] as Commit[]),
      this.buildFiles(
        status.entries,
        parseDiff(stagedOut),
        parseDiff(unstagedOut),
      ),
      Promise.all(
        parseStashList(stashOut).map(async (stash) => ({
          ...stash,
          fileCount: (
            await this.tryRun([
              "stash",
              "show",
              "--name-only",
              "-z",
              "--include-untracked",
              `stash@{${stash.index}}`,
            ])
          )
            .split("\0")
            .filter(Boolean).length,
        })),
      ),
      fetchHead.trim()
        ? this.git.modifiedTime(fetchHead.trim())
        : Promise.resolve(null),
    ]);
    const refs = parseRefs(refsOut);

    return {
      user: { name: name.trim() || "Unknown", email: email.trim() },
      files,
      commits,
      branches: { current: status.head, ...refs },
      stashes,
      sync: {
        upstream: status.upstream,
        ahead: status.ahead,
        behind: status.behind,
        lastFetched,
      },
    };
  }

  private async buildFiles(
    entries: StatusEntry[],
    stagedDiffs: FileDiff[],
    unstagedDiffs: FileDiff[],
  ): Promise<FileChange[]> {
    const staged = new Map(stagedDiffs.map((d) => [d.path, d]));
    const unstaged = new Map(unstagedDiffs.map((d) => [d.path, d]));
    this.tracked.clear();
    let reads = 0;
    const files = await Promise.all(
      entries.map(async (entry): Promise<FileChange> => {
        const fromIndex = staged.get(entry.path);
        let fromWorktree = unstaged.get(entry.path);
        if (entry.untracked && reads++ < MAX_UNTRACKED_READS) {
          const bytes = await this.git.readWorktree(entry.path);
          fromWorktree =
            bytes && bytes.length <= MAX_UNTRACKED_TEXT && !looksBinary(bytes)
              ? untrackedDiff(entry.path, new TextDecoder().decode(bytes))
              : { ...untrackedDiff(entry.path, ""), binary: !!bytes?.length };
        }
        const hunks = [
          ...(fromIndex?.hunks ?? []).map((raw) => ({
            staged: true,
            patchHeader: fromIndex!.patchHeader,
            raw,
          })),
          ...(fromWorktree?.hunks ?? []).map((raw) => ({
            staged: false,
            patchHeader: fromWorktree!.patchHeader,
            raw,
          })),
        ];
        this.tracked.set(entry.path, { entry, hunks });
        const binary = !!(fromIndex?.binary || fromWorktree?.binary);
        return {
          path: entry.path,
          oldPath: entry.oldPath,
          status: fileStatus(entry),
          hunks: hunks.map((h) => toHunk(h.raw, h.staged)),
          binary: binary || undefined,
          // Without hunks, a file counts as selected once all its changes are in the index.
          staged:
            entry.index !== "." &&
            entry.index !== "?" &&
            entry.worktree === ".",
        };
      }),
    );
    return files;
  }

  async commitFiles(sha: string) {
    const out = await this.run([
      "show",
      "--format=",
      "--no-color",
      "--no-ext-diff",
      "-M",
      "--diff-merges=first-parent",
      sha,
    ]);
    return parseDiff(out).map(diffToChange);
  }

  async stashFiles(index: number) {
    const out = await this.run([
      "stash",
      "show",
      "-p",
      "--no-color",
      "--include-untracked",
      `stash@{${index}}`,
    ]);
    return parseDiff(out).map(diffToChange);
  }

  async compareBranch(branch: string, base: string) {
    const out = await this.tryRun([
      "rev-list",
      "--left-right",
      "--count",
      `${base}...${branch}`,
    ]);
    const [behind, ahead] = out.trim().split(/\s+/).map(Number);
    return { base, ahead: ahead || 0, behind: behind || 0 };
  }

  async readFile(path: string, revision: Revision) {
    if (revision === "worktree") return this.git.readWorktree(path);
    const spec = revision === "index" ? `:${path}` : `${revision}:${path}`;
    try {
      return await this.git.bytes(["show", spec]);
    } catch {
      return null;
    }
  }

  async resolveGuid(guid: string) {
    if (!/^[0-9a-f]{32}$/i.test(guid)) return null;
    const out = await this.tryRun([
      "grep",
      "-l",
      "-F",
      `guid: ${guid}`,
      "--",
      "*.meta",
    ]);
    const meta = out.split("\n").find(Boolean);
    return meta ? meta.replace(/\.meta$/, "") : null;
  }

  async setStaged(path: string, staged: boolean, hunk?: number) {
    const file = await this.trackedFile(path);
    const target = hunk === undefined ? undefined : file.hunks[hunk];
    // New files and binary files can only be selected as a whole.
    if (!target || file.entry.untracked || !target.patchHeader) {
      await (staged ? this.add([path]) : this.unstage(file.entry));
      return;
    }
    if (target.staged === staged) return;
    await this.run(
      [
        "apply",
        "--cached",
        "--whitespace=nowarn",
        ...(staged ? [] : ["--reverse"]),
        "-",
      ],
      target.patchHeader + target.raw.text,
    );
  }

  async setAllStaged(staged: boolean) {
    await this.ensureLoaded();
    if (staged) await this.run(["add", "--all"]);
    else if (this.hasHead) await this.run(["reset", "-q"]);
    else await this.run(["rm", "-r", "-q", "--cached", "--", "."]);
  }

  private add(paths: string[]) {
    return this.run(["add", "--all", "--", ...paths]);
  }

  private unstage(entry: StatusEntry) {
    const paths = [entry.path, ...(entry.oldPath ? [entry.oldPath] : [])];
    return this.hasHead
      ? this.run(["restore", "--staged", "--", ...paths])
      : this.run(["rm", "-q", "--cached", "--", ...paths]);
  }

  async discard(path: string) {
    const { entry } = await this.trackedFile(path);
    if (entry.untracked) {
      await this.run(["clean", "-f", "-q", "--", path]);
    } else if (entry.index === "A" || entry.oldPath) {
      await this.run(["rm", "-f", "-q", "--", path]);
      if (entry.oldPath)
        await this.run([
          "restore",
          "--source=HEAD",
          "--staged",
          "--worktree",
          "--",
          entry.oldPath,
        ]);
    } else {
      await this.run([
        "restore",
        "--source=HEAD",
        "--staged",
        "--worktree",
        "--",
        path,
      ]);
    }
  }

  async commit(
    message: { summary: string; description: string },
    scope: CommitScope,
  ) {
    const summary = message.summary.trim();
    if (!summary) throw new Error("Add a commit summary.");
    await this.ensureLoaded();
    if (scope === "all") await this.run(["add", "--all"]);
    const nothingStaged =
      (await this.git.text(["diff", "--cached", "--quiet"])).code === 0;
    if (nothingStaged) throw new Error("There is nothing to commit.");
    const description = message.description.trim();
    await this.run(
      ["commit", "-q", "-F", "-"],
      description ? `${summary}\n\n${description}\n` : `${summary}\n`,
    );
    const [commit] = parseLog(
      await this.run(["log", "-n1", `--format=${LOG_FORMAT}`, "HEAD"]),
      this.branch,
    );
    return commit;
  }

  async stash() {
    await this.ensureLoaded();
    await this.run([
      "stash",
      "push",
      "--include-untracked",
      "-m",
      `Changes on ${this.branch}`,
    ]);
  }

  async stashPop(index: number) {
    await this.run(["stash", "pop", `stash@{${index}}`]);
  }

  async stashDrop(index: number) {
    await this.run(["stash", "drop", `stash@{${index}}`]);
  }

  async createBranch(name: string) {
    await this.run(["branch", "--", name]);
  }

  async switchBranch(name: string) {
    await this.run(["switch", name]);
  }

  async fetch() {
    await this.run(["fetch", "--all", "--prune"]);
  }

  async pull() {
    await this.run(["pull", "--no-rebase", "--no-edit"]);
  }

  async push() {
    await this.ensureLoaded();
    await this.run(
      this.upstream ? ["push"] : ["push", "--set-upstream", "origin", "HEAD"],
    );
  }
}

function diffToChange(diff: FileDiff): FileChange {
  return {
    path: diff.path,
    oldPath: diff.oldPath,
    status: diff.status,
    hunks: diff.hunks.map((h) => toHunk(h, false)),
    binary: diff.binary || undefined,
  };
}
