import { describe, expect, it } from "vitest";
import {
  conflictPaths,
  largeBlobs,
  parseCheckAttr,
  parseDiff,
  parseStages,
  parseStatus,
} from "./parse";

const zero = "0".repeat(40);

describe("parseStatus", () => {
  it("tells which sides of a conflict still have the file", () => {
    const status = parseStatus(
      [
        `u UU N... 100644 100644 100644 100644 ${"a".repeat(40)} ${"b".repeat(40)} ${"c".repeat(40)} Assets/Forest.unity`,
        `u DU N... 100644 000000 100644 100644 ${"a".repeat(40)} ${zero} ${"c".repeat(40)} Art/Old tree.png`,
        `u UD N... 100644 100644 000000 100644 ${"a".repeat(40)} ${"b".repeat(40)} ${zero} Notes.txt`,
        "",
      ].join("\0"),
    );
    expect(status.entries.map((e) => [e.path, e.conflicted, e.stages])).toEqual(
      [
        ["Assets/Forest.unity", true, { ours: true, theirs: true }],
        ["Art/Old tree.png", true, { ours: false, theirs: true }],
        ["Notes.txt", true, { ours: true, theirs: false }],
      ],
    );
  });
});

describe("parseDiff", () => {
  it("skips combined diffs of conflicted files", () => {
    const files = parseDiff(
      [
        "diff --git a/A.txt b/A.txt",
        "--- a/A.txt",
        "+++ b/A.txt",
        "@@ -1 +1 @@",
        "-old",
        "+new",
        "diff --cc T.txt",
        "index 0d4c8f3,8948000..0000000",
        "--- a/T.txt",
        "+++ b/T.txt",
        "@@@ -1,3 -1,3 +1,7 @@@",
        "++<<<<<<< HEAD",
        " +MINE",
        "* Unmerged path D.txt",
        "",
      ].join("\n"),
    );
    expect(files).toHaveLength(1);
    expect(files[0].hunks).toHaveLength(1);
    expect(files[0].hunks[0].lines).toEqual([
      { kind: "del", text: "old" },
      { kind: "add", text: "new" },
    ]);
  });
});

describe("conflict helpers", () => {
  it("reads index stages by path", () => {
    const stages = parseStages(
      [
        `100644 ${"a".repeat(40)} 1\tArt/Hero tree.png`,
        `100644 ${"b".repeat(40)} 2\tArt/Hero tree.png`,
        `100644 ${"c".repeat(40)} 0\tNotes.txt`,
        "",
      ].join("\0"),
    );
    expect([...stages.get("Art/Hero tree.png")!]).toEqual([
      [1, "a".repeat(40)],
      [2, "b".repeat(40)],
    ]);
    expect(stages.get("Notes.txt")?.get(0)).toBe("c".repeat(40));
  });

  it("finds the files git listed as conflicts in MERGE_MSG", () => {
    const message =
      "Merge branch 'main' of github.com:team/game\n\n# Conflicts:\n#\tAssets/Forest.unity\n#\tТекстуры/кора.png\n";
    expect(conflictPaths(message)).toEqual([
      "Assets/Forest.unity",
      "Текстуры/кора.png",
    ]);
    expect(conflictPaths("Merge branch 'main'\n")).toEqual([]);
  });

  it("reads git check-attr output", () => {
    const values = parseCheckAttr(
      "Art/Rock.png\0filter\0lfs\0Code.cs\0filter\0unspecified\0",
    );
    expect(values.get("Art/Rock.png")).toEqual({ filter: "lfs" });
    expect(values.get("Code.cs")).toEqual({ filter: "unspecified" });
  });

  it("finds blobs over a size limit", () => {
    const out = [
      "commit 250 ",
      "tree 120 ",
      "blob 104857601 Video/Intro.mov",
      "blob 12 Notes.txt",
      "blob 104857700 Video/Intro.mov",
    ].join("\n");
    expect(largeBlobs(out, 100 * 1024 * 1024)).toEqual([
      { path: "Video/Intro.mov", size: 104857700 },
    ]);
  });
});
