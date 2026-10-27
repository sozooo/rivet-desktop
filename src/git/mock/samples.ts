// More sample art for the demo repository: a scene, import settings, an
// animation with only a skeleton, and the files previews must cope with:
// TGA, Photoshop, Git LFS pointers, binary data.
import { fbxDocument, gameObject, guids, header, transform } from "./assets";

type Vec = [number, number, number];

const prefabInstance = (
  id: number,
  source: string,
  parent: number,
  position: Vec,
  options: { name?: string; material?: string } = {},
) => {
  const target = `{fileID: 400000, guid: ${source}, type: 3}`;
  const set = (path: string, value: string | number) => `    - target: ${target}
      propertyPath: ${path}
      value: ${value}
      objectReference: {fileID: 0}`;
  const changes = [
    ...(options.name ? [set("m_Name", options.name)] : []),
    set("m_RootOrder", 0),
    ...["x", "y", "z"].map((a, i) => set(`m_LocalPosition.${a}`, position[i])),
    ...["x", "y", "z", "w"].map((a) =>
      set(`m_LocalRotation.${a}`, a === "w" ? 1 : 0),
    ),
    ...["x", "y", "z"].map((a) => set(`m_LocalEulerAnglesHint.${a}`, 0)),
    ...(options.material
      ? [
          `    - target: {fileID: 2300000, guid: ${source}, type: 3}
      propertyPath: m_Materials.Array.data[0]
      value:
      objectReference: {fileID: 2100000, guid: ${options.material}, type: 2}`,
        ]
      : []),
  ];
  return `--- !u!1001 &${id}
PrefabInstance:
  m_ObjectHideFlags: 0
  serializedVersion: 2
  m_Modification:
    serializedVersion: 3
    m_TransformParent: {fileID: ${parent}}
    m_Modifications:
${changes.join("\n")}
    m_RemovedComponents: []
  m_SourcePrefab: {fileID: 100100000, guid: ${source}, type: 3}
--- !u!4 &${id + 1} stripped
Transform:
  m_CorrespondingSourceObject: ${target}
  m_PrefabInstance: {fileID: ${id}}
  m_PrefabAsset: {fileID: 0}
`;
};

const light = (id: number, owner: number, type: number, intensity: number) =>
  `--- !u!108 &${id}
Light:
  m_ObjectHideFlags: 0
  m_GameObject: {fileID: ${owner}}
  m_Enabled: 1
  serializedVersion: 10
  m_Type: ${type}
  m_Color: {r: 1, g: 0.95686275, b: 0.8392157, a: 1}
  m_Intensity: ${intensity}
  m_Range: 10
`;

const camera = (id: number, owner: number) => `--- !u!20 &${id}
Camera:
  m_ObjectHideFlags: 0
  m_GameObject: {fileID: ${owner}}
  m_Enabled: 1
  m_ClearFlags: 1
  m_BackGroundColor: {r: 0.19215687, g: 0.3019608, b: 0.4745098, a: 0}
  field of view: 60
`;

const playerController = (id: number, owner: number, speed: number) =>
  `--- !u!114 &${id}
MonoBehaviour:
  m_ObjectHideFlags: 0
  m_GameObject: {fileID: ${owner}}
  m_Enabled: 1
  m_EditorHideFlags: 0
  m_Script: {fileID: 11500000, guid: ${guids.playerScript}, type: 3}
  m_Name:
  m_EditorClassIdentifier:
  moveSpeed: ${speed}
  jumpHeight: 1.2
`;

const renderSettings = (fog: boolean) => `--- !u!104 &2
RenderSettings:
  m_ObjectHideFlags: 0
  serializedVersion: 9
  m_Fog: ${fog ? 1 : 0}
  m_FogColor: {r: ${fog ? "0.62, g: 0.7, b: 0.66" : "0.5, g: 0.5, b: 0.5"}, a: 1}
  m_FogMode: 3
  m_FogDensity: 0.01
`;

