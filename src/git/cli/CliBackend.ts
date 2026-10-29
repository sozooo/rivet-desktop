import type { GitBackend } from "../backend";
import { localName } from "../branches";
import { conflictStatus } from "../conflicts";
import { lfsPointer, type LfsPointer } from "../fileKinds";
import {
  GITHUB_LIMIT,
  SMART_MERGE_DRIVER,
  readAttributes,
  withSmartMerge,
} from "../lfs";
import type {
  Commit,
  CommitMessage,
  CommitScope,
  Conflict,
  FileChange,
  Hunk,
  Operation,
  OperationKind,
  RepoSnapshot,
  Revision,
  Side,
} from "../types";
import {
  FILE_LOG_FORMAT,
  LOG_FORMAT,
  STASH_FORMAT,
  conflictPaths,
  fileStatus,
  largeBlobs,
  looksBinary,
  parseCheckAttr,
  parseDiff,
  parseFileLog,
  parseLog,
  parseRefs,
  parseStages,
  parseStashList,
  parseStatus,
  untrackedDiff,
  type FileDiff,
  type RawHunk,
  type Status,
  type StatusEntry,
} from "./parse";
import { GitError, type GitRunner, type RunOptions } from "./runner";

/** Untracked text files larger than this are listed without their contents. */
const MAX_UNTRACKED_TEXT = 512 * 1024;
/** Reading every new file can be slow in big Unity projects. */
const MAX_UNTRACKED_READS = 200;
const LOG_LIMIT = 400;
const FILE_LOG_LIMIT = 200;

/**
 * Operations git leaves unfinished, by the file in .git that marks them, and
 * the commits holding my version and the incoming one. A rebase replays my
 * commits onto theirs, so there HEAD is theirs.
 */
const OPERATIONS: {
  kind: OperationKind;
  marker: string;
  mine: string;
  theirs: string;
}[] = [
  {
    kind: "rebase",
    marker: "rebase-merge",
    mine: "REBASE_HEAD",
    theirs: "HEAD",
  },
  {
    kind: "rebase",
    marker: "rebase-apply",
    mine: "REBASE_HEAD",
    theirs: "HEAD",
  },
  { kind: "merge", marker: "MERGE_HEAD", mine: "HEAD", theirs: "MERGE_HEAD" },
  {
    kind: "cherry-pick",
    marker: "CHERRY_PICK_HEAD",
    mine: "HEAD",
    theirs: "CHERRY_PICK_HEAD",
  },
  {
    kind: "revert",
    marker: "REVERT_HEAD",
    mine: "HEAD",
    theirs: "REVERT_HEAD^",
  },
];

const CONFLICT_MARKER = /^(<{7}|>{7})( |$)/m;

