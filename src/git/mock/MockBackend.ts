import type { GitBackend } from "../backend";
import type {
  Commit,
  CommitScope,
  FileChange,
  Person,
  RepoSnapshot,
} from "../types";
import * as assets from "./assets";
import * as fixtures from "./fixtures";

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

/**
 * An in-memory repository that follows git semantics closely enough to drive
 * the UI: staging, commits, stashes, branches and a simulated remote.
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

  constructor(kind: "sample" | "empty") {
    const sample = kind === "sample";
    this.files = sample ? fixtures.workingChanges() : [];
    this.commits = sample ? fixtures.history() : [];
    this.contents = sample ? fixtures.commitContents() : new Map();
    this.stashList = sample ? fixtures.stashes() : [];
    this.current = sample ? "feature/player-movement" : "main";
    this.local = sample
      ? ["main", "develop", "feature/player-movement", "fix/camera-jitter"]
      : ["main"];
    this.remote = sample ? ["origin/main", "origin/develop"] : [];
    this.tags = sample ? ["v0.3.0", "v0.2.0"] : [];
    this.hasRemote = sample;
    this.ahead = sample ? 3 : 0;
    this.incoming = sample ? fixtures.incoming() : [];
    this.lastFetched = sample ? Date.now() - 4 * 60_000 : null;
  }

  async snapshot(): Promise<RepoSnapshot> {
    return clone({
      user: this.user,
      files: this.files,
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
      },
    });
  }

  async commitFiles(sha: string) {
    const index = this.commits.findIndex((c) => c.sha === sha);
    return clone(
      this.contents.get(sha) ?? fixtures.sampleContents(Math.max(index, 0)),
    );
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
    // Commits are "x" vs "x^", stashes "stash@{n}" vs "stash@{n}^1", working changes HEAD vs worktree.
    const before = revision === "HEAD" || /\^\d*$/.test(revision);
    const sample = fixtures.sampleFile(path, before);
    return sample instanceof Promise ? sample : (sample ?? null);
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
  }

  async commit(
    message: { summary: string; description: string },
    scope: CommitScope,
  ) {
    if (!message.summary.trim()) throw new Error("Add a commit summary.");
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
    this.contents.set(commit.sha, staged);
    this.commits = [commit, ...this.commits];
    this.files = this.files
      .filter((f) => !isStagedBinary(f))
      .map((f) => ({ ...f, hunks: f.hunks.filter((h) => !h.staged) }))
      .filter((f) => f.hunks.length || f.binary);
    this.ahead++;
    return clone(commit);
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
    if (!this.local.includes(name)) throw new Error(`No branch named ${name}.`);
    this.current = name;
  }

  async fetch() {
    await new Promise((resolve) => setTimeout(resolve, 900));
    this.lastFetched = Date.now();
  }

  async pull() {
    if (!this.incoming.length) return;
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
    this.commits = [...merge, ...chain, ...this.commits];
    if (merge.length) this.ahead++;
    this.incoming = [];
  }

  async push() {
    if (!this.hasRemote) throw new Error("This repository has no remote yet.");
    this.ahead = 0;
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