/** The forest level: trees placed from a prefab, a light, the player. */
function forest(after: boolean) {
  return (
    header +
    renderSettings(after) +
    gameObject(100, "Main Camera", [101, 102]) +
    transform(101, 100, 0, [], "{x: 0, y: 1, z: -10}") +
    camera(102, 100) +
    gameObject(110, "Directional Light", [111, 112]) +
    transform(
      111,
      110,
      0,
      [],
      "{x: 0, y: 3, z: 0}",
      "{x: 0.40821788, y: -0.23456968, z: 0.10938163, w: 0.8754261}",
    ) +
    light(112, 110, 1, after ? 1.3 : 1) +
    gameObject(120, "Environment", [121]) +
    transform(121, 120, 0, [131], "{x: 0, y: 0, z: 0}") +
    gameObject(130, "Forest", [131]) +
    transform(131, 130, 121, [], "{x: 0, y: 0, z: 0}") +
    prefabInstance(200, guids.treePrefab, 131, [1, 0, 2], { name: "Tree_01" }) +
    prefabInstance(
      210,
      guids.treePrefab,
      131,
      after ? [-2.5, 0, 3.5] : [-2, 0, 3],
      {
        name: "Tree_02",
      },
    ) +
    (after
      ? prefabInstance(230, guids.treePrefab, 131, [0, 0, 6], {
          name: "Tree_03",
        })
      : "") +
    prefabInstance(220, guids.rockPrefab, 121, [4, 0, 1], {
      material: after ? guids.mossyMaterial : guids.barkMaterial,
    }) +
    (after
      ? ""
      : gameObject(140, "Light_2", [141, 142]) +
        transform(141, 140, 121, [], "{x: 3, y: 2, z: 0}") +
        light(142, 140, 2, 0.8)) +
    gameObject(150, "Player", [151, 152]) +
    transform(
      151,
      150,
      0,
      [],
      after ? "{x: 2, y: 0, z: 5}" : "{x: 0, y: 0, z: 0}",
    ) +
    playerController(152, 150, after ? 6.5 : 5)
  );
}

export const forestScene = { before: forest(false), after: forest(true) };

const textureMeta = (android: number, compression: number, filter: number) =>
  `fileFormatVersion: 2
guid: 4b5c6d7e8f9041a2b3c4d5e6f708192a
TextureImporter:
  internalIDToNameTable: []
  externalObjects: {}
  serializedVersion: 12
  mipmaps:
    mipMapMode: 0
    enableMipMap: 1
    sRGBTexture: 1
    linearTexture: 0
  isReadable: 0
  streamingMipmaps: 0
  textureFormat: 1
  maxTextureSize: 2048
  textureSettings:
    serializedVersion: 2
    filterMode: ${filter}
    aniso: 1
    wrapU: 0
    wrapV: 0
  textureType: 0
  textureShape: 1
  alphaUsage: 1
  alphaIsTransparency: 0
  platformSettings:
  - serializedVersion: 3
    buildTarget: DefaultTexturePlatform
    maxTextureSize: 2048
    textureCompression: 1
    compressionQuality: 50
    crunchedCompression: 0
    overridden: 0
  - serializedVersion: 3
    buildTarget: Android
    maxTextureSize: ${android}
    textureCompression: ${compression}
    compressionQuality: 50
    crunchedCompression: 0
    overridden: 1
  spriteSheet:
    serializedVersion: 2
    sprites: []
    outline: []
  userData:
  assetBundleName:
  assetBundleVariant:
`;

export const grassMeta = {
  before: textureMeta(2048, 1, 1),
  after: textureMeta(1024, 2, 2),
};

const pipeline = (
  scale: number,
  shadows: number,
) => `${header}--- !u!114 &11400000
MonoBehaviour:
  m_ObjectHideFlags: 0
  m_Enabled: 1
  m_EditorHideFlags: 0
  m_Script: {fileID: 11500000, guid: bf2edee5c58d82540a51f03df9d42094, type: 3}
  m_Name: URP-HighFidelity
  m_EditorClassIdentifier:
  k_AssetVersion: 11
  m_RequireDepthTexture: 0
  m_SupportsHDR: 1
  m_MSAA: 4
  m_RenderScale: ${scale}
  m_MainLightShadowsSupported: 1
  m_ShadowDistance: ${shadows}
  m_ShadowCascadeCount: 4
`;

export const pipelineAsset = {
  before: pipeline(1, 150),
  after: pipeline(0.9, 120),
};

type Bone = { name: string; parent?: string; at: Vec };

/** A walk-cycle style rig: legs, spine, head and arms. */
const heroBones: Bone[] = [
  { name: "Hips", at: [0, 1, 0] },
  { name: "Spine", parent: "Hips", at: [0, 0.22, 0] },
  { name: "Chest", parent: "Spine", at: [0, 0.22, 0] },
  { name: "Head", parent: "Chest", at: [0, 0.32, 0] },
  { name: "Shoulder_R", parent: "Chest", at: [0.16, 0.2, 0] },
  { name: "UpperArm_R", parent: "Shoulder_R", at: [0.12, 0, 0] },
  { name: "ForeArm_R", parent: "UpperArm_R", at: [0, -0.27, 0] },
  { name: "Hand_R", parent: "ForeArm_R", at: [0, -0.24, 0] },
  { name: "Shoulder_L", parent: "Chest", at: [-0.16, 0.2, 0] },
  { name: "UpperArm_L", parent: "Shoulder_L", at: [-0.12, 0, 0] },
  { name: "ForeArm_L", parent: "UpperArm_L", at: [0, -0.27, 0] },
  { name: "Hand_L", parent: "ForeArm_L", at: [0, -0.24, 0] },
  { name: "Thigh_R", parent: "Hips", at: [0.1, -0.05, 0] },
  { name: "Shin_R", parent: "Thigh_R", at: [0, -0.45, 0] },
  { name: "Foot_R", parent: "Shin_R", at: [0, -0.42, 0.04] },
  { name: "Thigh_L", parent: "Hips", at: [-0.1, -0.05, 0] },
  { name: "Shin_L", parent: "Thigh_L", at: [0, -0.45, 0] },
  { name: "Foot_L", parent: "Shin_L", at: [0, -0.42, 0.04] },
];

