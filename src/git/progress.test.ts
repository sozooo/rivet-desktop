import { describe, expect, it } from "vitest";
import {
  ProgressTracker,
  parseGitLine,
  parseLfsLine,
  withoutProgress,
  type GitProgress,
  type ProgressCommand,
} from "./progress";

const MiB = 1024 * 1024;

// Lines git 2.52 and git-lfs 3.7 wrote cloning, pulling and pushing a scratch
// project through a local bare remote and an LFS server.
const CLONE = [
  "Cloning into 'clone1'...",
  "remote: Enumerating objects: 309, done.",
  "remote: Counting objects:   0% (1/309)",
  "remote: Counting objects: 100% (309/309), done.",
  "remote: Compressing objects:  14% (1/7)",
  "remote: Compressing objects: 100% (7/7), done.",
  "Receiving objects:   0% (1/309)",
  "Receiving objects:  42% (130/309), 1.20 MiB | 1.10 MiB/s",
  "remote: Total 309 (delta 0), reused 309 (delta 0), pack-reused 0 (from 0)",
  "Receiving objects: 100% (309/309), 16.57 KiB | 4.14 MiB/s, done.",
  "Resolving deltas:  50% (1/2)",
  "Resolving deltas: 100% (2/2), done.",
  "Updating files:  42% (130/309)",
  "Updating files: 100% (309/309), done.",
];

const PUSH_LFS = [
  "upload 1/5 32768/20971520 Art5.bin",
  "upload 2/5 32768/16777216 Art4.bin",
  "upload 1/5 98304/20971520 Art5.bin",
  "upload 5/5 32768/4194304 Art1.bin",
  "upload 4/5 32768/8388608 Art2.bin",
  "upload 3/5 32768/12582912 Art3.bin",
  "upload 5/5 4194304/4194304 Art1.bin",
  "upload 1/5 20971520/20971520 Art5.bin",
];

const PUSH = [
  "Enumerating objects: 309, done.",
  "Counting objects:  50% (155/309)",
  "Counting objects: 100% (309/309), done.",
  "Delta compression using up to 20 threads",
  "Compressing objects: 100% (7/7), done.",
  "Writing objects:  42% (130/309), 7.00 KiB | 1.00 MiB/s",
  "Writing objects: 100% (309/309), 16.57 KiB | 707.00 KiB/s, done.",
  "Total 309 (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)",
  "remote: Resolving deltas: 100% (2/2), completed with 2 local objects.",
  "To file:///C:/Users/me/AppData/Local/Temp/remote.git",
  " * [new branch]      main -> main",
];

/** Every report a tracker makes for these lines. */
function reports(
  command: ProgressCommand,
  lines: [source: "git" | "lfs", line: string][],
  tracker = new ProgressTracker(command),
) {
  return lines
    .map(([source, line]) => tracker.line(source, line))
    .filter((p): p is GitProgress => !!p);
}
const fromGit = (lines: string[]) =>
  lines.map((l) => ["git", l] as ["git", string]);
const fromLfs = (lines: string[]) =>
  lines.map((l) => ["lfs", l] as ["lfs", string]);

describe("parseGitLine", () => {
  it("reads percent, counts and bytes", () => {
    expect(
      parseGitLine("Receiving objects:  42% (130/309), 1.20 MiB | 1.10 MiB/s"),
    ).toEqual({
      title: "Receiving objects",
      remote: false,
      percent: 42,
      count: 130,
      total: 309,
      bytes: Math.round(1.2 * MiB),
    });
    expect(parseGitLine("remote: Counting objects:   0% (1/309)")).toEqual({
      title: "Counting objects",
      remote: true,
      percent: 0,
      count: 1,
      total: 309,
      bytes: null,
    });
    expect(
      parseGitLine(
        "Unpacking objects: 100% (3/3), 254 bytes | 25.00 KiB/s, done.",
      ),
    ).toMatchObject({ title: "Unpacking objects", bytes: 254 });
    expect(
      parseGitLine("Filtering content:  40% (2/5), 40.00 MiB | 54.29 MiB/s"),
    ).toMatchObject({ percent: 40, count: 2, total: 5, bytes: 40 * MiB });
    // git-lfs counts in decimal megabytes.
    expect(
      parseGitLine("Uploading LFS objects: 100% (5/5), 63 MB | 12 MB/s, done."),
    ).toMatchObject({ title: "Uploading LFS objects", bytes: 63e6 });
  });

  it("reads lines that only count", () => {
    expect(parseGitLine("remote: Enumerating objects: 309, done.")).toEqual({
      title: "Enumerating objects",
      remote: true,
      percent: null,
      count: 309,
      total: null,
      bytes: null,
    });
  });

  it("leaves other output alone", () => {
    for (const line of [
      "Cloning into 'clone1'...",
      "remote: Total 309 (delta 0), reused 309 (delta 0), pack-reused 0 (from 0)",
      "Delta compression using up to 20 threads",
      "fatal: unable to access 'https://github.com/a/b.git/': Could not resolve host: github.com",
      "remote: error: GH001: Large files detected.",
      " * [new branch]      main -> main",
    ])
      expect(parseGitLine(line)).toBeNull();
  });
});

describe("parseLfsLine", () => {
  it("reads direction, file number, bytes and a path with spaces", () => {
    expect(
      parseLfsLine("upload 2/3 32768/1048576 Assets/Art/Big Cliff.psd"),
    ).toEqual({
      direction: "upload",
      index: 2,
      estimated: 3,
      read: 32768,
      total: 1048576,
      name: "Assets/Art/Big Cliff.psd",
    });
    expect(parseLfsLine("clean 1/1 4194304/4194304 Art1.bin")).toMatchObject({
      direction: "clean",
    });
    expect(parseLfsLine("Downloading LFS objects: 100%")).toBeNull();
  });
});

