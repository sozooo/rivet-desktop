import { describe, expect, it, vi } from "vitest";
import { operations } from "../dialogs/operations";
import { MockBackend } from "../git/mock/MockBackend";
import {
  confirmRewrite,
  demoOpenApps,
  nothingOpen,
  openAppWarnings,
  type OpenApps,
} from "./openApps";

const open: OpenApps = {
  unity: ["Game/"],
  blender: [
    { path: "Art/Tree.blend", unsaved: true },
    { path: "Art/Rock.blend", unsaved: false },
  ],
};

describe("openAppWarnings", () => {
  it("names everything open when the files aren't known", () => {
    expect(openAppWarnings(open, null)).toEqual([
      { app: "unity", project: "Game/" },
      { app: "blender", path: "Art/Tree.blend", unsaved: true },
      { app: "blender", path: "Art/Rock.blend", unsaved: false },
    ]);
  });

  it("warns about Blender only for its own file", () => {
    expect(openAppWarnings(open, ["Art/Bark.png", "art/tree.BLEND"])).toEqual([
      { app: "blender", path: "Art/Tree.blend", unsaved: true },
    ]);
    expect(openAppWarnings(open, ["Art/Tree.blend1", "Art/Tree"])).toEqual([]);
  });

  it("warns about Unity for scenes and prefabs of its project", () => {
    const unity = (paths: string[]) =>
      openAppWarnings({ ...nothingOpen, unity: ["Game/"] }, paths);
    expect(unity(["Game/Assets/Scenes/Forest.unity"])).toEqual([
      { app: "unity", project: "Game/" },
    ]);
    expect(unity(["game/assets/Tree.Prefab"])).toHaveLength(1);
    // Textures, scripts and the like Unity reloads by itself.
    expect(unity(["Game/Assets/Bark.png", "Game/Assets/Player.cs"])).toEqual(
      [],
    );
    // A scene of another project, or of a folder named alike.
    expect(unity(["Tools/Assets/Main.unity", "Game2/Main.unity"])).toEqual([]);
    expect(unity([])).toEqual([]);
  });

  it("treats the repository's own folder as a project like any other", () => {
    const root = { ...nothingOpen, unity: [""] };
    expect(openAppWarnings(root, ["Assets/Scenes/Forest.unity"])).toEqual([
      { app: "unity", project: "" },
    ]);
    expect(openAppWarnings(root, ["README.md"])).toEqual([]);
  });
});

describe("confirmRewrite", () => {
  const ask = () => vi.fn(async () => true);

  it("goes ahead without a question when nothing is open", async () => {
    const question = ask();
    const rewrites = vi.fn(async () => null);
    expect(
      await confirmRewrite(async () => nothingOpen, rewrites, question),
    ).toBe(true);
    // Working out the files can take a fetch, so it waits until something is open.
    expect(rewrites).not.toHaveBeenCalled();
    expect(question).not.toHaveBeenCalled();
  });

  it("asks when an open file is rewritten, and does what the answer says", async () => {
    const no = vi.fn(async () => false);
    expect(await confirmRewrite(async () => open, ["Art/Rock.blend"], no)).toBe(
      false,
    );
    expect(no).toHaveBeenCalledWith([
      { app: "blender", path: "Art/Rock.blend", unsaved: false },
    ]);
    const yes = ask();
    expect(
      await confirmRewrite(
        async () => open,
        async () => ["Art/Rock.blend"],
        yes,
      ),
    ).toBe(true);
    expect(yes).toHaveBeenCalledOnce();
  });

  it("doesn't ask when the open files aren't touched", async () => {
    const question = ask();
    expect(
      await confirmRewrite(async () => open, ["Art/Bark.png"], question),
    ).toBe(true);
    expect(question).not.toHaveBeenCalled();
  });

  it("never blocks: failing to look means going ahead", async () => {
    const question = ask();
    const broken = async (): Promise<OpenApps> => {
      throw new Error("open_apps is not a command");
    };
    expect(await confirmRewrite(broken, null, question)).toBe(true);
    expect(question).not.toHaveBeenCalled();
  });

  it("names everything open when the files can't be worked out", async () => {
    const question = ask();
    const offline = async (): Promise<string[]> => {
      throw new Error("Could not resolve host: github.com");
    };
    await confirmRewrite(async () => open, offline, question);
    expect(question).toHaveBeenCalledWith(openAppWarnings(open, null));
  });
});

describe("operations that rewrite files", () => {
  it("say which files", async () => {
    const backend = new MockBackend("sample");
    const snapshot = await backend.snapshot();
    const context = {
      branch: "main",
      branches: ["main"],
      sync: snapshot.sync,
    };
    const file = snapshot.files[0];
    expect(
      await operations["discard-file"].rewrites!(
        backend,
        { ...context, file, extraPaths: [`${file.path}.meta`] },
        snapshot,
      ),
    ).toEqual([file.path, `${file.path}.meta`]);
    expect(
      await operations["restore-file"].rewrites!(
        backend,
        { ...context, restore: [{ path: "Art/Tree.blend", revision: "abc" }] },
        snapshot,
      ),
    ).toEqual(["Art/Tree.blend"]);
    expect(
      await operations["abort-operation"].rewrites!(backend, context, snapshot),
    ).toEqual(snapshot.files.map((f) => f.path));
    // The demo can't tell what a pull or a switch brings, so all of it counts.
    expect(
      await operations["switch-branch"].rewrites!(
        backend,
        { ...context, target: "develop" },
        snapshot,
      ),
    ).toBeNull();
  });

  it("leave alone what doesn't touch the files", () => {
    for (const id of [
      "push",
      "new-branch",
      "undo-commit",
      "drop-stash",
    ] as const)
      expect(operations[id].rewrites).toBeUndefined();
  });
});

describe("demoOpenApps", () => {
  it("pretends what the address asks for", () => {
    expect(demoOpenApps(null)).toEqual(nothingOpen);
    expect(demoOpenApps("unity").unity).toEqual([""]);
    expect(demoOpenApps("unity,blender").blender).toHaveLength(1);
  });
});