/** Rotation keys about one axis of one bone, in seconds and degrees. */
type Track = { bone: string; axis: "X" | "Y" | "Z"; keys: [number, number][] };

const waveTracks: Track[] = [
  {
    bone: "UpperArm_R",
    axis: "Z",
    keys: [
      [0, 0],
      [0.3, 150],
      [1.5, 150],
      [1.8, 0],
    ],
  },
  {
    bone: "ForeArm_R",
    axis: "Z",
    keys: [
      [0, 0],
      [0.3, 15],
      [0.6, -25],
      [0.9, 15],
      [1.2, -25],
      [1.5, 15],
      [1.8, 0],
    ],
  },
  {
    bone: "Head",
    axis: "Z",
    keys: [
      [0, 0],
      [0.6, -8],
      [1.2, 6],
      [1.8, 0],
    ],
  },
];

/** An ASCII FBX with bones and one animation clip, but no mesh: how animations are often exported. */
function makeSkeletonFbx(bones: Bone[], clip: string, tracks: Track[]) {
  const second = 46186158000;
  const id = (name: string) => 2000 + bones.findIndex((b) => b.name === name);
  const nodes = bones.map(
    (bone) => `	Model: ${id(bone.name)}, "Model::${bone.name}", "LimbNode" {
		Version: 232
		Properties70:  {
			P: "Lcl Translation", "Lcl Translation", "", "A",${bone.at.join(",")}
		}
		Shading: Y
		Culling: "CullingOff"
	}`,
  );
  const links = bones.map(
    (bone) => `	C: "OO",${id(bone.name)},${bone.parent ? id(bone.parent) : 0}`,
  );
  const end = Math.max(...tracks.flatMap((t) => t.keys.map(([s]) => s)));
  nodes.push(`	AnimationStack: 4000, "AnimStack::${clip}", "" {
		Properties70:  {
			P: "LocalStop", "KTime", "Time", "",${Math.round(end * second)}
			P: "ReferenceStop", "KTime", "Time", "",${Math.round(end * second)}
		}
	}
	AnimationLayer: 5000, "AnimLayer::BaseLayer", "" {
	}`);
  links.push(`	C: "OO",5000,4000`);
  tracks.forEach((track, i) => {
    const node = 6000 + i,
      curve = 7000 + i;
    nodes.push(`	AnimationCurveNode: ${node}, "AnimCurveNode::R", "" {
		Properties70:  {
			P: "d|X", "Number", "", "A",0
			P: "d|Y", "Number", "", "A",0
			P: "d|Z", "Number", "", "A",0
		}
	}
	AnimationCurve: ${curve}, "AnimCurve::", "" {
		Default: 0
		KeyVer: 4009
		KeyTime: *${track.keys.length} {
			a: ${track.keys.map(([s]) => Math.round(s * second)).join(",")}
		}
		KeyValueFloat: *${track.keys.length} {
			a: ${track.keys.map(([, v]) => v).join(",")}
		}
	}`);
    links.push(
      `	C: "OO",${node},5000`,
      `	C: "OP",${node},${id(track.bone)}, "Lcl Rotation"`,
      `	C: "OP",${curve},${node}, "d|${track.axis}"`,
    );
  });
  return fbxDocument(nodes, links);
}

export const heroWave = makeSkeletonFbx(heroBones, "Wave", waveTracks);

const encoder = new TextEncoder();

/** What Git stores for a file kept in Git LFS. */
const lfsPointer = (oid: string, size: number) =>
  encoder.encode(
    `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${size}\n`,
  );

export const cliffPointers = {
  before: lfsPointer(
    "4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393",
    48_213_504,
  ),
  after: lfsPointer(
    "b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c",
    51_902_117,
  ),
};

