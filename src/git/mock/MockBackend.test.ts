import { describe, expect, it } from "vitest";
import { unresolved } from "../conflicts";
import { lfsPatterns, needsLfs, tooLarge } from "../lfs";
import { MockBackend } from "./MockBackend";

const message = { summary: "Change things", description: "" };

describe("MockBackend", () => {
  it("commits every change when nothing is selected", async () => {
    const git = new MockBackend("sample");
    const before = await git.snapshot();
    await git.commit(message, "all");
    const after = await git.snapshot();
    expect(after.files).toEqual([]);
    expect(after.commits[0].summary).toBe("Change things");
    expect(after.commits[0].parents).toEqual([before.commits[0].sha]);
    expect(after.sync.ahead).toBe(before.sync.ahead + 1);
    expect(await git.commitFiles(after.commits[0].sha)).toHaveLength(
      before.files.length,
    );
  });

  it("commits only the selected hunk and keeps the rest", async () => {
    const git = new MockBackend("sample");
    const { files } = await git.snapshot();
    const player = files[0];
    expect(player.hunks).toHaveLength(2);
    await git.setStaged(player.path, true, 0);
    await git.commit(message, "staged");
    const after = await git.snapshot();
    const remaining = after.files.find((f) => f.path === player.path);
    expect(remaining?.hunks).toHaveLength(1);
    expect(remaining?.hunks[0].header).toBe(player.hunks[1].header);
    expect(after.files).toHaveLength(files.length);
  });

  it("refuses an empty commit", async () => {
    const git = new MockBackend("empty");
    await expect(git.commit(message, "all")).rejects.toThrow(
      "nothing to commit",
    );
  });

  it("stashes everything and restores it unselected", async () => {
    const git = new MockBackend("sample");
    const { files, stashes } = await git.snapshot();
    await git.setStaged(files[1].path, true);
    await git.stash();
    let snapshot = await git.snapshot();
    expect(snapshot.files).toEqual([]);
    expect(snapshot.stashes).toHaveLength(stashes.length + 1);
    expect(snapshot.stashes[0].fileCount).toBe(files.length);

    await git.stashPop(0);
    snapshot = await git.snapshot();
    expect(snapshot.files.map((f) => f.path)).toEqual(files.map((f) => f.path));
    expect(snapshot.files.every((f) => f.hunks.every((h) => !h.staged))).toBe(
      true,
    );
    expect(snapshot.stashes).toHaveLength(stashes.length);
  });

  it("stops a pull onto unpublished work on conflicts, then merges", async () => {
    const git = new MockBackend("sample");
    const before = await git.snapshot();
    await git.pull();
    let snapshot = await git.snapshot();
    expect(snapshot.operation?.kind).toBe("merge");
    const open = unresolved(snapshot.files);
    expect(open.map((f) => f.path)).toContain("Assets/Scenes/Forest.unity");
    // A file can't be both in conflict and an unsaved change.
    expect(
      snapshot.files.filter((f) => f.path === "Assets/Textures/Bark.png"),
    ).toHaveLength(1);
    await expect(git.finishOperation()).rejects.toThrow();
    await expect(git.commit(message, "all")).rejects.toThrow("merge");
    expect(
      await git.readFile("Assets/Scripts/Player/PlayerController.cs", ":3"),
    ).not.toEqual(
      await git.readFile("Assets/Scripts/Player/PlayerController.cs", ":2"),
    );

    for (const f of open) await git.resolveConflict(f.path, "theirs");
    await git.finishOperation();
    snapshot = await git.snapshot();
    expect(snapshot.operation).toBeNull();
    expect(snapshot.sync.behind).toBe(0);
    const merge = snapshot.commits[0];
    expect(merge.parents).toHaveLength(2);
    expect(merge.parents[0]).toBe(before.commits[0].sha);
    expect(snapshot.commits).toHaveLength(before.commits.length + 3);
    expect(snapshot.files.some((f) => f.conflict)).toBe(false);
  });

  it("cancels a merge and gets the unsaved changes back", async () => {
    const git = new MockBackend("sample");
    const before = await git.snapshot();
    await git.pull();
    await git.abortOperation();
    const after = await git.snapshot();
    expect(after.operation).toBeNull();
    expect(after.files).toEqual(before.files);
    expect(after.sync.behind).toBe(before.sync.behind);
  });

  it("sets up Git LFS for the art and shows .gitattributes as a change", async () => {
    const git = new MockBackend("sample", "kinetic-sandbox");
    let { files } = await git.snapshot();
    expect(files.filter(tooLarge).map((f) => f.path)).toEqual([
      "Assets/Video/Intro.mov",
    ]);
    expect(files.filter(needsLfs).length).toBeGreaterThan(1);
    await git.setupLfs(lfsPatterns(files));
    ({ files } = await git.snapshot());
    expect(files.filter(needsLfs)).toEqual([]);
    expect(files.filter(tooLarge)).toEqual([]);
    expect(files.at(-1)?.path).toBe(".gitattributes");
  });

  it("commits a selected binary file as a whole", async () => {
    const git = new MockBackend("sample");
    // A binary change has no hunks; its own flag carries the selection.
    (git as unknown as { files: unknown[] }).files.push({
      path: "Assets/Art/Hero.png",
      status: "added",
      hunks: [],
      binary: true,
    });
    await git.setStaged("Assets/Art/Hero.png", true);
    const commit = await git.commit(message, "staged");
    const after = await git.snapshot();
    expect(
      after.files.find((f) => f.path === "Assets/Art/Hero.png"),
    ).toBeUndefined();
    expect((await git.commitFiles(commit.sha)).map((f) => f.path)).toEqual([
      "Assets/Art/Hero.png",
    ]);
  });

  it("discards a file entirely, including its selected parts", async () => {
    const git = new MockBackend("sample");
    const { files } = await git.snapshot();
    await git.setStaged(files[0].path, true, 0);
    await git.discard(files[0].path);
    const after = await git.snapshot();
    expect(after.files.find((f) => f.path === files[0].path)).toBeUndefined();
  });
});

