import { describe, expect, it } from "vitest";
import { MockBackend } from "./MockBackend";
import { bulkFiles, withMetaFiles } from "./projectFiles";

describe("the demo project's files", () => {
  it("lists the sample project, without what its history deleted", async () => {
    const files = await new MockBackend("sample").trackedFiles();
    expect(files).toContain("Assets/Prefabs/Tree.prefab");
    expect(files).toContain("Assets/Prefabs/Tree.prefab.meta");
    expect(files).toContain("Assets/Textures/Bark.png");
    expect(files).toContain("Art/Tree.blend");
    expect(files).not.toContain("Assets/Textures/Bark_Old.png");
    expect(new Set(files).size).toBe(files.length);
  });

  it("knows what recent commits changed, deleted files included", async () => {
    const backend = new MockBackend("sample");
    const recent = await backend.recentFiles(400);
    const old = recent.find((r) => r.path === "Assets/Textures/Bark_Old.png");
    expect(old).toMatchObject({ sha: "c5d2f80", deleted: true });
    expect(new Set(recent.map((r) => r.path)).size).toBe(recent.length);
    // Newest first: the first file belongs to the newest commit.
    const { commits } = await backend.snapshot();
    expect(recent[0].sha).toBe(commits[0].sha);
  });

  it("gives files the history never touched a first version", async () => {
    const backend = new MockBackend("sample");
    const versions = await backend.fileHistory("Assets/Scripts/UI/MainMenu.cs");
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ status: "added" });
    expect(await backend.fileHistory("Nowhere.txt")).toEqual([]);
  });

  it("has nothing in a new project", async () => {
    const backend = new MockBackend("empty");
    expect(await backend.trackedFiles()).toEqual([]);
    expect(await backend.recentFiles(400)).toEqual([]);
  });

  it("adds .meta files for assets and their folders", () => {
    expect([...withMetaFiles(["Assets/Art/Tree.psd", "README.md"])]).toEqual([
      "Assets/Art/Tree.psd",
      "README.md",
      "Assets/Art/Tree.psd.meta",
      "Assets/Art.meta",
    ]);
  });

  it("makes as many extra files as asked, the same each time", () => {
    expect(bulkFiles(50_000)).toHaveLength(50_000);
    expect(bulkFiles(10)).toEqual(bulkFiles(10));
    expect(bulkFiles(0)).toEqual([]);
  });
});
