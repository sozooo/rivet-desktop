import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { activityFor, type BranchActivity } from "../activity";
import {
  branchCommits,
  defaultBranch,
  mainRemote,
  parseActivityLog,
  parseActivityRefs,
  parseRemoteUrls,
} from "./activity";
import { CliBackend } from "./CliBackend";
import type { GitRunner } from "./runner";
import { cleanup, commitAs, git, makeDir, nodeRunner, write } from "./testRepo";

afterAll(cleanup);

const now = Date.now();
const hours = (n: number) => now - n * 3_600_000;
const days = (n: number) => hours(n * 24);
const ann = { name: "Ann Smith", email: "ann@studio.dev" };
const bob = { name: "Bob Ray", email: "bob@studio.dev" };
const cleo = { name: "Cleo Park", email: "cleo@studio.dev" };
const dana = { name: "Dana Brooks", email: "dana@studio.dev" };
const me = { name: "Test User", email: "test@example.com" };
/** Fields of git's output, as the formats separate them. */
const fields = (...parts: string[]) => parts.join("\x00");

/** Counts git runs, to keep branchActivity to a handful of them. */
function counted(runner: GitRunner) {
  const runs: string[][] = [];
  return {
    runs,
    runner: {
      ...runner,
      text: (args, stdin, options) => {
        runs.push(args);
        return runner.text(args, stdin, options);
      },
    } satisfies GitRunner,
  };
}

/**
 * A team's server and this computer's clone of it:
 * - main: an old start (outside the window), then Bob and Ann.
 * - feature/hair: Cleo twice, Ann (renamed, email in capitals), a merge
 *   from main, and one commit of mine not sent yet. Also on the server.
 * - art/forest: Dana, only on the server.
 * - old/idea: last touched three weeks ago.
 * - done: merged into main, so nothing of its own.
 */
function teamRepo() {
  const remotes = makeDir("remotes");
  const bare = join(remotes, "team.git");
  git(remotes, "init", "-q", "--bare", bare);
  const teammate = makeDir("teammate");
  git(teammate, "init", "-q");
  git(teammate, "remote", "add", "origin", bare);
  write(teammate, "README.md", "team\n");
  git(teammate, "add", "-A");
  commitAs(teammate, ann, "Start", days(30));
  git(teammate, "switch", "-q", "-c", "old/idea");
  commitAs(teammate, bob, "Idea", days(21));
  git(teammate, "switch", "-q", "main");
  commitAs(teammate, bob, "Main work", days(2));
  git(teammate, "switch", "-q", "-c", "done");
  commitAs(teammate, cleo, "Finished feature", days(3));
  git(teammate, "switch", "-q", "main");
  git(teammate, "merge", "-q", "--no-ff", "-m", "Merge done", "done");
  commitAs(teammate, { ...ann, name: "Annie" }, "More main work", hours(26));
  git(teammate, "switch", "-q", "-c", "feature/hair");
  commitAs(teammate, cleo, "Hair shader", hours(5));
  commitAs(
    teammate,
    { name: "Ann S.", email: ann.email },
    "Hair mesh",
    hours(4),
  );
  commitAs(teammate, cleo, "Hair textures", hours(3));
  git(teammate, "switch", "-q", "main");
  commitAs(teammate, bob, "Main fix", hours(2));
  git(teammate, "switch", "-q", "feature/hair");
  git(teammate, "merge", "-q", "--no-ff", "-m", "Merge main", "main");
  commitAs(
    teammate,
    { name: "Ann Smith", email: "ANN@studio.dev" },
    "Hair rig",
    hours(1),
  );
  git(teammate, "switch", "-q", "-c", "art/forest", "main");
  commitAs(teammate, dana, "Forest textures", hours(6));
  git(teammate, "push", "-q", "origin", "--all");

  const dir = join(makeDir("mine"), "team");
  git(remotes, "clone", "-q", bare, dir);
  git(dir, "switch", "-q", "feature/hair");
  git(dir, "branch", "-q", "old/idea", "origin/old/idea");
  write(dir, "Hair.txt", "mine\n");
  git(dir, "add", "-A");
  commitAs(dir, me, "My hair tweak", hours(0.5));
  return { dir, bare, teammate };
}

const summary = (activity: BranchActivity) =>
  activity.branches.map((b) => ({
    name: b.name,
    refs: b.refs,
    commits: b.commits,
    authors: b.authors.map((a) => `${a.name} ${a.commits}`),
  }));

