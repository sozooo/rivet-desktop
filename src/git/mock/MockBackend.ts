import { demoFlags } from "../../demoFlags";
import type { GitBackend, TransferOptions } from "../backend";
import { localName } from "../branches";
import { isConflicted } from "../conflicts";
import { SMART_MERGE_EXTENSIONS, tooLarge } from "../lfs";
import { extension } from "../paths";
import type {
  Commit,
  CommitMessage,
  CommitScope,
  FileChange,
  FileVersion,
  Operation,
  Person,
  RecentFile,
  RepoSnapshot,
  Revision,
  Side,
  UnityGenerated,
} from "../types";
import * as assets from "./assets";
import * as fixtures from "./fixtures";
import {
  demoGenerated,
  generatedChanges,
  gitignoreChange,
  untrackCommit,
} from "./generated";
import { bulkFiles, projectFiles, withMetaFiles } from "./projectFiles";
import { demoTransfers } from "./simulate";

type StoredStash = {
  message: string;
  branch: string;
  date: number;
  files: FileChange[];
};

const clone = <T>(value: T): T => structuredClone(value);
const randomSha = () =>
  Array.from({ length: 7 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
const unstage = (files: FileChange[]) =>
  files.map((f) => ({
    ...f,
    staged: false,
    hunks: f.hunks.map((h) => ({ ...h, staged: false })),
  }));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** How often a simulated teammate pushes while the demo is open. */
const PUSH_EVERY = 4 * 60_000;

/**
 * An in-memory repository that follows git semantics closely enough to drive
 * the UI: staging, commits, stashes, branches and a simulated remote. Pulling
 * onto unpublished work stops on conflicts, so the conflict screens can be
 * tried out.
 */
export class MockBackend implements GitBackend {
  private user: Person = fixtures.people.alex;
  private files: FileChange[];
  private commits: Commit[];
  private contents: Map<string, FileChange[]>;
  private stashList: StoredStash[];
  private current: string;
  private local: string[];
  private remote: string[];
  private tags: string[];
  private hasRemote: boolean;
  private ahead: number;
  private incoming: Omit<Commit, "parents">[];
  private lastFetched: number | null;
  private operation: Operation | null = null;
  /** Working changes from before a merge, for when it is cancelled. */
  private beforeMerge: FileChange[] = [];
  private lfsPatterns: string[];
  private lfsDownloaded = false;
  private smartMerge: boolean | undefined;
  /** Oversized files committed but not pushed yet. */
  private unpushedLarge: { path: string; size: number }[] = [];
  /** Teammates' commits still on their way to the remote, and when the next one lands. */
  private arriving: ReturnType<typeof fixtures.colleagueCommits>;
  private nextArrival = Date.now();
  /** Files put back to an older version, and the revision their contents come from. */
  private restored = new Map<string, Revision>();
  /** Unity's generated files no .gitignore leaves out; only with `?gitignore=`. */
  private generated: UnityGenerated | undefined;
  /** Files in the project that no commit in the sample history touches. */
  private untouched: string[];
  /** `?files=<n>`: that many more, for trying search on a big project. */
  private bulk: string[];

  /**
   * "empty" is a repository Rivet just created for a Unity project, with only
   * Unity's .gitignore in it. `variant` "kinetic-sandbox" adds a video too
   * large for GitHub.
   */
  constructor(kind: "sample" | "empty", variant?: string) {
    const sample = kind === "sample";
    this.files = sample ? fixtures.workingChanges() : [gitignoreChange()];
    if (sample && variant === "kinetic-sandbox")
      this.files.push(fixtures.largeVideo());
    this.generated = sample ? demoGenerated(demoFlags.gitignore) : undefined;
    if (this.generated?.tracked.length) this.files.push(...generatedChanges());
    this.commits = sample ? fixtures.history() : [];
    this.contents = sample ? fixtures.commitContents() : new Map();
    this.stashList = sample ? fixtures.stashes() : [];
    this.current = sample ? "feature/player-movement" : "main";
    this.local = sample
      ? ["main", "develop", "feature/player-movement", "fix/camera-jitter"]
      : ["main"];
    this.remote = sample
      ? ["origin/main", "origin/develop", "origin/art/forest-textures"]
      : [];
    this.tags = sample ? ["v0.3.0", "v0.2.0"] : [];
    this.hasRemote = sample;
    this.ahead = sample ? 3 : 0;
    this.incoming = sample ? fixtures.incoming() : [];
    this.arriving = sample ? fixtures.colleagueCommits() : [];
    this.lastFetched = sample ? Date.now() - 4 * 60_000 : null;
    // The sample keeps Photoshop files in LFS, but not the rest of its art.
    this.lfsPatterns = sample ? ["*.psd"] : [];
    this.smartMerge = sample ? false : undefined;
    this.untouched = sample ? projectFiles() : [];
    this.bulk = sample ? bulkFiles(demoFlags.files) : [];
  }

  async snapshot(): Promise<RepoSnapshot> {
    const files = this.files.map((f) => ({
      ...f,
      size: f.status === "deleted" ? undefined : fixtures.sizes[f.path],
      lfs: this.inLfs(f.path) || undefined,
    }));
    return clone({
      user: this.user,
      files,
      commits: this.commits,
      branches: {
        current: this.current,
        local: this.local,
        remote: this.remote,
        tags: this.tags,
      },
      stashes: this.stashList.map((s, index) => ({
        index,
        message: s.message,
        branch: s.branch,
        date: s.date,
        fileCount: s.files.length,
      })),
      sync: {
        upstream: this.hasRemote ? `origin/${this.current}` : null,
        ahead: this.ahead,
        behind: this.incoming.length,
        lastFetched: this.lastFetched,
        tooLarge: this.unpushedLarge.length ? this.unpushedLarge : undefined,
      },
      operation: this.operation,
      lfs: { installed: true, tracking: this.lfsPatterns.length > 0 },
      smartMerge: this.smartMerge,
      generated:
        this.generated?.untracked.length || this.generated?.tracked.length
          ? this.generated
          : undefined,
    });
  }

  private inLfs(path: string) {
    return this.lfsPatterns.includes(`*.${extension(path)}`);
  }

  /** What the commit at `index` in the history changed. */
  private changesAt(index: number) {
    const sha = this.commits[index]?.sha;
    return this.contents.get(sha) ?? fixtures.sampleContents(index);
  }

  async commitFiles(sha: string) {
    const index = this.commits.findIndex((c) => c.sha === sha);
    return clone(this.changesAt(Math.max(index, 0)));
  }

  async fileHistory(path: string) {
    const versions: FileVersion[] = [];
    this.commits.forEach((commit, index) => {
      const file = this.changesAt(index).find((f) => f.path === path);
      if (file) versions.push({ commit, path, status: file.status });
    });
    // The rest of the project came with the first commit.
    const first = this.commits[this.commits.length - 1];
    if (!versions.length && first && (await this.trackedFiles()).includes(path))
      versions.push({ commit: first, path, status: "added" });
    return clone(versions);
  }

  async trackedFiles() {
    const live = new Set(this.untouched);
    // Oldest first, so what a later commit deleted stays deleted.
    for (let index = this.commits.length - 1; index >= 0; index--)
      for (const file of this.changesAt(index))
        if (file.status === "deleted") live.delete(file.path);
        else live.add(file.path);
    return [...withMetaFiles(live), ...this.bulk];
  }

  async recentFiles(commits: number) {
    const seen = new Map<string, RecentFile>();
    this.commits.slice(0, commits).forEach((commit, index) => {
      for (const file of this.changesAt(index))
        if (!seen.has(file.path))
          seen.set(file.path, {
            path: file.path,
            sha: commit.sha,
            date: commit.date,
            deleted: file.status === "deleted",
          });
    });
    return [...seen.values()];
  }

  async stashFiles(index: number) {
    return clone(this.stash_(index).files);
  }

  async compareBranch(branch: string, base: string) {
    const [ahead, behind] =
      branch === base ? [0, 0] : (fixtures.divergence[branch] ?? [0, 0]);
    return { base, ahead, behind };
  }

  async readFile(path: string, revision: string): Promise<Uint8Array | null> {
    const conflicted = this.files.find((f) => f.path === path && f.conflict);
    if (conflicted) {
      // Stage 3 and MERGE_HEAD are the server's; the rest is mine, or what was kept.
      const kept = conflicted.conflict!.resolution;
      const side: Side =
        revision === ":3" || revision === "MERGE_HEAD"
          ? "theirs"
          : (revision === "worktree" || revision === "index") &&
              kept === "theirs"
            ? "theirs"
            : "mine";
      const bytes = fixtures.conflictSide(path, side);
      if (bytes !== undefined) return bytes;
    }
    const restored = this.restored.get(path);
    if (restored && (revision === "worktree" || revision === "index"))
      return this.readFile(path, restored);
    // A put-back file is compared with the latest commit's version.
    if (restored && revision === "HEAD" && this.commits[0])
      return this.readFile(path, this.commits[0].sha);
    if (path === "Assets/Art/Cliffs.psd" && this.lfsDownloaded)
      return fixtures.sampleFile("Assets/Art/Poster.psd", false) ?? null;
    // Commits are "x" vs "x^", stashes "stash@{n}" vs "stash@{n}^1", working changes HEAD vs worktree.
    const before =
      revision === "HEAD" ||
      /\^\d*$/.test(revision) ||
      this.firstOfSeveral(path, revision);
    const sample = fixtures.sampleFile(path, before);
    return sample instanceof Promise ? sample : (sample ?? null);
  }

  /** A file's first version, from before a later commit changed it: "before" in the samples. */
  private firstOfSeveral(path: string, sha: string) {
    const index = this.commits.findIndex((c) => c.sha === sha);
    if (index === -1) return false;
    const changes = (i: number) =>
      this.changesAt(i).find((f) => f.path === path);
    return (
      changes(index)?.status === "added" &&
      this.commits.slice(0, index).some((_, i) => changes(i))
    );
  }

  async resolveGuid(guid: string) {
    return assets.guidPaths[guid] ?? null;
  }

  async setStaged(path: string, staged: boolean, hunk?: number) {
    const file = this.file_(path);
    if (!file.hunks.length) file.staged = staged;
    file.hunks = file.hunks.map((h, i) =>
      hunk === undefined || i === hunk ? { ...h, staged } : h,
    );
  }

  async setAllStaged(staged: boolean) {
    for (const file of this.files) {
      if (!file.hunks.length) file.staged = staged;
      file.hunks = file.hunks.map((h) => ({ ...h, staged }));
    }
  }

  async discard(path: string) {
    this.file_(path);
    this.files = this.files.filter((f) => f.path !== path);
    this.restored.delete(path);
  }

  async commit(
    message: { summary: string; description: string },
    scope: CommitScope,
  ) {
    if (!message.summary.trim()) throw new Error("Add a commit summary.");
    if (this.operation || this.files.some(isConflicted))
      throw new Error("Finish or cancel the merge first.");
    if (scope === "all") await this.setAllStaged(true);
    // Binary files have no hunks; their `staged` flag stands for the whole file.
    const isStagedBinary = (f: FileChange) => !f.hunks.length && !!f.staged;
    const staged = this.files
      .map((f) => ({ ...f, hunks: f.hunks.filter((h) => h.staged) }))
      .filter((f) => f.hunks.length || isStagedBinary(f));
    if (!staged.length) throw new Error("There is nothing to commit.");
    const commit: Commit = {
      sha: randomSha(),
      summary: message.summary.trim(),
      description: message.description.trim(),
      author: this.user,
      date: Date.now(),
      parents: this.commits[0] ? [this.commits[0].sha] : [],
    };
    for (const f of (await this.snapshot()).files)
      if (tooLarge(f) && staged.some((s) => s.path === f.path))
        this.unpushedLarge.push({ path: f.path, size: f.size! });
    this.contents.set(commit.sha, staged);
    for (const f of staged) this.restored.delete(f.path);
    this.commits = [commit, ...this.commits];
    this.files = this.files
      .filter((f) => !isStagedBinary(f))
      .map((f) => ({ ...f, hunks: f.hunks.filter((h) => !h.staged) }))
      .filter((f) => f.hunks.length || f.binary);
    this.ahead++;
    return clone(commit);
  }

  async undoLastCommit(): Promise<CommitMessage> {
    if (this.operation) throw new Error("Finish or cancel the merge first.");
    const [head] = this.commits;
    if (!head?.parents.length)
      throw new Error("The first commit has nothing before it to go back to.");
    if (head.parents.length > 1)
      throw new Error("A merge commit can't be undone this way.");
    if (this.hasRemote && !this.ahead)
      throw new Error(
        "This commit is already pushed. Undo it with a new commit (revert) instead.",
      );
    // Like `git reset --soft`: the commit's changes come back selected.
    for (const file of clone(this.changesAt(0))) {
      const existing = this.files.find((f) => f.path === file.path);
      if (!existing) {
        this.files.push({
          ...file,
          staged: true,
          hunks: file.hunks.map((h) => ({ ...h, staged: true })),
        });
        continue;
      }
      existing.staged = true;
      for (const hunk of file.hunks) {
        const same = existing.hunks.find((h) => h.header === hunk.header);
        if (same) same.staged = true;
        else existing.hunks.push({ ...hunk, staged: true });
      }
    }
    this.commits = this.commits.slice(1);
    this.contents.delete(head.sha);
    this.ahead--;
    const paths = new Set(this.files.map((f) => f.path));
    this.unpushedLarge = this.unpushedLarge.filter((f) => !paths.has(f.path));
    return { summary: head.summary, description: head.description };
  }

  async restoreFile(path: string, revision: Revision) {
    await wait(300);
    const sha = revision.replace(/\^$/, "");
    const index = this.commits.findIndex((c) => c.sha === sha);
    if (index === -1) throw new Error(`${revision} is not in this history.`);
    const inCommit = this.changesAt(index).find((f) => f.path === path);
    // A file brought back from before the commit that deleted it is new again.
    const back = sha !== revision;
    this.files = this.files.filter((f) => f.path !== path);
    this.files.push({
      path,
      status: back && inCommit?.status === "deleted" ? "added" : "modified",
      hunks: clone(inCommit?.hunks ?? []).map((h) => ({ ...h, staged: false })),
      binary: inCommit?.binary,
    });
    this.restored.set(path, revision);
  }

  async stash() {
    if (!this.files.length) throw new Error("There are no changes to stash.");
    this.stashList = [
      {
        message: `Changes on ${this.current}`,
        branch: this.current,
        date: Date.now(),
        files: unstage(this.files),
      },
      ...this.stashList,
    ];
    this.files = [];
  }

  async stashPop(index: number) {
    const stash = this.stash_(index);
    for (const restored of unstage(stash.files)) {
      const existing = this.files.find((f) => f.path === restored.path);
      if (existing) existing.hunks = [...existing.hunks, ...restored.hunks];
      else this.files.push(restored);
    }
    this.stashList = this.stashList.filter((_, i) => i !== index);
  }

  async stashDrop(index: number) {
    this.stash_(index);
    this.stashList = this.stashList.filter((_, i) => i !== index);
  }

  async createBranch(name: string) {
    if (this.local.includes(name))
      throw new Error(`A branch named ${name} already exists.`);
    this.local = [...this.local, name];
  }

  async switchBranch(name: string) {
    if (!this.local.includes(name)) {
      if (!this.remote.includes(name))
        throw new Error(`No branch named ${name}.`);
      name = localName(name);
      if (!this.local.includes(name)) this.local = [...this.local, name];
    }
    this.current = name;
  }

  async fetch(options?: TransferOptions & { background?: boolean }) {
    if ((options?.onProgress || options?.cancel) && !options.background)
      await demoTransfers.fetch(options);
    else await wait(900);
    this.lastFetched = Date.now();
    // Whatever teammates pushed since the last check is waiting on the remote.
    while (this.arriving.length && this.nextArrival <= this.lastFetched) {
      const { commit } = this.arriving.shift()!;
      this.incoming = [{ ...commit, date: this.nextArrival }, ...this.incoming];
      this.nextArrival += PUSH_EVERY;
    }
  }

  async pull(options?: TransferOptions) {
    if (!this.incoming.length) return;
    // Cancelled while downloading, nothing below happens.
    if (options?.onProgress || options?.cancel)
      await demoTransfers.pull(options);
    if (!this.ahead) return this.mergeIncoming([]);
    // Both sides changed the same files: the merge stops for a decision.
    const merge = fixtures.mergeConflict();
    const taken = new Set(merge.flatMap((f) => [f.path, `${f.path}.meta`]));
    this.beforeMerge = this.files;
    this.files = [...merge, ...this.files.filter((f) => !taken.has(f.path))];
    this.operation = {
      kind: "merge",
      message: `Merge branch '${this.current}' of origin`,
      mine: "HEAD",
      theirs: "MERGE_HEAD",
    };
  }

  /** Adds the remote's commits, with a merge commit when this branch has its own. */
  private mergeIncoming(merged: FileChange[]) {
    // Remote commits continue from the last commit both sides share.
    const base = this.commits[this.ahead]?.sha;
    const chain = this.incoming.map((c, i, all) => ({
      ...c,
      parents: [all[i + 1]?.sha ?? base].filter(Boolean) as string[],
    }));
    const merge: Commit[] = this.ahead
      ? [
          {
            sha: randomSha(),
            summary: `Merge branch '${this.current}' of origin`,
            description: "",
            author: this.user,
            date: Date.now(),
            parents: [this.commits[0].sha, chain[0].sha],
          },
        ]
      : [];
    if (merge.length) this.contents.set(merge[0].sha, unstage(merged));
    this.commits = [...merge, ...chain, ...this.commits];
    if (merge.length) this.ahead++;
    this.incoming = [];
  }

  async push(options?: TransferOptions) {
    if (!this.hasRemote) throw new Error("This repository has no remote yet.");
    if (this.operation) throw new Error("Finish or cancel the merge first.");
    if (options?.onProgress || options?.cancel)
      await demoTransfers.push(options);
    this.ahead = 0;
    this.unpushedLarge = [];
  }

  private conflict_(path: string) {
    const file = this.file_(path);
    if (!file.conflict) throw new Error(`${path} has no conflict.`);
    return file;
  }

  async resolveConflict(path: string, side: Side) {
    const file = this.conflict_(path);
    file.conflict = { ...file.conflict!, resolution: side };
  }

  async markResolved(path: string) {
    const file = this.conflict_(path);
    file.conflict = { ...file.conflict!, resolution: "manual" };
  }

  async abortOperation() {
    if (!this.operation) throw new Error("There is nothing to cancel.");
    this.files = this.beforeMerge;
    this.operation = null;
  }

  async finishOperation() {
    if (!this.operation) throw new Error("There is nothing to finish.");
    if (this.files.some(isConflicted))
      throw new Error("Choose a version for every conflicted file first.");
    const merged = this.files.filter(
      (f) => f.conflict || f.staged || f.hunks.some((h) => h.staged),
    );
    this.files = this.files.filter((f) => !merged.includes(f));
    this.operation = null;
    this.mergeIncoming(merged);
  }

  /** Adds lines to .gitattributes, which then shows up as a change to save. */
  private addAttributes(lines: string[]) {
    const path = ".gitattributes";
    const existing = this.files.find((f) => f.path === path);
    const hunk = {
      header: "@@ -1,0 +1,0 @@",
      lines: lines.map((text) => ({ kind: "add" as const, text })),
      staged: false,
    };
    if (existing) existing.hunks = [...existing.hunks, hunk];
    else
      this.files = [
        ...this.files,
        { path, status: "modified", hunks: [hunk], size: 120 },
      ];
  }

  async setupLfs(patterns: string[]) {
    await wait(600);
    const added = patterns.filter((p) => !this.lfsPatterns.includes(p));
    this.lfsPatterns = [...this.lfsPatterns, ...added];
    this.addAttributes(
      added.map((p) => `${p} filter=lfs diff=lfs merge=lfs -text`),
    );
  }

  async lfsPull(options?: TransferOptions) {
    if (options?.onProgress || options?.cancel)
      await demoTransfers.lfsPull(options);
    else await wait(1200);
    this.lfsDownloaded = true;
  }

  async setupSmartMerge() {
    if (this.smartMerge === undefined)
      throw new Error("This is not a Unity project.");
    this.smartMerge = true;
    this.addAttributes(
      SMART_MERGE_EXTENSIONS.map((e) => `*.${e} merge=unityyamlmerge`),
    );
  }

  async ignoreUnityGenerated() {
    await wait(400);
    // Without the demo switch, the sample's own .gitignore already has it all.
    if (!this.generated) return [];
    this.generated = { ...this.generated, untracked: [] };
    if (this.files.some((f) => f.path === ".gitignore")) return [];
    this.files.push(gitignoreChange());
    return [".gitignore"];
  }

  async untrackUnityGenerated(message: CommitMessage) {
    await wait(900);
    if (this.operation) throw new Error("Finish or cancel the merge first.");
    const tracked = this.generated?.tracked ?? [];
    if (!tracked.length)
      throw new Error("Nothing Unity generates is committed.");
    const commit: Commit = {
      sha: randomSha(),
      summary: message.summary.trim(),
      description: message.description.trim(),
      author: this.user,
      date: Date.now(),
      parents: this.commits[0] ? [this.commits[0].sha] : [],
    };
    this.contents.set(commit.sha, untrackCommit(tracked));
    this.commits = [commit, ...this.commits];
    this.ahead++;
    // Their changes and the .gitignore went into the commit; the rest stays as it was.
    const gone = (path: string) =>
      path === ".gitignore" ||
      tracked.some((t) => (t.endsWith("/") ? path.startsWith(t) : path === t));
    this.files = this.files.filter((f) => !gone(f.path));
    this.generated = undefined;
    return clone(commit);
  }

  private file_(path: string) {
    const file = this.files.find((f) => f.path === path);
    if (!file) throw new Error(`${path} has no changes.`);
    return file;
  }

  private stash_(index: number) {
    const stash = this.stashList[index];
    if (!stash) throw new Error(`stash@{${index}} does not exist.`);
    return stash;
  }
}