describe("ProgressTracker", () => {
  it("spreads a clone's phases over one rising percent", () => {
    const seen = reports("clone", fromGit(CLONE));
    expect(seen.map((p) => p.phase)).toEqual([
      "prepare",
      "prepare",
      "prepare",
      "receive",
      "receive",
      "receive",
      "resolve",
      "resolve",
      "checkout",
      "checkout",
    ]);
    // Only counting so far: no number to show yet.
    expect(seen[0].percent).toBeNull();
    // Receiving is 5–80 of a clone.
    expect(seen.find((p) => p.phase === "receive" && p.percent! > 5)).toEqual({
      phase: "receive",
      percent: 36,
    });
    const percents = seen.map((p) => p.percent ?? 0);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
    expect(seen.at(-1)).toEqual({ phase: "checkout", percent: 100 });
  });

  it("reports only what the UI would show differently", () => {
    const tracker = new ProgressTracker("fetch");
    expect(
      tracker.line("git", "Receiving objects:  42% (130/309)"),
    ).not.toBeNull();
    expect(
      tracker.line(
        "git",
        "Receiving objects:  42% (131/309), 1.20 MiB | 1 MiB/s",
      ),
    ).toBeNull();
    expect(tracker.line("git", "Cloning into 'art'...")).toBeNull();
    // A phase this command doesn't weigh.
    expect(tracker.line("git", "Writing objects:  50% (1/2)")).toBeNull();
  });

  it("counts LFS uploads by file and byte, then follows git again", () => {
    const tracker = new ProgressTracker("push");
    const upload = reports("push", fromLfs(PUSH_LFS.slice(0, 2)), tracker);
    // Three files haven't started, so the total is unknown; the second line
    // moved less than a tenth of a megabyte, which shows no differently.
    expect(upload).toEqual([
      {
        phase: "upload",
        percent: 0,
        files: { done: 0, total: 5 },
        bytes: { done: 32768, total: null },
      },
    ]);
    const all = reports("push", fromLfs(PUSH_LFS.slice(2)), tracker);
    expect(all.at(-1)).toEqual({
      phase: "upload",
      percent: 40,
      files: { done: 2, total: 5 },
      bytes: {
        done: 4194304 + 20971520 + 3 * 32768,
        total: 62914560,
      },
    });
    const sending = reports("push", fromGit(PUSH), tracker);
    expect(sending[0]).toEqual({ phase: "prepare", percent: null });
    expect(sending.at(-1)).toEqual({ phase: "send", percent: 100 });
    // The progress file is read now and then; its last lines can come late.
    expect(
      tracker.line("lfs", "upload 2/5 16777216/16777216 Art4.bin"),
    ).toBeNull();
  });

  it("counts bytes from the start when the sizes are known ahead", () => {
    const tracker = new ProgressTracker("lfs", {
      files: 2,
      bytes: 3 * MiB,
    });
    expect(tracker.line("lfs", "download 1/2 3927/2097152 Tree.png")).toEqual({
      phase: "download",
      percent: 0,
      files: { done: 0, total: 2 },
      bytes: { done: 3927, total: 3 * MiB },
    });
    expect(
      tracker.line("lfs", "download 2/2 1048576/1048576 Rock.png"),
    ).toMatchObject({ percent: 33, files: { done: 1, total: 2 } });
    // Local steps after the download don't count.
    expect(
      tracker.line("lfs", "clean 1/1 1048576/1048576 Rock.png"),
    ).toBeNull();
  });

  it("follows Git LFS inside a pull through git's filtering lines", () => {
    // During a pull git-lfs reports each file only when it is done.
    const seen = reports("pull", [
      ["git", "Updating files: 100% (26/26), done."],
      ["git", "Filtering content:  40% (2/5), 24.00 MiB | 12.00 MiB/s"],
      ["lfs", "download 1/1 8388608/8388608 Art2.bin"],
      ["git", "Filtering content: 100% (5/5), 60.00 MiB | 12.00 MiB/s, done."],
    ]);
    expect(seen[1]).toEqual({
      phase: "download",
      percent: 40,
      files: { done: 2, total: 5 },
      bytes: { done: 24 * MiB, total: null },
    });
    expect(seen.at(-1)).toMatchObject({
      percent: 100,
      files: { done: 5, total: 5 },
    });
  });
});

describe("withoutProgress", () => {
  it("keeps what git said besides the progress", () => {
    const stderr = [
      "Cloning into 'art'...",
      "remote: Enumerating objects: 309, done.",
      "remote: Counting objects: 100% (309/309), done.",
      "remote: Total 309 (delta 0), reused 309 (delta 0), pack-reused 0",
      "Receiving objects: 100% (309/309), 16.57 KiB | 4.14 MiB/s, done.",
      "error: RPC failed; curl 56 Recv failure: Connection was reset",
      "fatal: early EOF",
      "",
    ].join("\n");
    expect(withoutProgress(stderr)).toBe(
      "Cloning into 'art'...\nerror: RPC failed; curl 56 Recv failure: Connection was reset\nfatal: early EOF",
    );
    expect(withoutProgress("remote: error: GH001: Large files detected.")).toBe(
      "remote: error: GH001: Large files detected.",
    );
  });
});