describe("MockBackend safety nets", () => {
  it("undoes the latest save and refuses a merge commit", async () => {
    const git = new MockBackend("sample");
    await git.commit({ summary: "Moss", description: "Greener" }, "all");
    const saved = await git.snapshot();
    expect(await git.undoLastCommit()).toEqual({
      summary: "Moss",
      description: "Greener",
    });
    const undone = await git.snapshot();
    expect(undone.commits).toEqual(saved.commits.slice(1));
    expect(undone.sync.ahead).toBe(saved.sync.ahead - 1);
    expect(undone.files.length).toBeGreaterThan(0);
    expect(
      undone.files.every((f) => f.staged || f.hunks.every((h) => h.staged)),
    ).toBe(true);

    await git.undoLastCommit(); // the sample's own latest commit
    await expect(git.undoLastCommit()).rejects.toThrow("merge commit");
  });

  it("puts a file back to an older version and lists its versions", async () => {
    const git = new MockBackend("sample");
    const versions = await git.fileHistory("Assets/Textures/Moss.tga");
    expect(versions.map((v) => [v.commit.summary, v.status])).toEqual([
      ["Texture pass: moss, cliffs, poster and a waving hero", "modified"],
      ["Create base scene and project structure", "added"],
    ]);
    const first = versions[1].commit.sha;
    // A text file, since Node has no canvas to paint the sample textures.
    const material = "Assets/Materials/Bark.mat";
    const text = async (revision: string) =>
      new TextDecoder().decode((await git.readFile(material, revision))!);
    await git.restoreFile(material, first);
    const { files } = await git.snapshot();
    expect(files.find((f) => f.path === material)?.status).toBe("modified");
    // The restored file reads as that version; the latest commit has another.
    expect(await text("worktree")).toBe(await text(first));
    expect(await text("HEAD")).not.toBe(await text("worktree"));
  });

  it("finds a teammate's push on the next fetch", async () => {
    const git = new MockBackend("sample");
    const before = (await git.snapshot()).sync;
    await git.fetch();
    const after = (await git.snapshot()).sync;
    expect(after.behind).toBe(before.behind + 1);
    expect(after.lastFetched).toBeGreaterThan(before.lastFetched!);
    // The next one isn't pushed yet.
    await git.fetch();
    expect((await git.snapshot()).sync.behind).toBe(after.behind);
  });
});
