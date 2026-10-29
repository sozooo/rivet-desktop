import { describe, expect, it } from "vitest";
import { conflictRevisions } from "./conflicts";
import {
  lfsPatterns,
  needsLfs,
  readAttributes,
  tooLarge,
  withSmartMerge,
} from "./lfs";
import type { FileChange, Operation } from "./types";

const file = (path: string, extra: Partial<FileChange> = {}): FileChange => ({
  path,
  status: "added",
  hunks: [],
  binary: true,
  ...extra,
});
const MB = 1024 * 1024;

describe("large files", () => {
  it("flags art and big files that would go in without LFS", () => {
    expect(needsLfs(file("Art/Rock.PNG"))).toBe(true);
    expect(needsLfs(file("Art/Rock.png", { lfs: true }))).toBe(false);
    expect(needsLfs(file("Art/Rock.png", { status: "deleted" }))).toBe(false);
    expect(needsLfs(file("Code.cs"))).toBe(false);
    expect(needsLfs(file("Data/navmesh.bytes", { size: 60 * MB }))).toBe(true);
  });

  it("knows what GitHub refuses", () => {
    expect(tooLarge(file("Video/Intro.mov", { size: 101 * MB }))).toBe(true);
    expect(tooLarge(file("Video/Intro.mov", { size: 99 * MB }))).toBe(false);
    expect(
      tooLarge(file("Video/Intro.mov", { size: 101 * MB, lfs: true })),
    ).toBe(false);
  });

  it("tracks the art set plus whatever else is too large", () => {
    const patterns = lfsPatterns([
      file("Data/navmesh.bytes", { size: 120 * MB }),
      file("Art/Big.psd", { size: 120 * MB }),
    ]);
    expect(patterns).toContain("*.fbx");
    expect(patterns).toContain("*.bytes");
    expect(patterns.filter((p) => p === "*.psd")).toHaveLength(1);
  });
});

describe(".gitattributes", () => {
  it("reads LFS and the scene merge driver", () => {
    expect(
      readAttributes(
        "# art\n*.psd filter=lfs diff=lfs merge=lfs -text\r\n*.unity merge=unityyamlmerge eol=lf\n",
      ),
    ).toEqual({ lfs: true, sceneDriver: "unityyamlmerge" });
    expect(readAttributes("")).toEqual({ lfs: false, sceneDriver: null });
  });

  it("adds Smart Merge lines only where no merge rule exists", () => {
    const text = withSmartMerge(
      "*.psd filter=lfs diff=lfs merge=lfs -text\r\n*.prefab merge=unity",
      "unity",
    );
    expect(text).toBe(
      "*.psd filter=lfs diff=lfs merge=lfs -text\r\n*.prefab merge=unity\r\n\r\n" +
        "# Unity Smart Merge: git merges scenes and prefabs with UnityYAMLMerge\r\n" +
        "*.unity merge=unity\r\n*.asset merge=unity\r\n*.mat merge=unity\r\n" +
        "*.anim merge=unity\r\n*.controller merge=unity\r\n",
    );
    expect(withSmartMerge(text, "unity")).toBe(text);
    expect(withSmartMerge("")).toMatch(
      /^# Unity Smart Merge.*\n\*\.unity merge=unityyamlmerge\n/,
    );
  });
});

describe("conflictRevisions", () => {
  const merge: Operation = {
    kind: "merge",
    message: "",
    mine: "HEAD",
    theirs: "MERGE_HEAD",
  };
  const open = file("Forest.unity", { conflict: { mine: true, theirs: true } });

  it("reads open conflicts from the index stages, swapped in a rebase", () => {
    expect(conflictRevisions(open, merge)).toEqual({
      before: ":2",
      after: ":3",
    });
    expect(
      conflictRevisions(open, {
        ...merge,
        kind: "rebase",
        mine: "REBASE_HEAD",
        theirs: "HEAD",
      }),
    ).toEqual({ before: ":3", after: ":2" });
  });

  it("reads resolved ones from the operation's commits", () => {
    const resolved = file("Forest.unity", {
      conflict: { mine: true, theirs: true, resolution: "mine" },
    });
    expect(conflictRevisions(resolved, merge)).toEqual({
      before: "HEAD",
      after: "MERGE_HEAD",
    });
  });
});