/** Some bytes that look like a sound file to Git: binary, no preview. */
export function windSound(after: boolean) {
  const bytes = new Uint8Array(after ? 1640 : 1210);
  bytes.set(encoder.encode("RIFF"), 0);
  bytes.set(encoder.encode("WAVEfmt "), 8);
  for (let i = 44; i < bytes.length; i++)
    bytes[i] = 128 + Math.round(40 * Math.sin(i / (after ? 5 : 7)));
  return bytes;
}

/** A scene saved with Unity's binary serialization. */
export function binaryScene(after: boolean) {
  const bytes = new Uint8Array(after ? 900 : 860);
  bytes.set([0, 0, 0, 0, 0, 0, 0, 0x16, 0, 0, 0, 0x16], 0);
  bytes.set(encoder.encode("2022.3.21f1"), 20);
  return bytes;
}

const canvas = (size: number) => {
  if (typeof document === "undefined") return null;
  const element = document.createElement("canvas");
  element.width = element.height = size;
  return element;
};

/** Vertical grooves as a tangent-space normal map, for the bark material. */
export async function paintBarkNormal(): Promise<Uint8Array | null> {
  if (typeof OffscreenCanvas === "undefined") return null;
  const size = 128;
  const surface = new OffscreenCanvas(size, size);
  const g = surface.getContext("2d")!;
  for (let x = 0; x < size; x++) {
    const slope = Math.sin((x / size) * Math.PI * 14 + Math.sin(x / 9) * 2);
    g.fillStyle = `rgb(${Math.round(128 + slope * 90)}, 128, 235)`;
    g.fillRect(x, 0, 1, size);
  }
  const blob = await surface.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}

/** Mossy ground as an uncompressed 32-bit TGA, the way many artists save textures. */
export function paintMoss(after: boolean): Uint8Array | null {
  const size = 96;
  const surface = canvas(size);
  if (!surface) return null;
  const g = surface.getContext("2d")!;
  g.fillStyle = after ? "#4d6b34" : "#5b5a3a";
  g.fillRect(0, 0, size, size);
  let seed = after ? 11 : 5;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 160; i++) {
    g.fillStyle = after
      ? `rgba(${90 + random() * 60}, ${130 + random() * 70}, 60, 0.6)`
      : `rgba(${110 + random() * 40}, ${100 + random() * 40}, 70, 0.5)`;
    g.beginPath();
    g.arc(random() * size, random() * size, 1 + random() * 4, 0, Math.PI * 2);
    g.fill();
  }
  const { data } = g.getImageData(0, 0, size, size);
  const tga = new Uint8Array(18 + size * size * 4);
  tga.set([0, 0, 2], 0);
  tga.set([size & 255, size >> 8, size & 255, size >> 8, 32, 0x28], 12);
  for (let i = 0; i < size * size; i++)
    tga.set(
      [data[i * 4 + 2], data[i * 4 + 1], data[i * 4], data[i * 4 + 3]],
      18 + i * 4,
    );
  return tga;
}

/** A small poster as a layered Photoshop file with a flattened copy, as Photoshop saves it. */
export async function paintPoster(after: boolean): Promise<Uint8Array | null> {
  const size = 160;
  const background = canvas(size);
  const title = canvas(size);
  const composite = canvas(size);
  if (!background || !title || !composite) return null;
  const bg = background.getContext("2d")!;
  const sky = bg.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, after ? "#f3b26b" : "#8fc1d9");
  sky.addColorStop(1, after ? "#7c4a63" : "#e8f0dc");
  bg.fillStyle = sky;
  bg.fillRect(0, 0, size, size);
  bg.fillStyle = after ? "#2f3b2a" : "#3f6b46";
  for (let x = -10; x < size; x += 26) {
    bg.beginPath();
    bg.moveTo(x, size);
    bg.lineTo(x + 18, size * 0.45 + ((x * 7) % 23));
    bg.lineTo(x + 36, size);
    bg.fill();
  }
  if (after) {
    bg.fillStyle = "#ffe3a3";
    bg.beginPath();
    bg.arc(size * 0.72, size * 0.3, 16, 0, Math.PI * 2);
    bg.fill();
  }
  const text = title.getContext("2d")!;
  text.fillStyle = "#ffffff";
  text.font = "bold 22px sans-serif";
  text.textAlign = "center";
  text.fillText(after ? "FOREST" : "WOODS", size / 2, 34);
  const flat = composite.getContext("2d")!;
  flat.drawImage(background, 0, 0);
  flat.drawImage(title, 0, 0);
  const { writePsdUint8Array } = await import("ag-psd");
  return writePsdUint8Array({
    width: size,
    height: size,
    canvas: composite,
    children: [
      { name: "Background", canvas: background },
      { name: "Title", canvas: title },
    ],
  });
}
