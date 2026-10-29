// Sample Unity assets for the demo repository: a prefab, a material and an
// FBX model in two versions each. Textures are painted at runtime.

export const header = "%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n";

export const transform = (
  id: number,
  owner: number,
  father: number,
  children: number[],
  position: string,
  rotation = "{x: 0, y: 0, z: 0, w: 1}",
  scale = "{x: 1, y: 1, z: 1}",
) => `--- !u!4 &${id}
Transform:
  m_ObjectHideFlags: 0
  m_GameObject: {fileID: ${owner}}
  serializedVersion: 2
  m_LocalRotation: ${rotation}
  m_LocalPosition: ${position}
  m_LocalScale: ${scale}
  m_Children:${children.length ? children.map((c) => `\n  - {fileID: ${c}}`).join("") : " []"}
  m_Father: {fileID: ${father}}
`;

export const gameObject = (
  id: number,
  name: string,
  components: number[],
) => `--- !u!1 &${id}
GameObject:
  m_ObjectHideFlags: 0
  serializedVersion: 6
  m_Component:
${components.map((c) => `  - component: {fileID: ${c}}`).join("\n")}
  m_Layer: 0
  m_Name: ${name}
  m_TagString: Untagged
  m_IsActive: 1
`;

export const renderer = (
  id: number,
  owner: number,
  material: string,
  shadows: number,
) => `--- !u!23 &${id}
MeshRenderer:
  m_ObjectHideFlags: 0
  m_GameObject: {fileID: ${owner}}
  m_Enabled: 1
  m_CastShadows: ${shadows}
  m_Materials:
  - {fileID: 2100000, guid: ${material}, type: 2}
`;

const nest = (y: number) => `--- !u!1001 &900
PrefabInstance:
  m_ObjectHideFlags: 0
  serializedVersion: 2
  m_Modification:
    serializedVersion: 3
    m_TransformParent: {fileID: 402}
    m_Modifications:
    - target: {fileID: 400000, guid: 7e1d4c2b9a8f4e6d8c3b2a1f0e9d8c7b, type: 3}
      propertyPath: m_Name
      value: Nest
      objectReference: {fileID: 0}
    - target: {fileID: 400000, guid: 7e1d4c2b9a8f4e6d8c3b2a1f0e9d8c7b, type: 3}
      propertyPath: m_LocalPosition.y
      value: ${y}
      objectReference: {fileID: 0}
  m_SourcePrefab: {fileID: 100100000, guid: 7e1d4c2b9a8f4e6d8c3b2a1f0e9d8c7b, type: 3}
`;

export const guids = {
  barkMaterial: "1a2b3c4d5e6f40718293a4b5c6d7e8f9",
  mossyMaterial: "2b3c4d5e6f7041829304b5c6d7e8f901",
  barkTexture: "8c0f6e2d4b1a49c7a5e3d1f0b9c8a7e6",
  oldBarkTexture: "9d1e7f3a5c2b48d6b4f2e0a1c9d8b7f5",
  barkNormal: "3e5a7c9b1d2f40e6a8c0b2d4f6e8a0c2",
  urpLit: "933532a4fcc9baf4fa0491de14d08ed7",
  treePrefab: "7e1d4c2b9a8f4e6d8c3b2a1f0e9d8c7b",
  rockPrefab: "5f6a7b8c9d0e41f2a3b4c5d6e7f80912",
  playerScript: "6a7b8c9d0e1f42a3b4c5d6e7f8091a2b",
};

export const guidPaths: Record<string, string> = {
  [guids.barkMaterial]: "Assets/Materials/Bark.mat",
  [guids.mossyMaterial]: "Assets/Materials/BarkMossy.mat",
  [guids.barkTexture]: "Assets/Textures/Bark.png",
  [guids.oldBarkTexture]: "Assets/Textures/Bark_Old.png",
  [guids.barkNormal]: "Assets/Textures/Bark_Normal.png",
  [guids.treePrefab]: "Assets/Prefabs/Tree.prefab",
  [guids.rockPrefab]: "Assets/Prefabs/Rock_Big.prefab",
  [guids.playerScript]: "Assets/Scripts/PlayerController.cs",
};

