import { afterEach, describe, expect, it } from "vitest";
import { demoFlags } from "../../demoFlags";
import { MockBackend } from "./MockBackend";

const message = { summary: "Stop saving Unity's folders", description: "" };

describe("MockBackend and Unity's generated files", () => {
  afterEach(() => {
    demoFlags.gitignore = null;
  });

  it("has nothing to fix without the demo switch, and a new repository starts with Unity's .gitignore", async () => {
    const sample = new MockBackend("sample");
    expect((await sample.snapshot()).generated).toBeUndefined();
    expect(await sample.ignoreUnityGenerated()).toEqual([]);
    const created = await new MockBackend("empty").snapshot();
    expect(created.files.map((f) => [f.path, f.status])).toEqual([
      [".gitignore", "added"],
    ]);
  });

  it("fixes generated folders that were never committed", async () => {
    demoFlags.gitignore = "missing";
    const git = new MockBackend("sample");
    expect((await git.snapshot()).generated?.untracked).toContain("Library/");
    expect(await git.ignoreUnityGenerated()).toEqual([".gitignore"]);
    const after = await git.snapshot();
    expect(after.generated).toBeUndefined();
    expect(after.files.map((f) => f.path)).toContain(".gitignore");
  });

  it("stops tracking committed ones in a commit of their own", async () => {
    demoFlags.gitignore = "committed";
    const git = new MockBackend("sample");
    const before = await git.snapshot();
    expect(before.generated?.tracked).toContain("Library/");
    expect(before.files.some((f) => f.path.startsWith("Library/"))).toBe(true);
    const own = before.files.filter(
      (f) => !/^(Library|UserSettings)\//.test(f.path),
    );

    const commit = await git.untrackUnityGenerated(message);
    const after = await git.snapshot();
    expect(after.generated).toBeUndefined();
    expect(after.commits[0].sha).toBe(commit.sha);
    expect(after.sync.ahead).toBe(before.sync.ahead + 1);
    // The artist's own changes are untouched.
    expect(after.files).toEqual(own);
    const committed = await git.commitFiles(commit.sha);
    expect(committed.map((f) => f.path)).toContain(".gitignore");
    expect(committed.map((f) => f.path)).toContain("Library/ArtifactDB");
  });
});
