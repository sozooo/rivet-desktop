import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { lfsPatterns, needsLfs, tooLarge } from "../lfs";
import type { FileChange } from "../types";
import { CliBackend } from "./CliBackend";
import { cleanup, git, makeRepo, nodeRunner, write } from "./testRepo";

afterAll(cleanup);

const message = (summary: string) => ({ summary, description: "" });
const lines = (n: number, change?: Record<number, string>) =>
  Array.from({ length: n }, (_, i) => change?.[i] ?? `line ${i + 1}`).join(
    "\n",
  ) + "\n";

async function repoWithCommit() {
  const dir = makeRepo();
  write(dir, "Assets/Player.cs", lines(30));
  write(dir, "README.md", "hello\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "Initial commit");
  return { dir, backend: new CliBackend(nodeRunner(dir)) };
}

describe("CliBackend on a real repository", () => {
  it("reads an empty repository and makes the first commit", async () => {
    const dir = makeRepo();
    write(dir, "Текстуры/дерево notes.txt", "кора\nлистья\n");
    const backend = new CliBackend(nodeRunner(dir));

    let snapshot = await backend.snapshot();
    expect(snapshot.commits).toEqual([]);
    expect(snapshot.branches.current).toBe("main");
    expect(snapshot.user.name).toBe("Test User");
    const [file] = snapshot.files;
    expect(file.path).toBe("Текстуры/дерево notes.txt");
    expect(file.status).toBe("added");
    expect(file.hunks[0].lines.map((l) => l.text)).toEqual(["кора", "листья"]);

    await backend.commit({ summary: "First", description: "Body text" }, "all");
    snapshot = await backend.snapshot();
    expect(snapshot.files).toEqual([]);
    expect(snapshot.commits).toHaveLength(1);
    expect(snapshot.commits[0]).toMatchObject({
      summary: "First",
      description: "Body text",
      parents: [],
    });
    const committed = await backend.commitFiles(snapshot.commits[0].sha);
    expect(committed.map((f) => f.path)).toEqual(["Текстуры/дерево notes.txt"]);
  });

  it("selects and unselects single hunks, and commits only the selection", async () => {
    const { dir, backend } = await repoWithCommit();
    write(
      dir,
      "Assets/Player.cs",
      lines(30, { 1: "changed top", 27: "changed bottom" }),
    );

    let [file] = (await backend.snapshot()).files;
    expect(file.hunks).toHaveLength(2);
    await backend.setStaged(file.path, true, 1);
    [file] = (await backend.snapshot()).files;
    // Selected hunks come first.
    expect(file.hunks.map((h) => h.staged)).toEqual([true, false]);
    expect(file.hunks[0].lines.some((l) => l.text === "changed bottom")).toBe(
      true,
    );

    await backend.setStaged(file.path, false, 0);
    [file] = (await backend.snapshot()).files;
    expect(file.hunks.map((h) => h.staged)).toEqual([false, false]);

    await backend.setStaged(file.path, true, 0);
    await backend.commit(message("Top only"), "staged");
    const snapshot = await backend.snapshot();
    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.files[0].hunks).toHaveLength(1);
    expect(
      snapshot.files[0].hunks[0].lines.some((l) => l.text === "changed bottom"),
    ).toBe(true);
    expect(git(dir, "show", "HEAD:Assets/Player.cs")).toContain("changed top");
  });

  it("refuses an empty commit and keeps working after git errors", async () => {
    const { backend } = await repoWithCommit();
    await expect(backend.commit(message("Nothing"), "all")).rejects.toThrow(
      "nothing to commit",
    );
    await expect(backend.switchBranch("does-not-exist")).rejects.toThrow();
    expect((await backend.snapshot()).branches.current).toBe("main");
  });

  it("treats binary files as whole files and reads them at any revision", async () => {
    const { dir, backend } = await repoWithCommit();
    const before = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]);
    const after = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 9, 9, 9]);
    write(dir, "Art/Hero.png", before);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Add hero");
    write(dir, "Art/Hero.png", after);

    let [file] = (await backend.snapshot()).files;
    expect(file).toMatchObject({
      path: "Art/Hero.png",
      binary: true,
      hunks: [],
      staged: false,
    });
    expect(await backend.readFile(file.path, "HEAD")).toEqual(before);
    expect(await backend.readFile(file.path, "worktree")).toEqual(after);
    expect(await backend.readFile("Art/Missing.png", "HEAD")).toBeNull();

    await backend.setStaged(file.path, true);
    [file] = (await backend.snapshot()).files;
    expect(file.staged).toBe(true);
    expect(await backend.readFile(file.path, "index")).toEqual(after);
  });

  it("finds the asset behind a Unity GUID", async () => {
    const { dir, backend } = await repoWithCommit();
    const guid = "8c0f6e2d4b1a49c7a5e3d1f0b9c8a7e6";
    write(
      dir,
      "Assets/Textures/Bark.png.meta",
      `fileFormatVersion: 2\nguid: ${guid}\n`,
    );
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Texture");
    // A texture that is not committed yet can already be used by a material.
    const fresh = "3e5a7c9b1d2f40e6a8c0b2d4f6e8a0c2";
    write(dir, "Assets/Textures/Moss.tga.meta", `guid: ${fresh}\n`);
    expect(await backend.resolveGuid(guid)).toBe("Assets/Textures/Bark.png");
    expect(await backend.resolveGuid(fresh)).toBe("Assets/Textures/Moss.tga");
    expect(await backend.resolveGuid("0".repeat(32))).toBeNull();
  });

  it("reads Git LFS files from the local object store", async () => {
    const { dir, backend } = await repoWithCommit();
    const content = new Uint8Array([0x38, 0x42, 0x50, 0x53, 0, 1, 2, 3]);
    const oid = createHash("sha256").update(content).digest("hex");
    const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${content.length}\n`;
    write(dir, "Art/Cliff.psd", pointer);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Cliff");
    // Not downloaded: the pointer is all there is, and the preview says so.
    const missing = await backend.readFile("Art/Cliff.psd", "HEAD");
    expect(new TextDecoder().decode(missing!)).toBe(pointer);

    const object = `.git/lfs/objects/${oid.slice(0, 2)}/${oid.slice(2, 4)}/${oid}`;
    write(dir, object, content);
    expect(await backend.readFile("Art/Cliff.psd", "HEAD")).toEqual(content);
    expect(await backend.readFile("Art/Cliff.psd", "worktree")).toEqual(
      content,
    );
  });

  it("detects renames and discards every kind of change", async () => {
    const { dir, backend } = await repoWithCommit();
    git(dir, "mv", "README.md", "About.md");
    write(dir, "Assets/Player.cs", lines(30, { 5: "edited" }));
    write(dir, "Scratch/new file.txt", "temporary\n");

    let { files } = await backend.snapshot();
    const renamed = files.find((f) => f.status === "renamed");
    expect(renamed).toMatchObject({ path: "About.md", oldPath: "README.md" });

    for (const f of files) await backend.discard(f.path);
    files = (await backend.snapshot()).files;
    expect(files).toEqual([]);
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("stashes everything, including new files, and restores it", async () => {
    const { dir, backend } = await repoWithCommit();
    write(dir, "Assets/Player.cs", lines(30, { 3: "work" }));
    write(dir, "Art/sketch.txt", "draft\n");

    await backend.stash();
    let snapshot = await backend.snapshot();
    expect(snapshot.files).toEqual([]);
    expect(snapshot.stashes).toHaveLength(1);
    expect(snapshot.stashes[0]).toMatchObject({
      branch: "main",
      message: "Changes on main",
      fileCount: 2,
    });
    expect((await backend.stashFiles(0)).map((f) => f.path).sort()).toEqual([
      "Art/sketch.txt",
      "Assets/Player.cs",
    ]);

    await backend.stashPop(0);
    snapshot = await backend.snapshot();
    expect(snapshot.files.map((f) => f.path).sort()).toEqual([
      "Art/sketch.txt",
      "Assets/Player.cs",
    ]);
    expect(snapshot.stashes).toEqual([]);
  });

  it("creates, switches and compares branches", async () => {
    const { dir, backend } = await repoWithCommit();
    await backend.createBranch("feature/hair");
    await backend.switchBranch("feature/hair");
    write(dir, "Hair.cs", "class Hair {}\n");
    await backend.commit(message("Hair"), "all");

    const snapshot = await backend.snapshot();
    expect(snapshot.branches.current).toBe("feature/hair");
    expect(snapshot.branches.local.sort()).toEqual(["feature/hair", "main"]);
    expect(await backend.compareBranch("feature/hair", "main")).toEqual({
      base: "main",
      ahead: 1,
      behind: 0,
    });
  });

  it("publishes, fetches and pulls with a merge commit when both sides moved", async () => {
    const remote = makeRepo("remote");
    git(remote, "config", "receive.denyCurrentBranch", "ignore");
    const { dir, backend } = await repoWithCommit();
    git(dir, "remote", "add", "origin", remote);

    expect((await backend.snapshot()).sync.upstream).toBeNull();
    await backend.push();
    let snapshot = await backend.snapshot();
    expect(snapshot.sync).toMatchObject({
      upstream: "origin/main",
      ahead: 0,
      behind: 0,
    });

    // A teammate pushes from their own clone.
    const teammate = makeRepo("teammate");
    git(teammate, "pull", "-q", remote, "main");
    write(teammate, "Teammate.cs", "class T {}\n");
    git(teammate, "add", "-A");
    git(teammate, "commit", "-q", "-m", "Teammate work");
    git(teammate, "push", "-q", remote, "HEAD:main");

    write(dir, "Mine.cs", "class M {}\n");
    await backend.commit(message("My work"), "all");
    await backend.fetch();
    snapshot = await backend.snapshot();
    expect(snapshot.sync).toMatchObject({ ahead: 1, behind: 1 });
    expect(snapshot.sync.lastFetched).toBeGreaterThan(0);

    await backend.pull();
    snapshot = await backend.snapshot();
    expect(snapshot.commits[0].parents).toHaveLength(2);
    expect(snapshot.sync.behind).toBe(0);
    await backend.push();
    expect((await backend.snapshot()).sync.ahead).toBe(0);
  });
});

/** A repository whose main branch and "other" both changed the same files. */
function divergedRepo() {
  const dir = makeRepo();
  const png = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, n]);
  write(dir, "Assets/Player.cs", lines(10));
  write(dir, "Art/Hero.png", png(1));
  write(dir, "Art/Old.png", png(2));
  write(dir, "Notes.txt", "notes\n");
  write(dir, "Shared.txt", "shared\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "Base");
  git(dir, "switch", "-q", "-c", "other");
  write(dir, "Assets/Player.cs", lines(10, { 4: "theirs" }));
  write(dir, "Art/Hero.png", png(3));
  git(dir, "rm", "-q", "Art/Old.png");
  write(dir, "Notes.txt", "notes from them\n");
  write(dir, "Shared.txt", "shared, improved by them\n");
  git(dir, "commit", "-q", "-am", "Their work");
  git(dir, "switch", "-q", "main");
  write(dir, "Assets/Player.cs", lines(10, { 4: "mine" }));
  write(dir, "Art/Hero.png", png(4));
  write(dir, "Art/Old.png", png(5));
  git(dir, "rm", "-q", "Notes.txt");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "My work");
  return { dir, backend: new CliBackend(nodeRunner(dir)), png };
}

/** Runs a git command that is expected to stop on conflicts. */
const gitStops = (dir: string, ...args: string[]) =>
  expect(() => git(dir, ...args)).toThrow();
const byPath = (files: FileChange[]) =>
  Object.fromEntries(files.map((f) => [f.path, f]));

describe("CliBackend conflicts", () => {
  it("stops a pull on conflicts and settles each kind of file", async () => {
    const remote = makeRepo("remote");
    git(remote, "config", "receive.denyCurrentBranch", "ignore");
    const { dir, backend, png } = divergedRepo();
    git(dir, "push", "-q", remote, "other:main");
    git(dir, "remote", "add", "origin", remote);
    git(dir, "fetch", "-q", "origin");
    git(dir, "branch", "-q", "--set-upstream-to=origin/main");

    await backend.pull();
    let snapshot = await backend.snapshot();
    expect(snapshot.operation).toMatchObject({
      kind: "merge",
      mine: "HEAD",
      theirs: "MERGE_HEAD",
    });
    expect(snapshot.operation?.message).toMatch(/^Merge branch 'main' of /);
    let files = byPath(snapshot.files);
    expect(files["Assets/Player.cs"]).toMatchObject({
      status: "modified",
      conflict: { mine: true, theirs: true },
    });
    // Text conflicts show how their version differs from mine.
    const changed = files["Assets/Player.cs"].hunks[0].lines.filter(
      (l) => l.kind !== "context",
    );
    expect(changed).toEqual([
      { kind: "del", text: "mine" },
      { kind: "add", text: "theirs" },
    ]);
    expect(files["Art/Hero.png"]).toMatchObject({
      binary: true,
      conflict: { mine: true, theirs: true },
    });
    // Deleted on one side: the status says which side still has the file.
    expect(files["Art/Old.png"]).toMatchObject({
      status: "deleted",
      conflict: { mine: true, theirs: false },
    });
    expect(files["Notes.txt"]).toMatchObject({
      status: "added",
      conflict: { mine: false, theirs: true },
    });
    // Merged on its own: an ordinary change.
    expect(files["Shared.txt"].conflict).toBeUndefined();
    expect(await backend.readFile("Art/Hero.png", ":2")).toEqual(png(4));
    expect(await backend.readFile("Art/Hero.png", ":3")).toEqual(png(3));
    await expect(backend.commit(message("Too early"), "all")).rejects.toThrow(
      "merge",
    );

    await backend.resolveConflict("Assets/Player.cs", "theirs");
    await backend.resolveConflict("Art/Hero.png", "mine");
    await backend.resolveConflict("Art/Old.png", "theirs");
    await backend.resolveConflict("Notes.txt", "mine");
    snapshot = await backend.snapshot();
    expect(
      Object.fromEntries(
        snapshot.files
          .filter((f) => f.conflict)
          .map((f) => [f.path, f.conflict!.resolution]),
      ),
    ).toEqual({
      "Assets/Player.cs": "theirs",
      "Art/Hero.png": "mine",
      "Art/Old.png": "theirs",
      "Notes.txt": "mine",
    });
    expect(git(dir, "show", ":Assets/Player.cs")).toContain("theirs");
    expect(git(dir, "ls-files", "Art/Old.png", "Notes.txt")).toBe("");
    // Once resolved, the operation's commits stand in for the stages.
    expect(await backend.readFile("Art/Hero.png", "MERGE_HEAD")).toEqual(
      png(3),
    );

    // A change of mind reopens the conflict and takes the other side.
    await backend.resolveConflict("Assets/Player.cs", "mine");
    await backend.resolveConflict("Art/Old.png", "mine");
    files = byPath((await backend.snapshot()).files);
    expect(files["Assets/Player.cs"].conflict?.resolution).toBe("mine");
    expect(files["Art/Old.png"].conflict?.resolution).toBe("mine");

    await backend.finishOperation();
    snapshot = await backend.snapshot();
    expect(snapshot.operation).toBeNull();
    expect(snapshot.files).toEqual([]);
    expect(snapshot.commits[0].parents).toHaveLength(2);
    expect(snapshot.commits[0].summary).toMatch(/^Merge branch 'main' of /);
    expect(snapshot.commits[0].description).toBe("");
    expect(git(dir, "show", "HEAD:Assets/Player.cs")).toContain("mine");
    expect(git(dir, "show", "HEAD:Art/Old.png")).toBeTruthy();
    expect(git(dir, "show", "HEAD:Shared.txt")).toContain("improved");
  });

  it("cancels a merge and puts everything back", async () => {
    const { dir, backend } = divergedRepo();
    write(dir, "Scratch.txt", "unsaved\n");
    const head = git(dir, "rev-parse", "HEAD");
    gitStops(dir, "merge", "other");
    expect((await backend.snapshot()).operation?.kind).toBe("merge");

    await backend.abortOperation();
    const snapshot = await backend.snapshot();
    expect(snapshot.operation).toBeNull();
    expect(snapshot.files.map((f) => f.path)).toEqual(["Scratch.txt"]);
    expect(git(dir, "rev-parse", "HEAD")).toBe(head);
  });

  it("marks a file fixed by hand as resolved once its markers are gone", async () => {
    const { dir, backend } = divergedRepo();
    gitStops(dir, "merge", "other");
    await expect(backend.markResolved("Assets/Player.cs")).rejects.toThrow(
      "conflict markers",
    );
    write(dir, "Assets/Player.cs", lines(10, { 4: "mine and theirs" }));
    await backend.markResolved("Assets/Player.cs");
    const files = byPath((await backend.snapshot()).files);
    expect(files["Assets/Player.cs"].conflict?.resolution).toBe("manual");
  });

  it("knows a rebase replays my commits, so mine is the other stage", async () => {
    const { dir, backend } = divergedRepo();
    gitStops(dir, "rebase", "other");
    const snapshot = await backend.snapshot();
    expect(snapshot.operation).toMatchObject({
      kind: "rebase",
      mine: "REBASE_HEAD",
      theirs: "HEAD",
    });
    const files = byPath(snapshot.files);
    expect(files["Notes.txt"].conflict).toEqual({ mine: false, theirs: true });
    expect(files["Art/Old.png"].conflict).toEqual({
      mine: true,
      theirs: false,
    });
    expect(files["Assets/Player.cs"].hunks[0].lines).toContainEqual({
      kind: "del",
      text: "mine",
    });

    await backend.resolveConflict("Assets/Player.cs", "mine");
    expect(git(dir, "show", ":Assets/Player.cs")).toContain("mine");
    await backend.abortOperation();
    expect((await backend.snapshot()).operation).toBeNull();
    expect(git(dir, "show", "HEAD:Assets/Player.cs")).toContain("mine");
  });

  it("finishes a cherry-pick", async () => {
    const { dir, backend } = divergedRepo();
    gitStops(dir, "cherry-pick", "other");
    let snapshot = await backend.snapshot();
    expect(snapshot.operation?.kind).toBe("cherry-pick");
    for (const file of snapshot.files)
      if (file.conflict) await backend.resolveConflict(file.path, "theirs");
    await backend.finishOperation();
    snapshot = await backend.snapshot();
    expect(snapshot.operation).toBeNull();
    expect(snapshot.commits[0].summary).toBe("Their work");
  });
});

describe("CliBackend and large files", () => {
  it("sets up Git LFS for art, including files selected earlier", async () => {
    const { dir, backend } = await repoWithCommit();
    write(dir, "Art/Rock.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 7]));
    write(dir, "Art/Tree.psd", new Uint8Array([0x38, 0x42, 0x50, 0x53, 0, 7]));
    git(dir, "add", "Art/Tree.psd");

    let snapshot = await backend.snapshot();
    expect(snapshot.lfs).toEqual({ installed: true, tracking: false });
    expect(
      snapshot.files
        .filter(needsLfs)
        .map((f) => f.path)
        .sort(),
    ).toEqual(["Art/Rock.png", "Art/Tree.psd"]);
    expect(byPath(snapshot.files)["Art/Rock.png"].size).toBe(6);

    await backend.setupLfs(lfsPatterns(snapshot.files));
    snapshot = await backend.snapshot();
    expect(snapshot.lfs.tracking).toBe(true);
    expect(snapshot.files.filter(needsLfs)).toEqual([]);
    const files = byPath(snapshot.files);
    expect(files["Art/Rock.png"].lfs).toBe(true);
    // .gitattributes is a change to save like any other.
    expect(files[".gitattributes"].hunks[0].lines.map((l) => l.text)).toContain(
      "*.png filter=lfs diff=lfs merge=lfs -text",
    );
    // The file selected before now sits in the index as an LFS pointer.
    expect(git(dir, "show", ":Art/Tree.psd")).toMatch(
      /^version https:\/\/git-lfs/,
    );
    expect(git(dir, "config", "--local", "filter.lfs.clean")).toContain(
      "git-lfs",
    );

    await backend.commit(message("Art"), "all");
    expect(git(dir, "show", "HEAD:Art/Rock.png")).toMatch(/^version https/);
    expect(await backend.readFile("Art/Rock.png", "HEAD")).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 7]),
    );
  });

  it("warns about files GitHub would refuse, in changes and in unpushed commits", async () => {
    const { dir, backend } = await repoWithCommit();
    git(dir, "remote", "add", "origin", makeRepo("remote"));
    const size = 101 * 1024 * 1024;
    write(dir, "Video/Intro.mov", new Uint8Array(size));
    let snapshot = await backend.snapshot();
    expect(snapshot.files.filter(tooLarge).map((f) => f.path)).toEqual([
      "Video/Intro.mov",
    ]);
    expect(snapshot.sync.tooLarge).toBeUndefined();

    await backend.commit(message("Cutscene"), "all");
    snapshot = await backend.snapshot();
    expect(snapshot.sync.tooLarge).toEqual([{ path: "Video/Intro.mov", size }]);
  });

  it("sets up Unity Smart Merge for scenes and prefabs", async () => {
    const { dir, backend } = await repoWithCommit();
    expect((await backend.snapshot()).smartMerge).toBeUndefined();
    write(
      dir,
      "Game/ProjectSettings/ProjectVersion.txt",
      "m_EditorVersion: 6\n",
    );
    write(dir, ".gitattributes", "*.psd filter=lfs diff=lfs merge=lfs -text\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Unity project");
    const tool = join(makeRepo("unity"), "UnityYAMLMerge.exe");
    writeFileSync(tool, "");

    const unity = new CliBackend(nodeRunner(dir));
    expect((await unity.snapshot()).smartMerge).toBe(false);
    await unity.setupSmartMerge(tool);
    const snapshot = await unity.snapshot();
    expect(snapshot.smartMerge).toBe(true);
    expect(git(dir, "config", "merge.unityyamlmerge.driver")).toContain(
      "merge -h -p --force --fallback none %O %B %A %A",
    );
    expect(readFileSync(join(dir, ".gitattributes"), "utf8")).toContain(
      "*.psd filter=lfs diff=lfs merge=lfs -text\n\n# Unity Smart Merge",
    );
    expect(git(dir, "check-attr", "merge", "Game/Assets/Forest.unity")).toBe(
      "Game/Assets/Forest.unity: merge: unityyamlmerge\n",
    );
  });
});