describe("branchActivity on a real repository", () => {
  it("says who saved versions on which branch, and keeps it while nothing moves", async () => {
    const { dir, bare } = teamRepo();
    const { runner, runs } = counted(nodeRunner(dir));
    const backend = new CliBackend(runner);

    const activity = await backend.branchActivity(14);
    expect(activity.base).toBe("main");
    expect(activity.remoteUrl).toBe(bare);
    expect(summary(activity)).toEqual([
      {
        name: "feature/hair",
        refs: ["feature/hair", "origin/feature/hair"],
        // Not main's commits, nor the merge that brought them.
        commits: 5,
        authors: ["Test User 1", "Ann Smith 2", "Cleo Park 2"],
      },
      {
        name: "main",
        refs: ["main", "origin/main"],
        // The merged branch counts here; the start is too old.
        commits: 4,
        authors: ["Bob Ray 2", "Annie 1", "Cleo Park 1"],
      },
      {
        name: "origin/art/forest",
        refs: ["origin/art/forest"],
        commits: 1,
        authors: ["Dana Brooks 1"],
      },
    ]);

    // Ann's emails differ only in case: one person, with the latest name.
    const hair = activityFor(activity, "origin/feature/hair")!;
    expect(hair.authors[1]).toMatchObject({
      email: "ANN@studio.dev",
      last: Math.floor(hours(1) / 1000) * 1000,
    });
    // My commit isn't on the server yet, so GitHub couldn't say whose it is.
    expect(hair.authors[0].pushedSha).toBeUndefined();
    expect(hair.authors[2].pushedSha).toBe(
      git(dir, "rev-parse", "origin/feature/hair~2").trim(),
    );
    expect(hair.isBase).toBe(false);
    expect(activityFor(activity, "main")!.isBase).toBe(true);

    // Three runs at first; while no branch moves, one cheap check.
    expect(runs.length).toBeLessThanOrEqual(3);
    runs.length = 0;
    expect(await backend.branchActivity(14)).toBe(activity);
    expect(runs).toHaveLength(1);

    // A commit moves a tip: counted again.
    write(dir, "Hair.txt", "mine, again\n");
    await backend.commit({ summary: "Another", description: "" }, "all");
    const next = await backend.branchActivity(14);
    expect(next).not.toBe(activity);
    expect(activityFor(next, "feature/hair")!.authors[0]).toMatchObject({
      name: "Test User",
      commits: 2,
    });

    // A shorter window drops older work: just over an hour leaves Bob's fix out.
    const recent = await backend.branchActivity(0.05);
    expect(recent.branches.map((b) => b.name)).toEqual(["feature/hair"]);
  });

  it("works without a server, and in a repository with no commits", async () => {
    const dir = makeDir("solo");
    git(dir, "init", "-q");
    const backend = new CliBackend(nodeRunner(dir));
    expect(await backend.branchActivity()).toMatchObject({
      base: null,
      branches: [],
      remoteUrl: null,
    });

    write(dir, "a.txt", "a\n");
    git(dir, "add", "-A");
    commitAs(dir, ann, "First", hours(3));
    git(dir, "switch", "-q", "-c", "sketch");
    commitAs(dir, bob, "Sketch", hours(2));
    const activity = await backend.branchActivity();
    expect(activity.base).toBe("main");
    expect(activity.remoteUrl).toBeNull();
    expect(summary(activity)).toEqual([
      { name: "sketch", refs: ["sketch"], commits: 1, authors: ["Bob Ray 1"] },
      { name: "main", refs: ["main"], commits: 1, authors: ["Ann Smith 1"] },
    ]);
    expect(activity.branches[0].authors[0].pushedSha).toBeUndefined();
  });
});

describe("branch activity parsing", () => {
  it("reads branch tips and each remote's default branch", () => {
    const { refs, heads } = parseActivityRefs(
      [
        fields("refs/heads/main", "", "a1"),
        fields("refs/heads/feature/x", "", "b2"),
        fields("refs/remotes/origin/HEAD", "refs/remotes/origin/develop", "c3"),
        fields("refs/remotes/origin/feature/x", "", "d4"),
        fields("refs/remotes/upstream/main", "", "e5"),
        "",
      ].join("\n"),
    );
    expect(refs).toEqual([
      { ref: "main", remote: null, branch: "main", tip: "a1" },
      { ref: "feature/x", remote: null, branch: "feature/x", tip: "b2" },
      {
        ref: "origin/feature/x",
        remote: "origin",
        branch: "feature/x",
        tip: "d4",
      },
      { ref: "upstream/main", remote: "upstream", branch: "main", tip: "e5" },
    ]);
    expect(heads).toEqual(new Map([["origin", "develop"]]));
    const urls = parseRemoteUrls(
      "remote.upstream.url https://github.com/a/b.git\nremote.origin.url git@github.com:me/b.git\n",
    );
    expect(urls.get("origin")).toBe("git@github.com:me/b.git");
    expect(mainRemote(refs, urls)).toBe("origin");
    expect(defaultBranch(refs, heads, "origin")).toBe("develop");
    expect(defaultBranch(refs, heads, "upstream")).toBe("main");
    expect(mainRemote(refs.slice(0, 2), new Map())).toBeNull();
    expect(defaultBranch(refs.slice(1, 2), new Map(), null)).toBeNull();
  });

  it("walks parents only through recent commits", () => {
    // main: m1 <- m2; feature: m1 <- f1 <- f2, where f2 merges m2 in.
    const log = parseActivityLog(
      [
        fields("f2", "f1 m2", "Ann", "ann@x", "400"),
        fields("m2", "m1", "Bob", "bob@x", "300"),
        fields("f1", "m1", "Ann", "ann@x", "200"),
        fields("m1", "old", "Bob", "bob@x", "100"),
      ].join("\n"),
    );
    const branches = branchCommits(
      [
        { ref: "main", remote: null, branch: "main", tip: "m2" },
        { ref: "feature", remote: null, branch: "feature", tip: "f2" },
        { ref: "origin/main", remote: "origin", branch: "main", tip: "m1" },
        { ref: "stale", remote: null, branch: "stale", tip: "old" },
      ],
      log,
      "main",
    );
    expect(
      branches.map((b) => ({
        name: b.name,
        refs: b.refs,
        shas: b.commits.map((c) => `${c.sha}${c.pushed ? "+" : ""}`).sort(),
      })),
    ).toEqual([
      { name: "main", refs: ["main", "origin/main"], shas: ["m1+", "m2"] },
      { name: "feature", refs: ["feature"], shas: ["f1"] },
    ]);
  });
});
