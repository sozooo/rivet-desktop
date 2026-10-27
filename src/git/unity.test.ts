import { describe, expect, it } from "vitest";
import type { FileChange } from "./types";
import {
  groupSelection,
  groupWithMeta,
  metaOnlyNote,
  primaryFile,
} from "./unity";

const file = (
  path: string,
  status: FileChange["status"] = "modified",
  staged = false,
): FileChange => ({
  path,
  status,
  hunks: [{ header: "@@ -1 +1 @@", lines: [], staged }],
});

describe("groupWithMeta", () => {
  it("shows an asset and its .meta as one row", () => {
    const groups = groupWithMeta([
      file("Assets/Hero.png", "added"),
      file("Assets/Hero.png.meta", "added"),
      file("Assets/Player.cs"),
    ]);
    expect(groups.map((g) => g.path)).toEqual([
      "Assets/Hero.png",
      "Assets/Player.cs",
    ]);
    expect(groups[0].meta?.path).toBe("Assets/Hero.png.meta");
    expect(groups[1].meta).toBeUndefined();
  });

  it("keeps a lone .meta as a row named after its asset", () => {
    const [texture, folder, removed] = groupWithMeta([
      file("Assets/Bark.png.meta"),
      file("Assets/Trees.meta", "added"),
      file("Assets/Old.meta", "deleted"),
    ]);
    expect(texture.path).toBe("Assets/Bark.png");
    expect(primaryFile(texture).path).toBe("Assets/Bark.png.meta");
    expect(metaOnlyNote(texture)).toBe("meta.importSettings");
    expect(metaOnlyNote(folder)).toBe("meta.newFolder");
    expect(metaOnlyNote(removed)).toBe("meta.folderRemoved");
  });

  it("combines the selection of both files", () => {
    const [group] = groupWithMeta([
      file("Assets/Hero.png", "added", true),
      file("Assets/Hero.png.meta", "added", false),
    ]);
    expect(groupSelection(group)).toBe("partial");
  });
});
