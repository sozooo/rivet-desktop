import { describe, expect, it } from "vitest";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  barkMaterial,
  crateModel,
  guids,
  treePrefab,
} from "../git/mock/assets";
import { diffMaterials, parseMaterial } from "./material";
import { diffScenes } from "./scene";
import { parseUnityYaml, parseYamlBlock } from "./yaml";

describe("parseUnityYaml", () => {
  it("reads documents, flow mappings and sequences at the key's indentation", () => {
    const [object, transform] = parseUnityYaml(treePrefab.before);
    expect(object).toMatchObject({
      classId: 1,
      fileId: "100",
      type: "GameObject",
    });
    expect(object.data.m_Name).toBe("Tree");
    expect(object.data.m_Component).toEqual([
      { component: { fileID: "400" } },
      { component: { fileID: "2300" } },
    ]);
    expect(transform.data.m_LocalPosition).toEqual({ x: "0", y: "0", z: "0" });
  });

  it("survives odd lines and stripped documents", () => {
    const docs = parseUnityYaml(`--- !u!1 &5 stripped
GameObject:
  m_PrefabInstance: {fileID: 9}
--- !u!114 &6
MonoBehaviour:
  m_Text: "Hello: world"
  m_Lines: 'first
    second'
  m_List: [1, 2]
`);
    expect(docs[0].stripped).toBe(true);
    expect(docs[1].data.m_Text).toBe("Hello: world");
    expect(docs[1].data.m_List).toEqual(["1", "2"]);
  });

  it("parses nested sequences of mappings", () => {
    const block = parseYamlBlock(`root:
  items:
  - name: a
    value: 1
  - name: b
    value: 2
  after: x`);
    expect(block).toEqual({
      root: {
        items: [
          { name: "a", value: "1" },
          { name: "b", value: "2" },
        ],
        after: "x",
      },
    });
  });
});

describe("diffScenes", () => {
  it("describes prefab changes in terms of objects", () => {
    const changes = diffScenes(treePrefab.before, treePrefab.after);
    expect(changes).toContainEqual({
      kind: "added",
      path: "Tree/Leaves/Bird",
      parent: "Tree/Leaves",
    });
    expect(changes).toContainEqual({
      kind: "position",
      path: "Tree/Leaves",
      before: [0, 2, 0],
      after: [0, 2.5, 0],
    });
    expect(changes).toContainEqual({
      kind: "scale",
      path: "Tree/Leaves",
      before: [1, 1, 1],
      after: [1.2, 1.2, 1.2],
    });
    expect(changes).toContainEqual({
      kind: "rotation",
      path: "Tree/Trunk",
      before: [0, 0, 0],
      after: [0, 15, 0],
    });
    expect(changes).toContainEqual({
      kind: "component-changed",
      path: "Tree",
      component: "MeshRenderer",
      fields: ["m_CastShadows", "m_Materials"],
    });
    expect(changes).toContainEqual({
      kind: "override",
      path: "Tree/Leaves/Nest",
      property: "m_LocalPosition.y",
      before: "1.2",
      after: "1.5",
    });
  });

  it("treats a new file as everything added", () => {
    const changes = diffScenes(null, treePrefab.before);
    expect(
      changes.filter((c) => c.kind === "added").map((c) => c.path),
    ).toEqual(["Tree", "Tree/Trunk", "Tree/Leaves"]);
  });
});

describe("materials", () => {
  it("lists color, number and texture changes", () => {
    const changes = diffMaterials(
      parseMaterial(barkMaterial.before),
      parseMaterial(barkMaterial.after),
    );
    expect(changes).toEqual([
      {
        kind: "color",
        name: "_BaseColor",
        before: { r: 0.55, g: 0.42, b: 0.3, a: 1 },
        after: { r: 0.47, g: 0.52, b: 0.33, a: 1 },
      },
      { kind: "float", name: "_Smoothness", before: 0.2, after: 0.35 },
      {
        kind: "texture",
        name: "_BaseMap",
        before: guids.oldBarkTexture,
        after: guids.barkTexture,
      },
      {
        kind: "texture",
        name: "_BumpMap",
        before: null,
        after: guids.barkNormal,
      },
    ]);
  });
});

describe("sample FBX", () => {
  it("loads in three.js with meshes and an animation clip", () => {
    const loader = new FBXLoader();
    const before = loader.parse(
      new TextEncoder().encode(crateModel.before).buffer,
      "",
    );
    const after = loader.parse(
      new TextEncoder().encode(crateModel.after).buffer,
      "",
    );
    const meshes = (root: typeof before) => {
      const names: string[] = [];
      root.traverse((o) => "isMesh" in o && names.push(o.name));
      return names;
    };
    expect(meshes(before)).toEqual(["Crate"]);
    expect(meshes(after)).toEqual(["Crate", "Lid"]);
    expect(before.animations).toHaveLength(0);
    expect(after.animations.map((a) => [a.name, a.duration])).toEqual([
      ["Spin", 1],
    ]);
  });
});
