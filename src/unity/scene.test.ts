import { describe, expect, it } from "vitest";
import { guids } from "../git/mock/assets";
import { diffScenes, parseScene, sceneGuids } from "./scene";

const tree = "7e1d4c2b9a8f4e6d8c3b2a1f0e9d8c7b";

const override = (fileId: number, path: string, value: string | number) =>
  `    - target: {fileID: ${fileId}, guid: ${tree}, type: 3}
      propertyPath: ${path}
      value: ${value}
      objectReference: {fileID: 0}`;

/** A small scene: a folder object, one placed prefab, and something Unity may add one day. */
function forest(after: boolean) {
  const position = after ? [2, 0, 5] : [0, 0, 0];
  return `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!104 &2
RenderSettings:
  m_ObjectHideFlags: 0
  serializedVersion: 9
  m_Fog: ${after ? 1 : 0}
  m_FogColor: {r: 0.5, g: 0.5, b: 0.5, a: 1}
--- !u!1 &10
GameObject:
  m_ObjectHideFlags: 0
  serializedVersion: 6
  m_Component:
  - component: {fileID: 11}
  m_Layer: 0
  m_Name: Environment
  m_TagString: ${after ? "EditorOnly" : "Untagged"}
  m_IsActive: 1
--- !u!4 &11
Transform:
  m_ObjectHideFlags: 0
  m_GameObject: {fileID: 10}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 0, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_Children: []
  m_Father: {fileID: 0}
--- !u!1001 &50
PrefabInstance:
  m_ObjectHideFlags: 0
  serializedVersion: 2
  m_Modification:
    serializedVersion: 3
    m_TransformParent: {fileID: 11}
    m_Modifications:
${override(400, "m_RootOrder", after ? 1 : 0)}
${["x", "y", "z"].map((axis, i) => override(400, `m_LocalPosition.${axis}`, position[i])).join("\n")}
${["x", "y", "z", "w"].map((axis) => override(400, `m_LocalRotation.${axis}`, axis === "w" ? 1 : 0)).join("\n")}
${["x", "y", "z"].map((axis) => override(400, `m_LocalEulerAnglesHint.${axis}`, 0)).join("\n")}
    - target: {fileID: 2300, guid: ${tree}, type: 3}
      propertyPath: m_Materials.Array.data[0]
      value:
      objectReference: {fileID: 2100000, guid: ${after ? guids.mossyMaterial : guids.barkMaterial}, type: 2}
    m_RemovedComponents: []
  m_SourcePrefab: {fileID: 100100000, guid: ${tree}, type: 3}
--- !u!4 &51 stripped
Transform:
  m_CorrespondingSourceObject: {fileID: 400, guid: ${tree}, type: 3}
  m_PrefabInstance: {fileID: 50}
  m_PrefabAsset: {fileID: 0}
--- !u!1 &52 stripped
GameObject:
  m_CorrespondingSourceObject: {fileID: 100, guid: ${tree}, type: 3}
  m_PrefabInstance: {fileID: 50}
  m_PrefabAsset: {fileID: 0}
--- !u!987654 &90
SomethingFromTheFuture:
  m_Weird: [unclosed
  - stray item
    : odd
${after ? birdAndSound : light}`;
}

const birdAndSound = `--- !u!1 &60
GameObject:
  m_Component:
  - component: {fileID: 61}
  m_Name: Bird
  m_IsActive: 1
--- !u!4 &61
Transform:
  m_GameObject: {fileID: 60}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 3, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_Father: {fileID: 51}
--- !u!82 &70
AudioSource:
  m_GameObject: {fileID: 52}
  m_Enabled: 1
`;

const light = `--- !u!1 &80
GameObject:
  m_Component:
  - component: {fileID: 81}
  m_Name: Light_2
  m_IsActive: 1
--- !u!4 &81
Transform:
  m_GameObject: {fileID: 80}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 4, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_Father: {fileID: 11}
`;

describe("scene diff", () => {
  it("reads placed prefabs, what was added to them, and scene settings", () => {
    const assets = new Map([[tree, "Assets/Prefabs/Tree_03.prefab"]]);
    expect(diffScenes(forest(false), forest(true), assets)).toEqual([
      {
        kind: "fields",
        path: "Environment",
        fields: [
          {
            name: "m_TagString",
            values: {
              before: { text: "Untagged" },
              after: { text: "EditorOnly" },
            },
          },
        ],
      },
      {
        kind: "position",
        path: "Environment/Tree_03",
        before: [0, 0, 0],
        after: [2, 0, 5],
      },
      {
        kind: "component-added",
        path: "Environment/Tree_03",
        component: "AudioSource",
      },
      {
        kind: "override",
        path: "Environment/Tree_03",
        property: "m_Materials.Array.data[0]",
        before: { asset: guids.barkMaterial },
        after: { asset: guids.mossyMaterial },
      },
      {
        kind: "added",
        path: "Environment/Tree_03/Bird",
        parent: "Environment/Tree_03",
        prefab: false,
      },
      {
        kind: "removed",
        path: "Environment/Light_2",
        parent: "Environment",
        prefab: false,
      },
      {
        kind: "settings",
        path: "Render Settings",
        fields: [
          {
            name: "m_Fog",
            values: { before: { text: "0" }, after: { text: "1" } },
          },
        ],
      },
    ]);
  });

  it("calls a placed prefab by its file once the GUID is resolved", () => {
    expect(diffScenes(null, forest(false))).toContainEqual({
      kind: "added",
      path: "Environment/Prefab",
      parent: "Environment",
      prefab: true,
    });
    expect(sceneGuids(parseScene(forest(true)))).toEqual(new Set([tree]));
  });

  it("names objects that references point to in the same file", () => {
    const camera = (target: number) => `--- !u!1 &1
GameObject:
  m_Component:
  - component: {fileID: 2}
  - component: {fileID: 3}
  m_Name: Rig
--- !u!4 &2
Transform:
  m_GameObject: {fileID: 1}
  m_Father: {fileID: 0}
--- !u!114 &3
MonoBehaviour:
  m_GameObject: {fileID: 1}
  m_Script: {fileID: 11500000, guid: ${guids.barkTexture}, type: 3}
  target: {fileID: ${target}}
--- !u!1 &10
GameObject:
  m_Component:
  - component: {fileID: 11}
  m_Name: Hero
--- !u!4 &11
Transform:
  m_GameObject: {fileID: 10}
  m_Father: {fileID: 0}
`;
    const assets = new Map([[guids.barkTexture, "Assets/Scripts/Follow.cs"]]);
    expect(diffScenes(camera(0), camera(11), assets)).toEqual([
      {
        kind: "fields",
        path: "Rig",
        component: "Follow",
        fields: [
          {
            name: "target",
            values: { before: null, after: { object: "Hero" } },
          },
        ],
      },
    ]);
  });
});
