import { describe, expect, it } from "vitest";
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

  it("merges incoming commits when the branch has unpublished work", async () => {
    const git = new MockBackend("sample");
    const before = await git.snapshot();
    await git.pull();
    const after = await git.snapshot();
    expect(after.sync.behind).toBe(0);
    const merge = after.commits[0];
    expect(merge.parents).toHaveLength(2);
    expect(merge.parents[0]).toBe(before.commits[0].sha);
    expect(after.commits).toHaveLength(before.commits.length + 3);
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
