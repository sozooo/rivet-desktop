import { describe, expect, it } from "vitest";
import {
  GENERATED_FOLDER_NAMES,
  PROJECT_FILES,
  UNITY_GITIGNORE,
  isGenerated,
  withUnityIgnore,
} from "./gitignore";

const rules = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

describe("Unity .gitignore template", () => {
  it("is GitHub's template, with its source named, plus Rivet's additions", () => {
    expect(UNITY_GITIGNORE).toMatch(/^# Unity \.gitignore, added by Rivet/);
    expect(UNITY_GITIGNORE).toContain(
      "github.com/github/gitignore/blob/301e18631acc1a6f432099a965bbc021b68b0589/Unity.gitignore",
    );
    expect(rules(UNITY_GITIGNORE)).toEqual(
      expect.arrayContaining([
        "/[Ll]ibrary/",
        "/[Tt]emp/",
        "/[Uu]ser[Ss]ettings/",
        "*.csproj",
        "*.blend[0-9]",
      ]),
    );
    expect(UNITY_GITIGNORE).not.toContain("\r");
  });

  it("names the folders Unity makes for itself", () => {
    expect(GENERATED_FOLDER_NAMES).toEqual(
      expect.arrayContaining([
        "Library",
        "library",
        "Temp",
        "Obj",
        "Build",
        "Builds",
        "Logs",
        "UserSettings",
        "userSettings",
        "MemoryCaptures",
        ".vs",
      ]),
    );
    // Rules with wildcards have no single name.
    expect(GENERATED_FOLDER_NAMES.some((n) => n.includes("*"))).toBe(false);
  });

  it("only flags project files the template ignores", () => {
    for (const pattern of PROJECT_FILES)
      expect(rules(UNITY_GITIGNORE)).toContain(pattern);
  });

  it("tells generated folders and project files from the project's own", () => {
    expect(isGenerated("Library/")).toBe(true);
    expect(isGenerated("library/")).toBe(true);
    expect(isGenerated("Temp/")).toBe(true);
    expect(isGenerated("UserSettings/")).toBe(true);
    expect(isGenerated(".vs/")).toBe(true);
    expect(
      isGenerated("Kinetic_BackUpThisFolder_ButDontShipItWithYourGame/"),
    ).toBe(true);
    expect(isGenerated("Assembly-CSharp.csproj")).toBe(true);
    expect(isGenerated("kinetic.sln")).toBe(true);

    expect(isGenerated("Assets/")).toBe(false);
    expect(isGenerated("Packages/")).toBe(false);
    expect(isGenerated("ProjectSettings/")).toBe(false);
    // A file named like a folder, and folders further down, are not Unity's.
    expect(isGenerated("Library")).toBe(false);
    expect(isGenerated("Assets/Library/")).toBe(false);
    expect(isGenerated("Library/ArtifactDB")).toBe(false);
    expect(isGenerated("Assets/Tools.csproj")).toBe(false);
    expect(isGenerated("LibraryNotes/")).toBe(false);
  });
});

describe("withUnityIgnore", () => {
  it("writes the whole template where there is no .gitignore", () => {
    expect(withUnityIgnore("")).toBe(UNITY_GITIGNORE);
    expect(withUnityIgnore("\n\n")).toBe(UNITY_GITIGNORE);
  });

  it("adds only missing rules, under their comments, and keeps the file's own lines", () => {
    const current = "# Ours\n/[Ll]ibrary/\n/[Tt]emp/\nSecrets.txt";
    const next = withUnityIgnore(current);
    expect(next.startsWith(current + "\n\n# Added by Rivet")).toBe(true);
    const added = rules(next.slice(current.length));
    expect(added).not.toContain("/[Ll]ibrary/");
    expect(added).not.toContain("/[Tt]emp/");
    expect(added).toContain("/[Ll]ogs/");
    expect(added).toContain("*.csproj");
    expect(next).toContain("# Visual Studio cache directory\n.vs/");
    // Together they are the template's rules plus the file's own, each once.
    expect(new Set(rules(next))).toEqual(
      new Set([...rules(UNITY_GITIGNORE), "Secrets.txt"]),
    );
    expect(rules(next).length).toBe(new Set(rules(next)).size);
  });

  it("leaves a complete file alone and is stable when run again", () => {
    expect(withUnityIgnore(UNITY_GITIGNORE)).toBe(UNITY_GITIGNORE);
    const once = withUnityIgnore("Notes/\n");
    expect(withUnityIgnore(once)).toBe(once);
  });

  it("keeps Windows line endings and what the file un-ignores", () => {
    const next = withUnityIgnore("Notes/\r\n!*.csproj\r\n");
    expect(next.replace(/\r\n/g, "")).not.toContain("\n");
    expect(rules(next)).not.toContain("*.csproj");
    expect(rules(next)).toContain("/[Ll]ibrary/");
  });
});