/** The operation under way, and the files git said conflict when it stopped. */
type OperationState = { operation: Operation | null; conflicts: string[] };

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
  /** Unity GUID lookups; cleared with every snapshot, since files move. */
  private guids = new Map<string, Promise<string | null>>();
  private commonDir?: Promise<string>;
  private operation: Operation | null = null;
  /** Paths of the markers in OPERATIONS, then MERGE_MSG, as git reports them. */
  private gitPaths?: Promise<string[]>;
  private lfsInstalled?: Promise<boolean>;
  private unityProject?: Promise<boolean>;
  /** Oversized files in unpushed commits, kept while HEAD and the upstream stay put. */
  private tooLarge?: {
    key: string;
    files: Promise<{ path: string; size: number }[]>;
  };
  /** The last fetch, pull or push: they take turns, since each moves remote refs. */
  private remoteTurn: Promise<unknown> = Promise.resolve();

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

  private async run(args: string[], stdin?: string, options?: RunOptions) {
    const result = await this.git.text(args, stdin, options);
    if (result.code !== 0)
      throw new GitError(
        result.stderr.trim() || result.stdout.trim() || `git ${args[0]} failed`,
        args,
        result.code,
      );
    return result.stdout;
  }

  /** Like run, but an error just means "nothing". */
  private async tryRun(args: string[], stdin?: string) {
    const result = await this.git.text(args, stdin);
    return result.code === 0 ? result.stdout : "";
  }

  /** Runs remote commands one at a time, so a background fetch can't collide with a pull. */
  private inTurn<T>(task: () => Promise<T>) {
    const turn = this.remoteTurn.then(task);
    this.remoteTurn = turn.catch(() => {});
    return turn;
  }

  /** Runs a command that may stop on conflicts; stopping there is not a failure. */
  private async runUntilConflict(args: string[]) {
    const result = await this.git.text(args);
    if (result.code === 0) return;
    if (await this.tryRun(["ls-files", "--unmerged", "-z"])) return;
    throw new GitError(
      result.stderr.trim() || result.stdout.trim() || `git ${args[0]} failed`,
      args,
      result.code,
    );
  }

  async snapshot(): Promise<RepoSnapshot> {
    this.guids.clear();
    this.gitPaths ??= this.run([
      "rev-parse",
      ...[...OPERATIONS.map((o) => o.marker), "MERGE_MSG"].flatMap((p) => [
        "--git-path",
        p,
      ]),
    ]).then((out) => out.split("\n").map((l) => l.trim()));
    this.lfsInstalled ??= this.git
      .text(["lfs", "version"])
      .then((r) => r.code === 0);
    this.unityProject ??= this.isUnityProject();
    const [
      statusOut,
      unstagedOut,
      stagedOut,
      refsOut,
      stashOut,
      name,
      email,
      fetchHead,
      attributes,
      lfsInstalled,
      unityProject,
      state,
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
      this.git.readWorktree(".gitattributes").then(text),
      this.lfsInstalled,
      this.unityProject,
      this.readOperation(),
    ]);
    const status = parseStatus(statusOut);
    this.hasHead = status.oid !== null;
    this.branch = status.head;
    this.upstream = status.upstream;
    this.operation = state.operation;
    this.loaded = true;
    const lfsTracking = readAttributes(attributes ?? "").lfs;

    const [commits, files, stashes, lastFetched, smartMerge, tooLarge] =
      await Promise.all([
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
          state,
          lfsTracking,
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
        unityProject ? this.smartMergeReady(attributes ?? "") : undefined,
        this.unpushedTooLarge(status),
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
        tooLarge: tooLarge.length ? tooLarge : undefined,
      },
      operation: state.operation,
      lfs: { installed: lfsInstalled, tracking: lfsTracking },
      smartMerge,
    };
  }

  /** Which operation is under way, from the files git keeps in .git while it is. */
  private async readOperation(): Promise<OperationState> {
    const paths = await this.gitPaths!;
    const present = await Promise.all(
      OPERATIONS.map(
        async (_, i) => (await this.git.modifiedTime(paths[i])) !== null,
      ),
    );
    const found = OPERATIONS.find((_, i) => present[i]);
    if (!found) return { operation: null, conflicts: [] };
    const message =
      text(await this.git.readWorktree(paths[OPERATIONS.length])) ?? "";
    return {
      operation: {
        kind: found.kind,
        message: message.split(/\r?\n/)[0] ?? "",
        mine: found.mine,
        theirs: found.theirs,
      },
      conflicts: conflictPaths(message),
    };
  }

  private async isUnityProject() {
    const version = "ProjectSettings/ProjectVersion.txt";
    if ((await this.git.modifiedTime(version)) !== null) return true;
    // A Unity project can live in a subfolder of the repository.
    return !!(await this.tryRun(["ls-files", "-z", "--", `*/${version}`]));
  }

  /** Whether scenes merge through a driver whose program is still installed. */
  private async smartMergeReady(attributes: string) {
    const driver = readAttributes(attributes).sceneDriver;
    if (!driver) return false;
    const command = (
      await this.tryRun(["config", "--get", `merge.${driver}.driver`])
    ).trim();
    const program = command.match(/^"([^"]+)"|^'([^']+)'|^(\S+)/);
    const path = program?.[1] ?? program?.[2] ?? program?.[3];
    if (!path) return false;
    // A bare program name is found through PATH; an editor that was uninstalled breaks merges.
    return !/[\\/]/.test(path) || (await this.git.modifiedTime(path)) !== null;
  }

  private unpushedTooLarge(status: Status) {
    if (!status.oid || (status.upstream && !status.ahead))
      return Promise.resolve([]);
    const key = `${status.oid} ${status.upstream} ${status.ahead}`;
    if (this.tooLarge?.key !== key)
      this.tooLarge = { key, files: this.findTooLarge(status.upstream) };
    return this.tooLarge.files;
  }

  /** Files GitHub would refuse in commits it hasn't seen yet; LFS files are only pointers here. */
  private async findTooLarge(upstream: string | null) {
    const objects = await this.tryRun([
      "rev-list",
      "--objects",
      "HEAD",
      ...(upstream ? [`^${upstream}`] : ["--not", "--remotes"]),
    ]);
    if (!objects.trim()) return [];
    const sizes = await this.tryRun(
      ["cat-file", "--batch-check=%(objecttype) %(objectsize) %(rest)"],
      objects,
    );
    return largeBlobs(sizes, GITHUB_LIMIT);
  }

  private async buildFiles(
    entries: StatusEntry[],
    stagedDiffs: FileDiff[],
    unstagedDiffs: FileDiff[],
    state: OperationState,
    lfsTracking: boolean,
  ): Promise<FileChange[]> {
    const staged = new Map(stagedDiffs.map((d) => [d.path, d]));
    const unstaged = new Map(unstagedDiffs.map((d) => [d.path, d]));
    this.tracked.clear();
    let reads = 0;
    const files = await Promise.all(
      entries.map(async (entry): Promise<FileChange> => {
        if (entry.conflicted) {
          this.tracked.set(entry.path, { entry, hunks: [] });
          return this.conflictFile(entry);
        }
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
    await this.addResolved(files, state.conflicts);
    await this.addSizes(files, lfsTracking);
    return files;
  }

  /** A file both sides changed: its hunks show how their version differs from mine. */
  private async conflictFile(entry: StatusEntry): Promise<FileChange> {
    const rebase = this.operation?.kind === "rebase";
    const { ours, theirs } = entry.stages!;
    const conflict: Conflict = rebase
      ? { mine: theirs, theirs: ours }
      : { mine: ours, theirs };
    const [mine, incoming] = rebase ? [":3", ":2"] : [":2", ":3"];
    const diff =
      ours && theirs
        ? parseDiff(
            await this.tryRun([
              "diff",
              "--no-color",
              "--no-ext-diff",
              `${mine}:${entry.path}`,
              `${incoming}:${entry.path}`,
            ]),
          )[0]
        : undefined;
    return {
      path: entry.path,
      status: conflictStatus(conflict.mine, conflict.theirs),
      hunks: (diff?.hunks ?? []).map((h) => toHunk(h, false)),
      binary: diff?.binary || undefined,
      conflict,
    };
  }

  /**
   * Conflicts already settled look like ordinary changes, or like no change at
   * all when my version was kept. Git remembers each one's sides ("resolve
   * undo"); comparing them with the index tells which version was kept.
   */
  private async addResolved(files: FileChange[], conflicts: string[]) {
    const settled = conflicts.filter(
      (path) => !files.some((f) => f.path === path && f.conflict),
    );
    if (!settled.length) return;
    const [undoOut, indexOut] = await Promise.all([
      this.tryRun(["ls-files", "--resolve-undo", "-z", "--", ...settled]),
      this.tryRun(["ls-files", "--stage", "-z", "--", ...settled]),
    ]);
    const undo = parseStages(undoOut);
    const index = parseStages(indexOut);
    const rebase = this.operation?.kind === "rebase";
    for (const path of settled) {
      const stages = undo.get(path);
      const [mineObject, theirsObject] = rebase
        ? [stages?.get(3), stages?.get(2)]
        : [stages?.get(2), stages?.get(3)];
      const mine = !stages || !!mineObject;
      const theirs = !stages || !!theirsObject;
      const kept = index.get(path)?.get(0);
      const resolution: Side | "manual" = kept
        ? kept === mineObject
          ? "mine"
          : kept === theirsObject
            ? "theirs"
            : "manual"
        : // Deleted: the side that had no file won.
          !mine
          ? "mine"
          : !theirs
            ? "theirs"
            : "manual";
      const conflict = { mine, theirs, resolution };
      const listed = files.find((f) => f.path === path);
      if (listed) listed.conflict = conflict;
      else
        files.push({
          path,
          status: conflictStatus(mine, theirs),
          hunks: [],
          conflict,
        });
    }
  }

  /** Sizes for large-file warnings, and which files go through Git LFS. */
  private async addSizes(files: FileChange[], lfsTracking: boolean) {
    const present = files.filter((f) => f.status !== "deleted");
    if (!present.length) return;
    const paths = present.map((f) => f.path);
    const [sizes, attributes] = await Promise.all([
      this.git.fileSizes(paths),
      lfsTracking
        ? this.tryRun(
            ["check-attr", "-z", "--stdin", "filter"],
            paths.join("\0"),
          ).then(parseCheckAttr)
        : null,
    ]);
    present.forEach((file, i) => {
      if (sizes[i] !== null) file.size = sizes[i];
      if (attributes?.get(file.path)?.filter === "lfs") file.lfs = true;
    });
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

  async fileHistory(path: string) {
    await this.ensureLoaded();
    const out = await this.run([
      "log",
      "--follow",
      `-n${FILE_LOG_LIMIT}`,
      "-M",
      `--format=${FILE_LOG_FORMAT}`,
      "--name-status",
      "--",
      literal(path),
    ]);
    return parseFileLog(out, this.branch, path);
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
    const bytes = await this.readBlob(path, revision);
    // Commits hold only pointers to LFS files; the files themselves are in .git/lfs.
    const pointer = lfsPointer(bytes);
    return pointer ? ((await this.lfsObject(pointer)) ?? bytes) : bytes;
  }

  private async readBlob(path: string, revision: Revision) {
    if (revision === "worktree") return this.git.readWorktree(path);
    const spec = revision === "index" ? `:${path}` : `${revision}:${path}`;
    try {
      return await this.git.bytes(["show", spec]);
    } catch {
      return null;
    }
  }

  /** A downloaded LFS object, or null when only its pointer is here. */
  private async lfsObject({ oid, size }: LfsPointer) {
    this.commonDir ??= this.tryRun(["rev-parse", "--git-common-dir"]).then(
      (out) => out.trim(),
    );
    const dir = await this.commonDir;
    if (!dir) return null;
    const object = await this.git.readWorktree(
      `${dir}/lfs/objects/${oid.slice(0, 2)}/${oid.slice(2, 4)}/${oid}`,
    );
    return object?.length === size ? object : null;
  }

  async resolveGuid(guid: string) {
    if (!/^[0-9a-f]{32}$/i.test(guid)) return null;
    let found = this.guids.get(guid);
    if (!found) {
      found = this.findGuid(guid);
      this.guids.set(guid, found);
    }
    return found;
  }

  private async findGuid(guid: string) {
    // New assets count too: an artist often uses a texture before committing it.
    const out = await this.tryRun([
      "grep",
      "-l",
      "-F",
      "--untracked",
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
    // `add --all` would mark conflicts resolved with their markers still in,
    // and a merge commit has to take the whole merge.
    if (
      this.operation ||
      [...this.tracked.values()].some((f) => f.entry.conflicted)
    )
      throw new Error("Finish or cancel the merge first.");
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

  async undoLastCommit(): Promise<CommitMessage> {
    if (await this.currentOperation())
      throw new Error("Finish or cancel the merge first.");
    const [head] = parseLog(
      await this.run(["log", "-n1", `--format=${LOG_FORMAT}`, "HEAD"]),
      this.branch,
    );
    if (!head.parents.length)
      throw new Error("The first commit has nothing before it to go back to.");
    if (head.parents.length > 1)
      throw new Error("A merge commit can't be undone this way.");
    // Once a remote has the commit, someone may have built on it.
    if ((await this.run(["branch", "-r", "--contains", "HEAD"])).trim())
      throw new Error(
        "This commit is already pushed. Undo it with a new commit (revert) instead.",
      );
    await this.run(["reset", "-q", "--soft", "HEAD~1"]);
    return { summary: head.summary, description: head.description };
  }

  async restoreFile(path: string, revision: Revision) {
    const spec = literal(path);
    await this.run([
      "restore",
      `--source=${revision}`,
      "--worktree",
      "--",
      spec,
    ]);
    // Changes selected before would mix with the restored file; they were given up.
    const selected =
      (await this.git.text(["diff", "--cached", "--quiet", "--", spec]))
        .code === 1;
    if (selected) await this.run(["restore", "--staged", "--", spec]);
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
    // Restoring onto changed files can stop on conflicts; git then keeps the stash.
    await this.runUntilConflict(["stash", "pop", `stash@{${index}}`]);
  }

  async stashDrop(index: number) {
    await this.run(["stash", "drop", `stash@{${index}}`]);
  }

  async createBranch(name: string) {
    await this.run(["branch", "--", name]);
  }

  async switchBranch(name: string) {
    const { local, remote } = parseRefs(
      await this.run([
        "for-each-ref",
        "--format=%(refname)",
        "refs/heads",
        "refs/remotes",
      ]),
    );
    if (local.includes(name) || !remote.includes(name))
      await this.run(["switch", name]);
    // The server's copy of a branch this computer has: go to the local one.
    else if (local.includes(localName(name)))
      await this.run(["switch", localName(name)]);
    // Only on the server: make a local copy that follows it.
    else await this.run(["switch", "--track", name]);
  }

  async fetch(options?: { background?: boolean }) {
    const background = !!options?.background;
    await this.inTurn(() =>
      this.run(
        [
          // Housekeeping can take minutes on a big project; leave it to fetches someone asked for.
          ...(background
            ? ["-c", "gc.auto=0", "-c", "maintenance.auto=false"]
            : []),
          "fetch",
          "--all",
          "--prune",
        ],
        undefined,
        { background },
      ),
    );
  }

  async pull() {
    await this.inTurn(() =>
      this.runUntilConflict(["pull", "--no-rebase", "--no-edit"]),
    );
  }

  async push() {
    await this.ensureLoaded();
    await this.inTurn(() =>
      this.run(
        this.upstream ? ["push"] : ["push", "--set-upstream", "origin", "HEAD"],
      ),
    );
  }

  /** The operation under way right now, not as of the last snapshot. */
  private async currentOperation() {
    await this.ensureLoaded();
    this.operation = (await this.readOperation()).operation;
    return this.operation;
  }

  private async unmergedStages(path: string) {
    const out = await this.tryRun(["ls-files", "--unmerged", "-z", "--", path]);
    return parseStages(out).get(path);
  }

  async resolveConflict(path: string, side: Side) {
    const operation = await this.currentOperation();
    let stages = await this.unmergedStages(path);
    if (!stages) {
      // A change of mind: git still knows both sides and can reopen the conflict.
      await this.run(["update-index", "--unresolve", "--", path]);
      stages = await this.unmergedStages(path);
      if (!stages) throw new Error(`${path} has no conflict.`);
    }
    const ours = (side === "mine") !== (operation?.kind === "rebase");
    if (stages.has(ours ? 2 : 3)) {
      await this.run(["checkout", ours ? "--ours" : "--theirs", "--", path]);
      await this.add([path]);
    } else {
      // That side deleted the file.
      await this.run(["rm", "-q", "--", path]);
    }
  }

  async markResolved(path: string) {
    const bytes = await this.git.readWorktree(path);
    if (bytes && !looksBinary(bytes) && CONFLICT_MARKER.test(text(bytes)!))
      throw new Error(
        `${path} still has conflict markers (<<<<<<< or >>>>>>>).`,
      );
    await this.add([path]);
  }

  async abortOperation() {
    const operation = await this.currentOperation();
    if (!operation) throw new Error("There is nothing to cancel.");
    await this.run([operation.kind, "--abort"]);
  }

  async finishOperation() {
    const operation = await this.currentOperation();
    if (!operation) throw new Error("There is nothing to finish.");
    if (operation.kind === "merge")
      await this.run(["commit", "-q", "--no-edit", "--cleanup=strip"]);
    // A rebase goes on to the next commit, which may stop on conflicts of its own.
    else
      await this.runUntilConflict([
        "-c",
        "core.editor=true",
        operation.kind,
        "--continue",
      ]);
  }

  async setupLfs(patterns: string[]) {
    await this.ensureLoaded();
    await this.run(["lfs", "install", "--local"]);
    await this.run(["lfs", "track", ...patterns]);
    // Files selected before hold their whole contents in the index; store them through LFS too.
    const selected = [...this.tracked.values()]
      .map(({ entry }) => entry)
      .filter(
        (e) =>
          !e.untracked && !e.conflicted && e.index !== "." && e.index !== "D",
      )
      .map((e) => e.path);
    if (!selected.length) return;
    const attributes = parseCheckAttr(
      await this.tryRun(
        ["check-attr", "-z", "--stdin", "filter"],
        selected.join("\0"),
      ),
    );
    const moved = selected.filter((p) => attributes.get(p)?.filter === "lfs");
    if (moved.length) await this.run(["add", "--renormalize", "--", ...moved]);
  }

  async lfsPull() {
    await this.run(["lfs", "pull"]);
  }

  async setupSmartMerge(tool: string) {
    const current = text(await this.git.readWorktree(".gitattributes")) ?? "";
    // Keep the driver name a project already uses for its scenes.
    const driver = readAttributes(current).sceneDriver ?? SMART_MERGE_DRIVER;
    const set = (key: string, value: string) =>
      this.run(["config", "--local", `merge.${driver}.${key}`, value]);
    await set("name", "Unity Smart Merge (UnityYAMLMerge)");
    // -h: no dialogs. --fallback none: no other merge tool pops up; what
    // Unity can't merge stays a conflict for Rivet to show.
    await set(
      "driver",
      `"${tool.replace(/\\/g, "/")}" merge -h -p --force --fallback none %O %B %A %A`,
    );
    await set("recursive", "binary");
    const next = withSmartMerge(current, driver);
    if (next !== current) await this.git.writeWorktree(".gitattributes", next);
  }
}

const text = (bytes: Uint8Array | null) =>
  bytes ? new TextDecoder().decode(bytes) : null;

/** A pathspec that matches only this path, even with [ ] or * in its name. */
const literal = (path: string) => `:(literal)${path}`;

function diffToChange(diff: FileDiff): FileChange {
  return {
    path: diff.path,
    oldPath: diff.oldPath,
    status: diff.status,
    hunks: diff.hunks.map((h) => toHunk(h, false)),
    binary: diff.binary || undefined,
  };
}