export const treePrefab = {
  before:
    header +
    gameObject(100, "Tree", [400, 2300]) +
    transform(400, 100, 0, [401, 402], "{x: 0, y: 0, z: 0}") +
    renderer(2300, 100, guids.barkMaterial, 1) +
    gameObject(101, "Trunk", [401]) +
    transform(401, 101, 400, [], "{x: 0, y: 0, z: 0}") +
    gameObject(102, "Leaves", [402]) +
    transform(402, 102, 400, [], "{x: 0, y: 2, z: 0}") +
    nest(1.2),
  after:
    header +
    gameObject(100, "Tree", [400, 2300]) +
    transform(400, 100, 0, [401, 402], "{x: 0, y: 0, z: 0}") +
    renderer(2300, 100, guids.mossyMaterial, 0) +
    gameObject(101, "Trunk", [401]) +
    transform(
      401,
      101,
      400,
      [],
      "{x: 0, y: 0, z: 0}",
      "{x: 0, y: 0.13052619, z: 0, w: 0.9914449}",
    ) +
    gameObject(102, "Leaves", [402]) +
    transform(
      402,
      102,
      400,
      [403],
      "{x: 0, y: 2.5, z: 0}",
      undefined,
      "{x: 1.2, y: 1.2, z: 1.2}",
    ) +
    gameObject(103, "Bird", [403]) +
    transform(403, 103, 402, [], "{x: 0.4, y: 0.9, z: 0}") +
    nest(1.5),
};

const material = (
  color: string,
  smoothness: number,
  baseMap: string,
  normal?: string,
) => `${header}--- !u!21 &2100000
Material:
  serializedVersion: 8
  m_ObjectHideFlags: 0
  m_Name: Bark
  m_Shader: {fileID: 4800000, guid: ${guids.urpLit}, type: 3}
  m_ValidKeywords: []
  m_SavedProperties:
    serializedVersion: 3
    m_TexEnvs:
    - _BaseMap:
        m_Texture: {fileID: 2800000, guid: ${baseMap}, type: 3}
        m_Scale: {x: 1, y: 1}
        m_Offset: {x: 0, y: 0}
    - _BumpMap:
        m_Texture: {fileID: ${normal ? `2800000, guid: ${normal}, type: 3` : "0"}}
        m_Scale: {x: 1, y: 1}
        m_Offset: {x: 0, y: 0}
    m_Ints: []
    m_Floats:
    - _Metallic: 0
    - _Smoothness: ${smoothness}
    - _Cutoff: 0.5
    m_Colors:
    - _BaseColor: ${color}
    - _EmissionColor: {r: 0, g: 0, b: 0, a: 1}
`;

export const barkMaterial = {
  before: material(
    "{r: 0.55, g: 0.42, b: 0.3, a: 1}",
    0.2,
    guids.oldBarkTexture,
  ),
  after: material(
    "{r: 0.47, g: 0.52, b: 0.33, a: 1}",
    0.35,
    guids.barkTexture,
    guids.barkNormal,
  ),
};

type Box = {
  name: string;
  size: [number, number, number];
  offset: [number, number, number];
};

/** A small ASCII FBX 7.4 file: boxes, a material and, optionally, a spin animation. */
export function makeFbx(boxes: Box[], spin: boolean) {
  const nodes: string[] = [];
  const links: string[] = [];
  boxes.forEach((box, i) => {
    const [sx, sy, sz] = box.size.map((s) => s / 2);
    const [ox, oy, oz] = box.offset;
    const corners = [
      [-sx, -sy, -sz],
      [sx, -sy, -sz],
      [sx, sy, -sz],
      [-sx, sy, -sz],
      [-sx, -sy, sz],
      [sx, -sy, sz],
      [sx, sy, sz],
      [-sx, sy, sz],
    ].flatMap(([x, y, z]) => [x + ox, y + oy, z + oz]);
    const faces = [
      [4, 5, 6, 7],
      [1, 0, 3, 2],
      [0, 4, 7, 3],
      [5, 1, 2, 6],
      [7, 6, 2, 3],
      [0, 1, 5, 4],
    ].flatMap((f) => [f[0], f[1], f[2], -f[3] - 1]);
    const geometry = 1000 + i,
      model = 2000 + i;
    nodes.push(`	Geometry: ${geometry}, "Geometry::${box.name}", "Mesh" {
		Vertices: *${corners.length} {
			a: ${corners.join(",")}
		}
		PolygonVertexIndex: *${faces.length} {
			a: ${faces.join(",")}
		}
		GeometryVersion: 124
	}
	Model: ${model}, "Model::${box.name}", "Mesh" {
		Version: 232
		Properties70:  {
			P: "Lcl Translation", "Lcl Translation", "", "A",0,0,0
		}
		Shading: T
		Culling: "CullingOff"
	}`);
    links.push(
      `	C: "OO",${model},0`,
      `	C: "OO",${geometry},${model}`,
      `	C: "OO",3000,${model}`,
    );
  });
  nodes.push(`	Material: 3000, "Material::Wood", "" {
		Version: 102
		ShadingModel: "phong"
		Properties70:  {
			P: "DiffuseColor", "Color", "", "A",0.62,0.45,0.28
		}
	}`);
  if (spin) {
    const second = 46186158000;
    nodes.push(`	AnimationStack: 4000, "AnimStack::Spin", "" {
		Properties70:  {
			P: "LocalStop", "KTime", "Time", "",${second}
			P: "ReferenceStop", "KTime", "Time", "",${second}
		}
	}
	AnimationLayer: 5000, "AnimLayer::BaseLayer", "" {
	}
	AnimationCurveNode: 6000, "AnimCurveNode::R", "" {
		Properties70:  {
			P: "d|X", "Number", "", "A",0
			P: "d|Y", "Number", "", "A",0
			P: "d|Z", "Number", "", "A",0
		}
	}
	AnimationCurve: 7000, "AnimCurve::", "" {
		Default: 0
		KeyVer: 4009
		KeyTime: *5 {
			a: ${[0, 1, 2, 3, 4].map((q) => (second / 4) * q).join(",")}
		}
		KeyValueFloat: *5 {
			a: 0,90,180,270,360
		}
		KeyAttrFlags: *1 {
			a: 24836
		}
		KeyAttrDataFloat: *4 {
			a: 0,0,218434821,0
		}
		KeyAttrRefCount: *1 {
			a: 5
		}
	}`);
    links.push(
      `	C: "OO",5000,4000`,
      `	C: "OO",6000,5000`,
      `	C: "OP",6000,2000, "Lcl Rotation"`,
      `	C: "OP",7000,6000, "d|Y"`,
    );
  }
  return fbxDocument(nodes, links);
}

