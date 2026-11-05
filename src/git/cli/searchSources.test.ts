// What project search reads from a real repository: tracked files and recently changed ones.
import { afterAll, describe, expect, it } from "vitest";
import { indexFiles } from "../../search/rank";
import { CliBackend } from "./CliBackend";
import { cleanup, git, makeRepo, nodeRunner, write } from "./testRepo";

afterAll(cleanup);

function commit(dir: string, message: string) {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", message);
}

describe("CliBackend for search", () => {
  it("lists tracked files, with spaces and Cyrillic as they are", async () => {
    const dir = makeRepo();
    write(dir, "Assets/Textures/Bark.png", "png");
    write(dir, "Assets/Текстуры/кора дерева.png", "png");
    write(dir, "README.md", "hi\n");
    commit(dir, "First");
    write(dir, "Assets/New.cs", "class New {}\n");
    git(dir, "add", "Assets/New.cs");
    write(dir, "untracked.txt", "not yet\n");
    const backend = new CliBackend(nodeRunner(dir));

    expect((await backend.trackedFiles()).sort()).toEqual([
      "Assets/New.cs",
      "Assets/Textures/Bark.png",
      "Assets/Текстуры/кора дерева.png",
      "README.md",
    ]);
  });

  it("lists recently changed files newest first, each once, deleted ones too", async () => {
    const dir = makeRepo();
    write(dir, "Art/Tree.psd", "v1");
    write(dir, "Art/Old.png", "old");
    write(dir, "Docs/notes.txt", "a\n");
    commit(dir, "Add art");
    write(dir, "Art/Tree.psd", "v2");
    git(dir, "rm", "-q", "Art/Old.png");
    commit(dir, "Paint tree, drop old");
    git(dir, "mv", "Docs/notes.txt", "Docs/заметки.txt");
    commit(dir, "Rename notes");
    const backend = new CliBackend(nodeRunner(dir));
    const [renamed, painted] = git(dir, "log", "--format=%H")
      .trim()
      .split("\n");

    const recent = await backend.recentFiles(10);
    expect(recent.map((r) => [r.path, r.sha, r.deleted])).toEqual([
      // A rename is the old path gone and the new one added.
      ["Docs/notes.txt", renamed, true],
      ["Docs/заметки.txt", renamed, false],
      ["Art/Old.png", painted, true],
      ["Art/Tree.psd", painted, false],
    ]);
    expect(recent[0].date).toBeGreaterThan(Date.now() - 600_000);
    expect(recent[0].date).toBeLessThanOrEqual(Date.now() + 1000);

    // Only as far back as asked.
    expect((await backend.recentFiles(1)).map((r) => r.path)).toEqual([
      "Docs/notes.txt",
      "Docs/заметки.txt",
    ]);

    // What search makes of it: the deleted file stays findable.
    const files = indexFiles(await backend.trackedFiles(), recent);
    expect(files.filter((f) => f.deleted).map((f) => f.path)).toEqual([
      "Docs/notes.txt",
      "Art/Old.png",
    ]);
    expect(files.find((f) => f.path === "Art/Tree.psd")?.changedAt).toBe(
      recent[3].date,
    );
  });

  it("copes with an empty repository", async () => {
    const dir = makeRepo();
    const backend = new CliBackend(nodeRunner(dir));
    expect(await backend.recentFiles(10)).toEqual([]);
    expect(await backend.trackedFiles()).toEqual([]);
  });

  it("lists a conflicted file once", async () => {
    const dir = makeRepo();
    write(dir, "Scene.unity", "base\n");
    commit(dir, "Base");
    git(dir, "switch", "-q", "-c", "other");
    write(dir, "Scene.unity", "theirs\n");
    commit(dir, "Theirs");
    git(dir, "switch", "-q", "main");
    write(dir, "Scene.unity", "mine\n");
    commit(dir, "Mine");
    // Stopping on the conflict is what this test wants.
    expect(() => git(dir, "merge", "other")).toThrow();
    expect(git(dir, "ls-files", "--unmerged")).toContain("Scene.unity");

    const backend = new CliBackend(nodeRunner(dir));
    expect(await backend.trackedFiles()).toEqual(["Scene.unity"]);
  });
});
