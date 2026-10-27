import { describe, expect, it } from "vitest";
import { fileKind, isLfsDiff, lfsPointer } from "./fileKinds";
import type { Hunk } from "./types";

const kind = (path: string, binary?: boolean, hunks?: Hunk[]) =>
  fileKind({ path, binary, hunks });

const pointer = (oid: string, size: number) =>
  `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${size}\n`;
const oid = "4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393";

describe("fileKind", () => {
  it("keeps scripts and other text as code", () => {
    for (const path of [
      "Assets/Scripts/Player.cs",
      "Packages/manifest.json",
      "Assets/Shaders/Outline.shader",
      "Assets/Shaders/Common.hlsl",
      "Assets/Shaders/Lighting.cginc",
      "Assets/Compute/Blur.compute",
      "Assets/Game.asmdef",
      "Assets/Editor/Editor.asmref",
      "README.md",
      "notes.txt",
      ".github/workflows/ci.yml",
      "config.yaml",
      "Assets/UI/Menu.uxml",
      "Assets/UI/Menu.uss",
      "Assets/Data/levels.xml",
    ])
      expect(kind(path), path).toBe("code");
  });

  it("recognises Unity's own YAML files", () => {
    expect(kind("Assets/Scenes/Forest.unity")).toBe("scene");
    expect(kind("Assets/Prefabs/Tree.prefab")).toBe("scene");
    expect(kind("Assets/Materials/Bark.mat")).toBe("material");
    expect(kind("Assets/Textures/Bark.png.meta")).toBe("meta");
    for (const path of [
      "Assets/Settings/Renderer.asset",
      "Assets/Animations/Wave.anim",
      "Assets/Animations/Hero.controller",
      "Assets/Animations/Hero.overrideController",
      "Assets/Physics/Ice.physicMaterial",
      "Assets/Animations/Upper.mask",
      "Assets/Lighting/Day.lighting",
      "Assets/Timeline/Intro.playable",
      "Assets/Sprites/UI.spriteatlas",
      "Assets/Terrain/Grass.terrainlayer",
    ])
      expect(kind(path), path).toBe("unity-yaml");
  });

  it("recognises images and models whatever their case", () => {
    for (const ext of ["png", "jpg", "jpeg", "tga", "psd", "gif", "bmp"])
      expect(kind(`Assets/Art/Tex.${ext.toUpperCase()}`, true)).toBe("image");
    for (const ext of ["fbx", "obj", "gltf", "glb"])
      expect(kind(`Assets/Models/Hero@Run.${ext}`)).toBe("model");
  });

  it("respects Git's binary flag for everything else", () => {
    expect(kind("Assets/Audio/Wind.wav", true)).toBe("binary");
    expect(kind("Plugins/native.dll", true)).toBe("binary");
    expect(kind("Assets/Notes.txt", true)).toBe("binary");
    // A binary-serialized scene is still a scene; its preview reads the bytes.
    expect(kind("Assets/Scenes/Big.unity", true)).toBe("scene");
  });

  it("treats a diff of Git LFS pointers as a binary change", () => {
    const hunks: Hunk[] = [
      {
        header: "@@ -1,3 +1,3 @@",
        staged: false,
        lines: [
          {
            kind: "context",
            text: "version https://git-lfs.github.com/spec/v1",
          },
          { kind: "del", text: `oid sha256:${oid}` },
          { kind: "add", text: `oid sha256:${"a".repeat(64)}` },
          { kind: "del", text: "size 1200" },
          { kind: "add", text: "size 1300" },
        ],
      },
    ];
    expect(isLfsDiff(hunks)).toBe(true);
    expect(kind("Assets/Audio/Wind.wav", false, hunks)).toBe("binary");
    expect(
      isLfsDiff([
        {
          header: "@@ -1 +1 @@",
          staged: false,
          lines: [{ kind: "add", text: "size of the world" }],
        },
      ]),
    ).toBe(false);
  });
});

describe("lfsPointer", () => {
  const encode = (text: string) => new TextEncoder().encode(text);

  it("reads the object id and size of a pointer", () => {
    expect(lfsPointer(encode(pointer(oid, 52_428_800)))).toEqual({
      oid,
      size: 52_428_800,
    });
  });

  it("ignores real files and missing versions", () => {
    expect(lfsPointer(null)).toBeNull();
    expect(lfsPointer(encode("fileFormatVersion: 2\n"))).toBeNull();
    expect(lfsPointer(new Uint8Array(4096))).toBeNull();
  });
});