/** An ASCII FBX 7.4 file around the given objects and connections. */
export function fbxDocument(nodes: string[], links: string[]) {
  return `; FBX 7.4.0 project file
FBXHeaderExtension:  {
	FBXHeaderVersion: 1003
	FBXVersion: 7400
	Creator: "Rivet demo"
}
GlobalSettings:  {
	Version: 1000
	Properties70:  {
		P: "UpAxis", "int", "Integer", "",1
		P: "UpAxisSign", "int", "Integer", "",1
		P: "FrontAxis", "int", "Integer", "",2
		P: "FrontAxisSign", "int", "Integer", "",1
		P: "CoordAxis", "int", "Integer", "",0
		P: "CoordAxisSign", "int", "Integer", "",1
		P: "UnitScaleFactor", "double", "Number", "",1
	}
}
Objects:  {
${nodes.join("\n")}
}
Connections:  {
${links.join("\n")}
}
`;
}

export const crateModel = {
  before: makeFbx(
    [{ name: "Crate", size: [1, 1, 1], offset: [0, 0.5, 0] }],
    false,
  ),
  after: makeFbx(
    [
      { name: "Crate", size: [1.2, 0.9, 1.2], offset: [0, 0.45, 0] },
      { name: "Lid", size: [1.3, 0.12, 1.3], offset: [0, 0.96, 0] },
    ],
    true,
  ),
};

/** Paints a bark-like texture; the newer version is mossier, a teammate's snowy. */
export async function paintBark(
  mossy: boolean,
  snowy = false,
): Promise<Uint8Array | null> {
  if (typeof OffscreenCanvas === "undefined") return null;
  const size = 128;
  const canvas = new OffscreenCanvas(size, size);
  const g = canvas.getContext("2d")!;
  g.fillStyle = mossy ? "#6b6a3f" : "#6e4a2f";
  g.fillRect(0, 0, size, size);
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const x = random() * size;
    g.strokeStyle = `rgba(${mossy ? "40, 52, 24" : "48, 30, 18"}, ${0.25 + random() * 0.5})`;
    g.lineWidth = 1 + random() * 3;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(
      x + random() * 10 - 5,
      size / 3,
      x + random() * 10 - 5,
      (2 * size) / 3,
      x,
      size,
    );
    g.stroke();
  }
  if (mossy)
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${110 + random() * 40}, ${150 + random() * 50}, 70, 0.55)`;
      g.beginPath();
      g.arc(random() * size, random() * size, 3 + random() * 9, 0, Math.PI * 2);
      g.fill();
    }
  if (snowy)
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(236, 242, 248, ${0.45 + random() * 0.5})`;
      g.beginPath();
      g.arc(
        random() * size,
        random() * size * 0.55,
        0.8 + random() * 2.2,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}
