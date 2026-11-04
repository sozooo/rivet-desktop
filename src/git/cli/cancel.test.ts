// Cancelling transfers half-way, against real repositories behind slow servers:
// git over HTTP (gitHttpTestServer) and Git LFS (lfsTestServer). Everything
// that talks to them runs asynchronously; a blocking git run would wait on the
// server in this same process forever.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CancelHandle, CancelledError } from "../cancel";
import type { GitProgress } from "../progress";
import { CliBackend } from "./CliBackend";
import { startGitHttpServer, type GitHttpServer } from "./gitHttpTestServer";
import { startLfsServer, type LfsServer } from "./lfsTestServer";
import {
  cleanup,
  git,
  makeDir,
  makeRepo,
  nodeFolders,
  nodeRunner,
  write,
} from "./testRepo";
import { clone, IncompleteClone, resumeClone } from "./transfers";

const MiB = 1024 * 1024;
let lfs: LfsServer;
let http: GitHttpServer;
let remotes: string;

beforeAll(async () => {
  lfs = await startLfsServer(0, 4 * MiB);
  remotes = makeDir("remotes");
  http = await startGitHttpServer(remotes, 0, 2 * MiB);
  // Git LFS set up for this user, as the Git for Windows installer does.
  git(makeRepo("setup"), "lfs", "install", "--skip-repo");
});
afterAll(async () => {
  await Promise.all([lfs.close(), http.close()]);
  cleanup();
});

