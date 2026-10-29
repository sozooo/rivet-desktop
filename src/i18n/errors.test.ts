import { describe, expect, it } from "vitest";
import { explainError } from "./errors";

describe("explainError", () => {
  it("names the files a pull would overwrite", () => {
    const message =
      "error: Your local changes to the following files would be overwritten by merge:\n\tAssets/Textures/Bark.png\n\tAssets/Scenes/Forest.unity\nPlease commit your changes or stash them before you merge.\nAborting";
    expect(explainError(message)).toEqual({
      key: "error.localChanges",
      params: { files: "Bark.png, Forest.unity" },
    });
    expect(
      explainError(
        "error: The following untracked working tree files would be overwritten by merge:\n\tA.png\n\tB.png\n\tC.png\n\tD.png\nPlease move or remove them before you merge.",
      )?.params,
    ).toEqual({ files: "A.png, B.png, C.png, …" });
  });

  it("tells a branch switch apart from a pull", () => {
    expect(
      explainError(
        "error: Your local changes to the following files would be overwritten by checkout:\n\tForest.txt\nPlease commit your changes or stash them before you switch branches.\nAborting",
      ),
    ).toEqual({ key: "error.switchChanges", params: { files: "Forest.txt" } });
  });

  it("explains a missing git-lfs and leftover conflict markers", () => {
    expect(
      explainError("git: 'lfs' is not a git command. See 'git --help'.")?.key,
    ).toBe("lfs.missing");
    expect(
      explainError(
        "Assets/Player.cs still has conflict markers (<<<<<<< or >>>>>>>).",
      )?.key,
    ).toBe("conflict.markers");
    expect(explainError("fatal: unable to access 'https://…'")).toBeNull();
  });
});
