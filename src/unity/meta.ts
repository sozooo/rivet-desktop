import { asText, isMap, parseYamlBlock, type YamlValue } from "./yaml";

export type SettingChange = {
  /** e.g. "platformSettings[Android].maxTextureSize" */
  key: string;
  before: string | null;
  after: string | null;
};

export type MetaDiff = {
  /** "TextureImporter", "ModelImporter"… */
  importer: string;
  /** Unity links assets by GUID; a new one breaks every link to the asset. */
  guidChanged: boolean;
  changes: SettingChange[];
};

/** Fields Unity rewrites on its own; nobody changes them on purpose. */
const NOISE = new Set([
  "fileFormatVersion",
  "timeCreated",
  "licenseType",
  "serializedVersion",
  "internalID",
  "internalIDToNameTable",
  "fileIDToRecycleName",
  "spriteID",
]);

function flatten(value: YamlValue, prefix: string, out: Map<string, string>) {
  if (typeof value === "string") out.set(prefix, value);
  else if (Array.isArray(value))
    value.forEach((item, i) => {
      // Platforms and animation clips are known by name, not by position.
      const name = isMap(item)
        ? asText(item.buildTarget) || asText(item.name)
        : "";
      flatten(item, `${prefix}[${name || i}]`, out);
    });
  else if ("fileID" in value)
    out.set(prefix, `${asText(value.fileID)}:${asText(value.guid)}`);
  else
    for (const [key, item] of Object.entries(value))
      if (!NOISE.has(key))
        flatten(item, prefix ? `${prefix}.${key}` : key, out);
}

export function diffMeta(
  beforeText: string | null,
  afterText: string | null,
): MetaDiff {
  const before = beforeText ? parseYamlBlock(beforeText) : {};
  const after = afterText ? parseYamlBlock(afterText) : {};
  const importer =
    Object.keys(after).find((k) => k.endsWith("Importer")) ??
    Object.keys(before).find((k) => k.endsWith("Importer")) ??
    "";
  const old = new Map<string, string>(),
    now = new Map<string, string>();
  if (before[importer]) flatten(before[importer], "", old);
  if (after[importer]) flatten(after[importer], "", now);
  const changes: SettingChange[] = [];
  for (const key of new Set([...old.keys(), ...now.keys()]))
    if (old.get(key) !== now.get(key))
      changes.push({
        key,
        before: old.get(key) ?? null,
        after: now.get(key) ?? null,
      });
  return {
    importer,
    guidChanged:
      !!beforeText && !!afterText && asText(before.guid) !== asText(after.guid),
    changes,
  };
}

type Setting = { label: string; values?: Record<string, string>; flag?: true };

const flag = (label: string): Setting => ({ label, flag: true });
const wrap: Setting["values"] = {
  "-1": "Default",
  "0": "Repeat",
  "1": "Clamp",
  "2": "Mirror",
  "3": "Mirror Once",
};

