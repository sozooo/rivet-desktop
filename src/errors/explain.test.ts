import { describe, expect, it } from "vitest";
import { explainError } from "./explain";
import { errorSamples } from "./samples";

describe("explainError", () => {
  it.each(errorSamples.map((s) => [s.id, s.key, s.stderr] as const))(
    "%s → %s",
    (_, key, stderr) => {
      expect(explainError(stderr)?.key ?? null).toBe(key);
    },
  );

  it("names the files a pull would overwrite", () => {
    const sample = errorSamples.find((s) => s.id === "local-changes")!;
    expect(explainError(sample.stderr)?.params).toEqual({
      files: "Bark.png, Forest.unity",
    });
    expect(
      explainError(
        "error: The following untracked working tree files would be overwritten by merge:\n\tA.png\n\tB.png\n\tC.png\n\tD.png\nPlease move or remove them before you merge.",
      )?.params,
    ).toEqual({ files: "A.png, B.png, C.png, …" });
  });

  it("names the busy file, the large file and the folder to trust", () => {
    const params = (id: string) =>
      explainError(errorSamples.find((s) => s.id === id)!.stderr)?.params;
    expect(params("file-busy")).toEqual({ file: "kinetic_physics.dll" });
    expect(params("file-busy-pull")).toEqual({ file: "Forest.unity" });
    expect(params("file-busy-add")).toEqual({ file: "Bark.psd" });
    expect(params("too-large")).toEqual({ files: "Intro.mov" });
    expect(params("dubious-ownership")).toEqual({
      path: "E:/Projects/kinetic",
    });
    expect(params("destination-exists")).toEqual({ name: "kinetic" });
  });

  it("suggests what to do next", () => {
    const action = (id: string) =>
      explainError(errorSamples.find((s) => s.id === id)!.stderr)?.action;
    expect(action("push-rejected")).toBe("sync");
    expect(action("offline")).toBe("retry");
    expect(action("index-lock")).toBe("retry");
    expect(action("file-busy")).toBe("retry");
    expect(action("auth")).toBe("signIn");
    expect(action("identity")).toBe("identity");
    expect(action("git-missing")).toBe("installGit");
    expect(action("dubious-ownership")).toBe("trust");
    expect(action("not-repository")).toBeUndefined();
  });

  it("falls back to wording without a name it couldn't read", () => {
    expect(
      explainError(
        "remote: error: GH001: Large files detected. You may want to try Git Large File Storage.",
      ),
    ).toEqual({ key: "error.tooLargeAny" });
  });
});
