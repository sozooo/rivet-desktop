import { afterAll, describe, expect, it } from "vitest";
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
    expect(await backend.resolveGuid(guid)).toBe("Assets/Textures/Bark.png");
    expect(await backend.resolveGuid("0".repeat(32))).toBeNull();
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
