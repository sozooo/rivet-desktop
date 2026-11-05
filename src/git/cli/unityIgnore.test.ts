import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { UNITY_GITIGNORE } from "../../unity/gitignore";
import { CliBackend } from "./CliBackend";
import {
  cleanup,
  git,
  makeRepo,
  nodeRunner,
  write,
  writeScript,
} from "./testRepo";

afterAll(cleanup);

const message = (summary: string) => ({ summary, description: "" });
const lines = (text: string) => text.split("\n").filter(Boolean).sort();

/** A Unity project as Unity leaves it, with nothing ignored: `prefix` is its folder in the repository. */
function unityProject(dir: string, prefix = "", libraryFiles = 50) {
  write(
    dir,
    `${prefix}ProjectSettings/ProjectVersion.txt`,
    "m_EditorVersion: 6000.0.32f1\n",
  );
  write(dir, `${prefix}Packages/manifest.json`, "{}\n");
  write(dir, `${prefix}Assets/Art/Bark.png.meta`, "guid: 1\n");
  write(
    dir,
    `${prefix}Assets/Art/Bark.png`,
    new Uint8Array([0x89, 0x50, 0, 1]),
  );
  write(dir, `${prefix}Assets/Scenes/Forest.unity`, "%YAML 1.1\n");
  for (let i = 0; i < libraryFiles; i++)
    write(
      dir,
      `${prefix}Library/Artifacts/${i % 7}/${i}.bin`,
      new Uint8Array([0, i]),
    );
  write(dir, `${prefix}Library/ArtifactDB`, new Uint8Array([0, 1, 2]));
  write(dir, `${prefix}Temp/UnityLockfile`, "");
  write(dir, `${prefix}Logs/AssetImportWorker0.log`, "log\n");
  write(dir, `${prefix}UserSettings/EditorUserSettings.asset`, "%YAML 1.1\n");
  write(dir, `${prefix}Assembly-CSharp.csproj`, "<Project/>\n");
  write(dir, `${prefix}kinetic.sln`, "\n");
}