/** Import settings under the names Unity's Inspector gives them. */
const SETTINGS: Record<string, Setting> = {
  textureType: {
    label: "Texture Type",
    values: {
      "0": "Default",
      "1": "Normal map",
      "2": "Editor GUI and Legacy GUI",
      "4": "Cookie",
      "6": "Lightmap",
      "7": "Cursor",
      "8": "Sprite (2D and UI)",
      "10": "Single Channel",
      "11": "Shadowmask",
      "12": "Directional Lightmap",
    },
  },
  textureShape: {
    label: "Texture Shape",
    values: { "1": "2D", "2": "Cube", "4": "2D Array", "8": "3D" },
  },
  maxTextureSize: { label: "Max Size" },
  textureCompression: {
    label: "Compression",
    values: {
      "0": "None",
      "1": "Normal Quality",
      "2": "High Quality",
      "3": "Low Quality",
    },
  },
  textureFormat: { label: "Format" },
  compressionQuality: { label: "Compressor Quality" },
  crunchedCompression: flag("Use Crunch Compression"),
  resizeAlgorithm: {
    label: "Resize Algorithm",
    values: { "0": "Mitchell", "1": "Bilinear" },
  },
  overridden: flag("Override"),
  sRGBTexture: flag("sRGB (Color Texture)"),
  alphaIsTransparency: flag("Alpha Is Transparency"),
  alphaUsage: {
    label: "Alpha Source",
    values: { "0": "None", "1": "Input Texture Alpha", "2": "From Gray Scale" },
  },
  isReadable: flag("Read/Write"),
  enableMipMap: flag("Generate Mipmaps"),
  streamingMipmaps: flag("Mipmap Streaming"),
  borderMipMap: flag("Border Mip Maps"),
  mipMapsPreserveCoverage: flag("Preserve Coverage"),
  npotScale: {
    label: "Non-Power of 2",
    values: {
      "0": "None",
      "1": "To nearest",
      "2": "To larger",
      "3": "To smaller",
    },
  },
  filterMode: {
    label: "Filter Mode",
    values: {
      "-1": "Default",
      "0": "Point (no filter)",
      "1": "Bilinear",
      "2": "Trilinear",
    },
  },
  aniso: { label: "Aniso Level" },
  wrapU: { label: "Wrap Mode U", values: wrap },
  wrapV: { label: "Wrap Mode V", values: wrap },
  wrapW: { label: "Wrap Mode W", values: wrap },
  spriteMode: {
    label: "Sprite Mode",
    values: { "0": "None", "1": "Single", "2": "Multiple", "3": "Polygon" },
  },
  spritePixelsToUnits: { label: "Pixels Per Unit" },
  spritePivot: { label: "Pivot" },
  globalScale: { label: "Scale Factor" },
  useFileScale: flag("Convert Units"),
  importBlendShapes: flag("Import BlendShapes"),
  importVisibility: flag("Import Visibility"),
  importCameras: flag("Import Cameras"),
  importLights: flag("Import Lights"),
  addColliders: flag("Generate Colliders"),
  swapUVChannels: flag("Swap UVs"),
  generateSecondaryUV: flag("Generate Lightmap UVs"),
  meshCompression: {
    label: "Mesh Compression",
    values: { "0": "Off", "1": "Low", "2": "Medium", "3": "High" },
  },
  materialImportMode: {
    label: "Material Creation Mode",
    values: {
      "0": "None",
      "1": "Standard",
      "2": "Import via MaterialDescription",
    },
  },
  importAnimation: flag("Import Animation"),
  animationType: {
    label: "Animation Type",
    values: { "0": "None", "1": "Legacy", "2": "Generic", "3": "Humanoid" },
  },
  firstFrame: { label: "Start" },
  lastFrame: { label: "End" },
  loopTime: flag("Loop Time"),
  loopBlend: flag("Loop Pose"),
  forceToMono: flag("Force To Mono"),
  loadInBackground: flag("Load In Background"),
  preloadAudioData: flag("Preload Audio Data"),
  loadType: {
    label: "Load Type",
    values: {
      "0": "Decompress On Load",
      "1": "Compressed In Memory",
      "2": "Streaming",
    },
  },
  compressionFormat: {
    label: "Compression Format",
    values: { "0": "PCM", "1": "Vorbis", "2": "ADPCM" },
  },
  quality: { label: "Quality" },
  assetBundleName: { label: "AssetBundle" },
};

const PLATFORMS: Record<string, string> = {
  DefaultTexturePlatform: "Default",
  Standalone: "PC, Mac & Linux",
  iPhone: "iOS",
};

const words = (name: string) =>
  name
    .replace(/^m_/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

/** "platformSettings[Android].maxTextureSize" → "Android · Max Size". */
export function settingLabel(key: string) {
  const scopes = [...key.matchAll(/\[([^\]]+)\]/g)]
    .map(([, name]) => (/^\d+$/.test(name) ? `#${Number(name) + 1}` : name))
    .map((name) => PLATFORMS[name] ?? name);
  const last =
    key
      .replace(/\[[^\]]*\]/g, "")
      .split(".")
      .pop() ?? key;
  return [...scopes, SETTINGS[last]?.label ?? words(last)].join(" · ");
}

/** A setting's value as the Inspector shows it; flags come back as true or false. */
export function settingValue(key: string, value: string): string | boolean {
  const setting = SETTINGS[key.split(".").pop() ?? key];
  if (setting?.flag && (value === "0" || value === "1")) return value === "1";
  return setting?.values?.[value] ?? value;
}