/** git with its output streamed, so it can talk to the servers here. */
async function streamed(cwd: string, ...args: string[]) {
  const result = await nodeRunner(cwd).text(args, undefined, {
    onLine: () => {},
  });
  if (result.code !== 0)
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

const head = (repository: string, ref = "HEAD") =>
  git(repository, "rev-parse", ref).trim();

/**
 * A remote served over HTTP with one commit, a teammate's copy that pushes
 * to it directly, and its HTTP address. Art goes to the LFS server.
 */
async function remote(name: string) {
  const bare = join(remotes, `${name}.git`);
  git(remotes, "init", "-q", "--bare", bare);
  const teammate = makeRepo(`${name}-teammate`);
  git(teammate, "lfs", "install", "--local");
  write(teammate, ".lfsconfig", `[lfs]\n\turl = ${lfs.url}\n`);
  git(teammate, "lfs", "track", "*.psd");
  write(teammate, "README.md", "Art for the forest level\n");
  git(teammate, "add", "-A");
  git(teammate, "commit", "-q", "-m", "Start");
  git(teammate, "remote", "add", "origin", pathToFileURL(bare).href);
  await streamed(teammate, "push", "-q", "origin", "main");
  return { bare, teammate, url: `${http.url}${name}.git` };
}

/** The teammate saves a file and sends it. */
async function teammateSends(teammate: string, path: string, bytes: Buffer) {
  write(teammate, path, bytes);
  git(teammate, "add", "-A");
  git(teammate, "commit", "-q", "-m", `Add ${path}`);
  await streamed(teammate, "push", "-q", "origin", "main");
}

/** My copy of the remote, talking to it over HTTP. */
async function myCopy(bare: string, url: string) {
  const mine = join(makeDir("mine"), "art");
  await streamed(".", "clone", "-q", pathToFileURL(bare).href, mine);
  git(mine, "remote", "set-url", "origin", url);
  // Send a push in one request with a length, which http-backend wants.
  git(mine, "config", "http.postBuffer", String(64 * MiB));
  return mine;
}

/** A listener that cancels at the first report of `phase`. */
const cancelAt =
  (cancel: CancelHandle, phase: GitProgress["phase"]) => (p: GitProgress) => {
    if (p.phase === phase) cancel.cancel();
  };

/** Nothing half-done: no merge under way, no changed files. */
function untouched(repository: string) {
  expect(git(repository, "status", "--porcelain")).toBe("");
  expect(existsSync(join(repository, ".git", "MERGE_HEAD"))).toBe(false);
}

describe("cancelling a pull", () => {
  it("stops while git downloads, leaving the repository as it was", async () => {
    const { bare, teammate, url } = await remote("pull-git");
    const mine = await myCopy(bare, url);
    // Over a hundred files, as in a real project: git then reports receiving
    // them (it unpacks fewer silently).
    for (let i = 0; i < 120; i++)
      write(teammate, `Assets/Textures/Leaf${i}.png`, randomBytes(24 * 1024));
    git(teammate, "add", "-A");
    git(teammate, "commit", "-q", "-m", "Leaves");
    await streamed(teammate, "push", "-q", "origin", "main");
    const backend = new CliBackend(nodeRunner(mine));
    const [before, tracking] = [head(mine), head(mine, "origin/main")];

    const cancel = new CancelHandle();
    await expect(
      backend.pull({ cancel, onProgress: cancelAt(cancel, "receive") }),
    ).rejects.toBeInstanceOf(CancelledError);
    expect(head(mine)).toBe(before);
    expect(head(mine, "origin/main")).toBe(tracking);
    untouched(mine);

    // Nothing is lost: the next pull brings it all.
    await backend.pull({ onProgress: () => {} });
    expect(head(mine)).toBe(head(teammate));
  }, 60_000);

  it("stops while LFS files download, leaving the files as they were", async () => {
    const { bare, teammate, url } = await remote("pull-lfs");
    const mine = await myCopy(bare, url);
    const art = randomBytes(4 * MiB);
    await teammateSends(teammate, "Art/Cliff.psd", art);
    const backend = new CliBackend(nodeRunner(mine));
    const before = head(mine);

    const cancel = new CancelHandle();
    await expect(
      backend.pull({ cancel, onProgress: cancelAt(cancel, "download") }),
    ).rejects.toBeInstanceOf(CancelledError);
    expect(head(mine)).toBe(before);
    expect(existsSync(join(mine, "Art/Cliff.psd"))).toBe(false);
    untouched(mine);
    // The commits themselves had arrived.
    expect(head(mine, "origin/main")).toBe(head(teammate));

    await backend.pull({ onProgress: () => {} });
    expect(head(mine)).toBe(head(teammate));
    expect(readFileSync(join(mine, "Art/Cliff.psd"))).toEqual(art);
  }, 60_000);

  it("isn't offered while the pull merges, and a late click changes nothing", async () => {
    const { bare, teammate, url } = await remote("pull-merge");
    const mine = await myCopy(bare, url);
    await teammateSends(teammate, "Art/Tree.psd", randomBytes(MiB));
    const backend = new CliBackend(nodeRunner(mine));

    const cancel = new CancelHandle();
    const offered: boolean[] = [];
    cancel.subscribe(() => {
      offered.push(cancel.available);
      // The download is over and the merge comes next: too late to stop.
      if (!cancel.available) cancel.cancel();
    });
    await backend.pull({ cancel, onProgress: () => {} });
    expect(offered).toEqual([true, false]);
    expect(cancel.cancelled).toBe(false);
    expect(head(mine)).toBe(head(teammate));
    untouched(mine);
  }, 60_000);
});

describe("cancelling a push", () => {
  it("stops while LFS files upload, leaving the server's branch as it was", async () => {
    const { bare, url } = await remote("push-lfs");
    const mine = await myCopy(bare, url);
    write(mine, "Art/Hero.psd", randomBytes(4 * MiB));
    git(mine, "add", "-A");
    git(mine, "commit", "-q", "-m", "Hero");
    const backend = new CliBackend(nodeRunner(mine));
    const serverBefore = head(bare, "main");

    const cancel = new CancelHandle();
    await expect(
      backend.push({ cancel, onProgress: cancelAt(cancel, "upload") }),
    ).rejects.toBeInstanceOf(CancelledError);
    expect(head(bare, "main")).toBe(serverBefore);
    expect((await backend.snapshot()).sync.ahead).toBe(1);

    await backend.push({ onProgress: () => {} });
    expect(head(bare, "main")).toBe(head(mine));
  }, 60_000);

  it("stops while git sends, leaving the server's branch as it was", async () => {
    const { bare, url } = await remote("push-git");
    const mine = await myCopy(bare, url);
    write(mine, "Audio/Theme.wav", randomBytes(3 * MiB));
    git(mine, "add", "-A");
    git(mine, "commit", "-q", "-m", "Theme");
    const backend = new CliBackend(nodeRunner(mine));
    const serverBefore = head(bare, "main");

    const cancel = new CancelHandle();
    // Once git has packed the commit, sending it is what takes the time.
    const stopSoon = (p: GitProgress) =>
      p.phase === "send" &&
      p.percent === 100 &&
      setTimeout(() => cancel.cancel(), 300);
    await expect(
      backend.push({ cancel, onProgress: stopSoon }),
    ).rejects.toBeInstanceOf(CancelledError);
    expect(head(bare, "main")).toBe(serverBefore);

    await backend.push({ onProgress: () => {} });
    expect(head(bare, "main")).toBe(head(mine));
  }, 60_000);
});

describe("cancelling or failing a clone", () => {
  it("removes the folders it made when git hadn't finished", async () => {
    const { teammate, url } = await remote("clone-git");
    await teammateSends(teammate, "Audio/Rain.wav", randomBytes(3 * MiB));
    const projects = join(makeDir("clone-git"), "Projects");
    const destination = join(projects, "Art");

    const cancel = new CancelHandle();
    await expect(
      clone(nodeRunner, nodeFolders(), url, destination, {
        cancel,
        onProgress: cancelAt(cancel, "receive"),
      }),
    ).rejects.toBeInstanceOf(CancelledError);
    // "Projects" didn't exist before either.
    expect(existsSync(projects)).toBe(false);

    // Trying again starts clean.
    await clone(nodeRunner, nodeFolders(), url, destination, {
      onProgress: () => {},
    });
    expect(head(destination)).toBe(head(teammate));
  }, 60_000);

  it("keeps a project whose art download stopped, and finishes it later", async () => {
    const { teammate, url } = await remote("clone-lfs");
    const art = randomBytes(4 * MiB);
    await teammateSends(teammate, "Art/Cliff.psd", art);
    const destination = join(makeDir("clone-lfs"), "Art");
    const cliff = join(destination, "Art/Cliff.psd");

    const cancel = new CancelHandle();
    const stopped = await clone(nodeRunner, nodeFolders(), url, destination, {
      cancel,
      onProgress: cancelAt(cancel, "download"),
    }).catch((error) => error);
    expect(stopped).toBeInstanceOf(IncompleteClone);
    expect(stopped.reason).toBeInstanceOf(CancelledError);
    // The project is there and opens; the art is still a pointer.
    expect(head(destination)).toBe(head(teammate));
    expect(readFileSync(cliff, "utf8")).toMatch(/^version https:\/\/git-lfs/);

    // Cloning again finds it instead of failing on the folder.
    const again = await clone(nodeRunner, nodeFolders(), url, destination, {
      onProgress: () => {},
    }).catch((error) => error);
    expect(again).toBeInstanceOf(IncompleteClone);
    expect(again.reason).toBeNull();

    await resumeClone(nodeRunner(destination), { onProgress: () => {} });
    expect(readFileSync(cliff)).toEqual(art);
    expect(git(destination, "status", "--porcelain")).toBe("");
    // Complete now: cloning again just finds it.
    await clone(nodeRunner, nodeFolders(), url, destination, {
      onProgress: () => {},
    });
  }, 60_000);

  it("removes a folder it made after a failure, but never one that was there", async () => {
    const parent = makeDir("clone-fail");
    const missing = `${http.url}missing.git`;
    const made = join(parent, "Made");
    await expect(
      clone(nodeRunner, nodeFolders(), missing, made, { onProgress: () => {} }),
    ).rejects.toThrow();
    expect(existsSync(made)).toBe(false);

    const existing = join(parent, "Existing");
    mkdirSync(existing);
    await expect(
      clone(nodeRunner, nodeFolders(), missing, existing, {
        onProgress: () => {},
      }),
    ).rejects.toThrow();
    expect(existsSync(existing)).toBe(true);
  }, 60_000);
});