describe("Unity's generated files in a repository", () => {
  it("keeps them out of the list, commits, selections and stashes", async () => {
    const dir = makeRepo();
    unityProject(dir);
    const backend = new CliBackend(nodeRunner(dir));

    let snapshot = await backend.snapshot();
    expect(snapshot.generated).toEqual({
      untracked: [
        "Assembly-CSharp.csproj",
        "Library/",
        "Logs/",
        "Temp/",
        "UserSettings/",
        "kinetic.sln",
      ],
      tracked: [],
    });
    // New folders are listed file by file, as before.
    expect(snapshot.files.map((f) => f.path).sort()).toEqual([
      "Assets/Art/Bark.png",
      "Assets/Art/Bark.png.meta",
      "Assets/Scenes/Forest.unity",
      "Packages/manifest.json",
      "ProjectSettings/ProjectVersion.txt",
    ]);
    expect(snapshot.files.every((f) => f.status === "added")).toBe(true);
    expect(snapshot.smartMerge).toBe(false);

    await backend.setAllStaged(true);
    expect(git(dir, "diff", "--cached", "--name-only")).not.toMatch(
      /Library|Temp|Logs|UserSettings|csproj|sln/,
    );
    await backend.setAllStaged(false);

    await backend.commit(message("First version"), "all");
    expect(lines(git(dir, "ls-files"))).toEqual([
      "Assets/Art/Bark.png",
      "Assets/Art/Bark.png.meta",
      "Assets/Scenes/Forest.unity",
      "Packages/manifest.json",
      "ProjectSettings/ProjectVersion.txt",
    ]);

    // Putting changes aside never moves Unity's folders.
    write(dir, "Assets/Scenes/Forest.unity", "%YAML 1.1\nchanged\n");
    write(dir, "Assets/New.txt", "new\n");
    await backend.snapshot();
    await backend.stash();
    expect(
      lines(git(dir, "stash", "show", "--include-untracked", "--name-only")),
    ).toEqual(["Assets/New.txt", "Assets/Scenes/Forest.unity"]);
    expect(existsSync(join(dir, "Library/ArtifactDB"))).toBe(true);
    expect(existsSync(join(dir, "Temp/UnityLockfile"))).toBe(true);
  });

  it("writes Unity's .gitignore, and the safety net goes away", async () => {
    const dir = makeRepo();
    unityProject(dir);
    const backend = new CliBackend(nodeRunner(dir));
    expect((await backend.snapshot()).generated?.untracked).toHaveLength(6);

    expect(await backend.ignoreUnityGenerated()).toEqual([".gitignore"]);
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe(UNITY_GITIGNORE);
    const snapshot = await backend.snapshot();
    expect(snapshot.generated).toBeUndefined();
    expect(snapshot.files.map((f) => f.path)).toContain(".gitignore");
    // git agrees: none of it is waiting to be added.
    expect(git(dir, "status", "--porcelain", "-uall")).not.toMatch(
      /Library|Temp|Logs|UserSettings|csproj|sln/,
    );
    // Nothing more to add the second time.
    expect(await backend.ignoreUnityGenerated()).toEqual([]);
  });

  it("adds only the missing lines to a .gitignore the project has", async () => {
    const dir = makeRepo();
    unityProject(dir);
    write(dir, ".gitignore", "# Ours\r\nSecrets.txt\r\n/[Ll]ibrary/\r\n");
    write(dir, "Secrets.txt", "token\n");
    const backend = new CliBackend(nodeRunner(dir));
    expect((await backend.snapshot()).generated?.untracked).not.toContain(
      "Library/",
    );

    await backend.ignoreUnityGenerated();
    const text = readFileSync(join(dir, ".gitignore"), "utf8");
    expect(
      text.startsWith("# Ours\r\nSecrets.txt\r\n/[Ll]ibrary/\r\n\r\n"),
    ).toBe(true);
    expect(text.match(/\/\[Ll\]ibrary\//g)).toHaveLength(1);
    expect(text).toContain("/[Tt]emp/\r\n");
    const snapshot = await backend.snapshot();
    expect(snapshot.generated).toBeUndefined();
    expect(snapshot.files.map((f) => f.path)).not.toContain("Secrets.txt");
  });

  it("finds a project one folder down, whether git knows it yet or not", async () => {
    const dir = makeRepo();
    write(dir, "README.md", "Our game\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Readme");
    unityProject(dir, "Game/");
    const backend = new CliBackend(nodeRunner(dir));

    // Not in git at all: one new folder.
    let snapshot = await backend.snapshot();
    expect(snapshot.generated?.untracked).toEqual([
      "Game/Assembly-CSharp.csproj",
      "Game/Library/",
      "Game/Logs/",
      "Game/Temp/",
      "Game/UserSettings/",
      "Game/kinetic.sln",
    ]);
    expect(snapshot.files.map((f) => f.path)).toContain(
      "Game/Assets/Art/Bark.png",
    );
    expect(snapshot.files.some((f) => f.path.includes("Library"))).toBe(false);

    // Part of it committed: its generated folders show up on their own.
    git(dir, "add", "Game/ProjectSettings");
    git(dir, "commit", "-q", "-m", "Settings");
    snapshot = await backend.snapshot();
    expect(snapshot.generated?.untracked).toContain("Game/Library/");

    expect(await backend.ignoreUnityGenerated()).toEqual(["Game/.gitignore"]);
    expect(existsSync(join(dir, ".gitignore"))).toBe(false);
    snapshot = await backend.snapshot();
    expect(snapshot.generated).toBeUndefined();
    expect(snapshot.files.map((f) => f.path)).toContain("Game/.gitignore");
  });

  it("stops tracking committed generated folders, keeping files and the selection", async () => {
    const dir = makeRepo();
    unityProject(dir);
    write(dir, "Assets/Old.txt", "old\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Everything");
    // Unity keeps changing Library; the artist changed and selected her own work.
    write(dir, "Library/ArtifactDB", new Uint8Array([9, 9]));
    write(dir, "Assets/Scenes/Forest.unity", "%YAML 1.1\nmine\n");
    write(dir, "Assets/Art/New.png", new Uint8Array([1, 2, 3]));
    git(dir, "add", "Assets/Scenes/Forest.unity", "Assets/Art/New.png");
    git(dir, "rm", "-q", "Assets/Old.txt");
    write(dir, "Assets/Scenes/Forest.unity", "%YAML 1.1\nmine\nand more\n");
    const selectedBefore = git(dir, "diff", "--cached", "--name-status");
    const indexBefore = git(dir, "ls-files", "--stage", "--", "Assets");
    const backend = new CliBackend(nodeRunner(dir));

    const snapshot = await backend.snapshot();
    expect(snapshot.generated).toEqual({
      untracked: [],
      tracked: [
        "Assembly-CSharp.csproj",
        "Library/",
        "Logs/",
        "Temp/",
        "UserSettings/",
        "kinetic.sln",
      ],
    });
    // What git tracks stays visible.
    expect(snapshot.files.map((f) => f.path)).toContain("Library/ArtifactDB");

    const commit = await backend.untrackUnityGenerated(
      message("Stop saving Unity's generated files"),
    );
    expect(commit.summary).toBe("Stop saving Unity's generated files");
    expect(
      lines(git(dir, "show", "--name-status", "--format=", "HEAD")),
    ).toEqual(
      expect.arrayContaining([
        "A\t.gitignore",
        "D\tLibrary/ArtifactDB",
        "D\tkinetic.sln",
      ]),
    );
    expect(git(dir, "show", "--name-only", "--format=", "HEAD")).not.toContain(
      "Assets/",
    );
    expect(git(dir, "ls-files")).not.toMatch(
      /Library|Temp|Logs|UserSettings|csproj|sln/,
    );
    // Files stay on disk, and the selection is exactly as it was.
    expect(readFileSync(join(dir, "Library/ArtifactDB"))).toEqual(
      Buffer.from([9, 9]),
    );
    expect(existsSync(join(dir, "Assembly-CSharp.csproj"))).toBe(true);
    expect(git(dir, "diff", "--cached", "--name-status")).toBe(selectedBefore);
    expect(git(dir, "ls-files", "--stage", "--", "Assets")).toBe(indexBefore);
    expect(git(dir, "diff", "--name-only")).toBe(
      "Assets/Scenes/Forest.unity\n",
    );

    const after = await backend.snapshot();
    expect(after.generated).toBeUndefined();
    expect(after.files.some((f) => f.path.startsWith("Library/"))).toBe(false);
  });

  it("puts everything back when the commit fails", async () => {
    const dir = makeRepo();
    unityProject(dir, "", 3);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Everything");
    write(dir, "Assets/Notes.txt", "notes\n");
    git(dir, "add", "Assets/Notes.txt");
    // A hook that refuses every commit.
    writeScript(
      dir,
      ".git/hooks/pre-commit",
      "#!/bin/sh\necho refused >&2\nexit 1\n",
    );
    const backend = new CliBackend(nodeRunner(dir));
    const head = git(dir, "rev-parse", "HEAD");

    await expect(
      backend.untrackUnityGenerated(message("Stop saving")),
    ).rejects.toThrow(/refused/);
    expect(git(dir, "rev-parse", "HEAD")).toBe(head);
    expect(git(dir, "ls-files")).toContain("Library/ArtifactDB");
    expect(git(dir, "diff", "--cached", "--name-only")).toBe(
      "Assets/Notes.txt\n",
    );
  });

  it("leaves projects that aren't Unity's alone", async () => {
    const dir = makeRepo();
    write(dir, "Library/Book.txt", "a\n");
    write(dir, "Temp/Draft.txt", "b\n");
    write(dir, "Tool.csproj", "<Project/>\n");
    const backend = new CliBackend(nodeRunner(dir));
    const snapshot = await backend.snapshot();
    expect(snapshot.generated).toBeUndefined();
    expect(snapshot.files.map((f) => f.path).sort()).toEqual([
      "Library/Book.txt",
      "Temp/Draft.txt",
      "Tool.csproj",
    ]);
    expect(await backend.ignoreUnityGenerated()).toEqual([]);
    await expect(
      backend.untrackUnityGenerated(message("Nothing")),
    ).rejects.toThrow(/Nothing Unity generates is committed/);
  });
});
