import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GitProgress } from "../progress";
import { CliBackend } from "./CliBackend";
import { startLfsServer, type LfsServer } from "./lfsTestServer";
import { cleanup, git, makeRepo, nodeRunner, write } from "./testRepo";
import { clone } from "./transfers";

const MiB = 1024 * 1024;
let server: LfsServer;

beforeAll(async () => {
  // Slow enough that git-lfs's progress file is read several times per transfer.
  server = await startLfsServer(0, 8 * MiB);
  // Git LFS set up for this user, as the Git for Windows installer does; the
  // tests' own global settings, so nothing outside changes.
  git(makeRepo("setup"), "lfs", "install", "--skip-repo");
});
afterAll(async () => {
  await server.close();
  cleanup();
});

/** Percents never go back within a phase. */
function rising(reports: GitProgress[]) {
  return reports.every(
    (p, i) =>
      i === 0 ||
      reports[i - 1].phase !== p.phase ||
      (p.percent ?? 0) >= (reports[i - 1].percent ?? 0),
  );
}

describe("transfers with progress", () => {
  it("pushes and clones a project with Git LFS art through a bare remote", async () => {
    const scratch = makeRepo("scratch");
    const remote = join(scratch, "remote.git");
    git(scratch, "init", "-q", "--bare", remote);

    const project = makeRepo("project");
    git(project, "lfs", "install", "--local");
    write(project, ".lfsconfig", `[lfs]\n\turl = ${server.url}\n`);
    git(project, "lfs", "track", "*.psd");
    const hero = randomBytes(3 * MiB);
    write(project, "Assets/Art/Hero.psd", hero);
    write(project, "Assets/Art/Big Cliff.psd", randomBytes(2 * MiB));
    for (let i = 0; i < 40; i++)
      write(project, `Assets/Scripts/Script${i}.cs`, `class Script${i} {}\n`);
    git(project, "add", "-A");
    git(project, "commit", "-q", "-m", "Project");
    git(project, "remote", "add", "origin", pathToFileURL(remote).href);

    const pushed: GitProgress[] = [];
    await new CliBackend(nodeRunner(project)).push({
      onProgress: (p) => pushed.push(p),
    });
    const uploads = pushed.filter((p) => p.phase === "upload");
    expect(uploads.length).toBeGreaterThan(1);
    expect(uploads.at(-1)).toMatchObject({
      files: { total: 2 },
      bytes: { total: 5 * MiB },
    });
    // git sends the commits after the art.
    expect(pushed.at(-1)).toEqual({ phase: "send", percent: 100 });
    expect(rising(pushed)).toBe(true);

    const destination = join(scratch, "copy");
    const cloned: GitProgress[] = [];
    await clone(nodeRunner, pathToFileURL(remote).href, destination, (p) =>
      cloned.push(p),
    );
    expect(cloned.some((p) => p.phase === "receive")).toBe(true);
    const downloads = cloned.filter((p) => p.phase === "download");
    // Sizes are known before the first byte arrives.
    expect(downloads[0].bytes?.total).toBe(5 * MiB);
    expect(downloads.length).toBeGreaterThan(2);
    expect(downloads.at(-1)).toEqual({
      phase: "download",
      percent: 100,
      files: { done: 2, total: 2 },
      bytes: { done: 5 * MiB, total: 5 * MiB },
    });
    expect(rising(cloned)).toBe(true);
    expect(readFileSync(join(destination, "Assets/Art/Hero.psd"))).toEqual(
      hero,
    );
    expect(git(destination, "status", "--porcelain")).toBe("");

    // New art arrives: the pull downloads it byte by byte before merging.
    const waterfall = randomBytes(2 * MiB);
    write(project, "Assets/Art/Waterfall.psd", waterfall);
    git(project, "add", "-A");
    git(project, "commit", "-q", "-m", "Waterfall");
    // Only runs with progress are asynchronous here; a blocking run that
    // needs the LFS server, which lives in this process, would never end.
    await new CliBackend(nodeRunner(project)).push({ onProgress: () => {} });
    const copy = new CliBackend(nodeRunner(destination));
    await copy.fetch();
    const pulled: GitProgress[] = [];
    await copy.pull({ onProgress: (p) => pulled.push(p) });
    const arriving = pulled.filter((p) => p.phase === "download");
    expect(arriving[0].bytes?.total).toBe(2 * MiB);
    expect(arriving.at(-1)).toMatchObject({
      percent: 100,
      files: { done: 1, total: 1 },
    });
    expect(readFileSync(join(destination, "Assets/Art/Waterfall.psd"))).toEqual(
      waterfall,
    );
    expect(git(destination, "status", "--porcelain")).toBe("");
  }, 60_000);

  it("fetches and pulls with progress, and reports none in the background", async () => {
    const scratch = makeRepo("scratch");
    const remote = join(scratch, "remote.git");
    git(scratch, "init", "-q", "--bare", remote);
    const url = pathToFileURL(remote).href;
    const teammate = makeRepo("teammate");
    write(teammate, "README.md", "hello\n");
    git(teammate, "add", "-A");
    git(teammate, "commit", "-q", "-m", "Start");
    git(teammate, "push", "-q", url, "HEAD:main");
    const mine = join(scratch, "mine");
    git(scratch, "clone", "-q", url, mine);

    // Over fetch.unpackLimit (100 objects): git indexes a pack and shows "Receiving objects".
    for (let i = 0; i < 150; i++)
      write(
        teammate,
        `Assets/Level${i}.txt`,
        randomBytes(20_000).toString("hex"),
      );
    git(teammate, "add", "-A");
    git(teammate, "commit", "-q", "-m", "Levels");
    git(teammate, "push", "-q", url, "HEAD:main");

    const backend = new CliBackend(nodeRunner(mine));
    const fetched: GitProgress[] = [];
    await backend.fetch({ onProgress: (p) => fetched.push(p) });
    expect(fetched.some((p) => p.phase === "receive")).toBe(true);
    expect(rising(fetched)).toBe(true);

    const pulled: GitProgress[] = [];
    await backend.pull({ onProgress: (p) => pulled.push(p) });
    expect((await backend.snapshot()).sync.behind).toBe(0);
    expect(rising(pulled)).toBe(true);

    write(teammate, "Assets/Level0.txt", randomBytes(20_000).toString("hex"));
    git(teammate, "commit", "-q", "-am", "Level 0 again");
    git(teammate, "push", "-q", url, "HEAD:main");
    const quiet: GitProgress[] = [];
    await backend.fetch({ background: true, onProgress: (p) => quiet.push(p) });
    expect(quiet).toEqual([]);
    expect((await backend.snapshot()).sync.behind).toBe(1);
  }, 60_000);
});
