import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CliBackend } from "./CliBackend";
import { cleanup, git, makeRepo, nodeRunner, write } from "./testRepo";

afterAll(cleanup);

const read = (dir: string, path: string) =>
  readFileSync(join(dir, path), "utf8");

function repoWithHistory() {
  const dir = makeRepo();
  write(dir, "Assets/Bark.png", "bark v1\n");
  write(dir, "Assets/Bark.png.meta", "guid: 1\nmaxSize: 2048\n");
  write(dir, "Notes.txt", "notes\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "First");
  write(dir, "Assets/Bark.png", "bark v2\n");
  write(dir, "Assets/Bark.png.meta", "guid: 1\nmaxSize: 1024\n");
  git(dir, "commit", "-q", "-am", "Smaller bark");
  return { dir, backend: new CliBackend(nodeRunner(dir)) };
}

/** A shared remote, my clone that tracks it, and a teammate's clone. */
function team() {
  const remote = makeRepo("remote");
  git(remote, "config", "receive.denyCurrentBranch", "ignore");
  const { dir, backend } = repoWithHistory();
  git(dir, "remote", "add", "origin", remote);
  git(dir, "push", "-q", "-u", "origin", "main");
  const teammate = makeRepo("teammate");
  git(teammate, "pull", "-q", remote, "main");
  const push = (path: string, content: string) => {
    write(teammate, path, content);
    git(teammate, "add", "-A");
    git(teammate, "commit", "-q", "-m", `Teammate: ${path}`);
    git(teammate, "push", "-q", remote, "HEAD:main");
  };
  return { dir, backend, push };
}

describe("undo the last commit", () => {
  it("takes back an unpushed commit and keeps its changes selected", async () => {
    const { dir, backend } = repoWithHistory();
    write(dir, "Notes.txt", "notes, then more\n");
    write(dir, "Assets/Tree.png", "tree\n");
    await backend.commit(
      { summary: "Tree and notes", description: "For the forest level." },
      "all",
    );
    write(dir, "Notes.txt", "notes, then more, and unsaved\n");

    const message = await backend.undoLastCommit();
    expect(message).toEqual({
      summary: "Tree and notes",
      description: "For the forest level.",
    });
    const snapshot = await backend.snapshot();
    expect(snapshot.commits[0].summary).toBe("Smaller bark");
    // The commit's changes are selected again; later edits stay on disk.
    expect(git(dir, "diff", "--cached", "--name-only").split("\n")).toEqual([
      "Assets/Tree.png",
      "Notes.txt",
      "",
    ]);
    expect(read(dir, "Notes.txt")).toBe("notes, then more, and unsaved\n");
    expect(read(dir, "Assets/Tree.png")).toBe("tree\n");
  });

  it("refuses pushed, merge and first commits", async () => {
    const { dir, backend, push } = team();
    await expect(backend.undoLastCommit()).rejects.toThrow("already pushed");

    push("Theirs.txt", "theirs\n");
    write(dir, "Mine.txt", "mine\n");
    await backend.commit({ summary: "Mine", description: "" }, "all");
    await backend.pull();
    expect((await backend.snapshot()).commits[0].parents).toHaveLength(2);
    await expect(backend.undoLastCommit()).rejects.toThrow("merge commit");

    const fresh = makeRepo();
    write(fresh, "a.txt", "a\n");
    const first = new CliBackend(nodeRunner(fresh));
    await first.commit({ summary: "First", description: "" }, "all");
    await expect(first.undoLastCommit()).rejects.toThrow("first commit");
  });

  it("counts a commit pushed to another branch as shared", async () => {
    const { dir, backend } = team();
    git(dir, "switch", "-q", "-c", "art");
    write(dir, "Art.txt", "art\n");
    await backend.commit({ summary: "Art", description: "" }, "all");
    git(dir, "push", "-q", "origin", "art");
    // No upstream for "art", but the remote has the commit.
    expect((await backend.snapshot()).sync.upstream).toBeNull();
    await expect(backend.undoLastCommit()).rejects.toThrow("already pushed");
  });
});

describe("restore a file to an older version", () => {
  it("brings back a version and its .meta as unselected changes", async () => {
    const { dir, backend } = repoWithHistory();
    const [, first] = (await backend.snapshot()).commits;
    await backend.restoreFile("Assets/Bark.png", first.sha);
    await backend.restoreFile("Assets/Bark.png.meta", first.sha);

    expect(read(dir, "Assets/Bark.png")).toBe("bark v1\n");
    expect(read(dir, "Assets/Bark.png.meta")).toContain("maxSize: 2048");
    const { files } = await backend.snapshot();
    expect(files.map((f) => [f.path, f.status, f.hunks[0].staged])).toEqual([
      ["Assets/Bark.png", "modified", false],
      ["Assets/Bark.png.meta", "modified", false],
    ]);
    // History is untouched until the user saves.
    expect(git(dir, "show", "HEAD:Assets/Bark.png")).toBe("bark v2\n");
  });

  it("brings back a deleted file from before the deletion", async () => {
    const { dir, backend } = repoWithHistory();
    git(dir, "rm", "-q", "Notes.txt");
    git(dir, "commit", "-q", "-m", "Remove notes");
    const [removal] = (await backend.snapshot()).commits;
    await backend.restoreFile("Notes.txt", `${removal.sha}^`);
    expect(read(dir, "Notes.txt")).toBe("notes\n");
    const [file] = (await backend.snapshot()).files;
    expect(file).toMatchObject({ path: "Notes.txt", status: "added" });
  });

  it("replaces unsaved and selected changes to that file only", async () => {
    const { dir, backend } = repoWithHistory();
    write(dir, "Assets/Tex[1].png", "one\n");
    write(dir, "Assets/Tex1.png", "plain one\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Textures");
    const [textures] = (await backend.snapshot()).commits;
    write(dir, "Assets/Tex[1].png", "selected edit\n");
    git(dir, "add", "Assets/Tex[1].png");
    write(dir, "Assets/Tex[1].png", "unsaved edit\n");
    write(dir, "Assets/Tex1.png", "keep me\n");

    await backend.restoreFile("Assets/Tex[1].png", textures.sha);
    expect(read(dir, "Assets/Tex[1].png")).toBe("one\n");
    // "[1]" is part of the name, not a pattern that also matches Tex1.png.
    expect(read(dir, "Assets/Tex1.png")).toBe("keep me\n");
    expect(git(dir, "diff", "--cached", "--name-only")).toBe("");
  });
});

describe("file history", () => {
  it("lists the commits that changed a file, across renames", async () => {
    const { dir, backend } = repoWithHistory();
    git(dir, "mv", "Assets/Bark.png", "Assets/Tree bark.png");
    git(dir, "commit", "-q", "-m", "Move bark");
    write(dir, "Assets/Tree bark.png", "bark v3\n");
    git(dir, "commit", "-q", "-am", "Mossy bark");

    const versions = await backend.fileHistory("Assets/Tree bark.png");
    expect(versions.map((v) => [v.commit.summary, v.path, v.status])).toEqual([
      ["Mossy bark", "Assets/Tree bark.png", "modified"],
      ["Move bark", "Assets/Tree bark.png", "renamed"],
      ["Smaller bark", "Assets/Bark.png", "modified"],
      ["First", "Assets/Bark.png", "added"],
    ]);
    // Each version can be read back from its own commit.
    const oldest = versions[3];
    const bytes = await backend.readFile(oldest.path, oldest.commit.sha);
    expect(new TextDecoder().decode(bytes!)).toBe("bark v1\n");
  });
});

describe("background fetch", () => {
  it("brings in teammates' commits and updates the last fetch time", async () => {
    const { backend, push } = team();
    const before = (await backend.snapshot()).sync;
    expect(before).toMatchObject({ behind: 0, upstream: "origin/main" });

    push("Theirs.txt", "theirs\n");
    push("More.txt", "more\n");
    await backend.fetch({ background: true });
    const after = (await backend.snapshot()).sync;
    expect(after.behind).toBe(2);
    expect(after.lastFetched).toBeGreaterThanOrEqual(before.lastFetched ?? 0);
  });

  it("fails instead of asking for a password", async () => {
    // A server that wants a sign-in, in its own process: git blocks this one.
    const server = spawn(process.execPath, [
      "-e",
      `const s = require("http").createServer((q, r) => {
        r.writeHead(401, { "WWW-Authenticate": 'Basic realm="team"' });
        r.end();
      });
      s.listen(0, "127.0.0.1", () => console.log(s.address().port));`,
    ]);
    try {
      const port = await new Promise<string>((resolve) =>
        server.stdout.once("data", (d) => resolve(String(d).trim())),
      );
      const { dir, backend } = repoWithHistory();
      git(dir, "remote", "add", "origin", `http://127.0.0.1:${port}/game.git`);
      // A password window, as far as git knows: it notes that it was asked.
      const asked = join(dir, "asked");
      write(dir, "askpass.sh", `#!/bin/sh\necho "$1" >> "${asked}"\n`);
      git(dir, "config", "core.askPass", join(dir, "askpass.sh"));

      await expect(backend.fetch({ background: true })).rejects.toThrow(
        /could not read Username/,
      );
      expect(existsSync(asked)).toBe(false);
      // A fetch someone asked for may ask.
      await expect(backend.fetch()).rejects.toThrow();
      expect(read(dir, "asked")).toContain("Username");
    } finally {
      server.kill();
    }
  });

  it("takes turns with a pull", async () => {
    const { dir, backend, push } = team();
    push("Theirs.txt", "theirs\n");
    await Promise.all([backend.fetch({ background: true }), backend.pull()]);
    expect(read(dir, "Theirs.txt")).toBe("theirs\n");
    expect((await backend.snapshot()).sync.behind).toBe(0);
  });
});
