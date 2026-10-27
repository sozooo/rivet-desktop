import {
  asList,
  asText,
  isMap,
  parseUnityYaml,
  reference,
  type YamlValue,
} from "./yaml";

export type Color = { r: number; g: number; b: number; a: number };

export type MaterialProps = {
  name: string;
  shader: string;
  colors: Map<string, Color>;
  floats: Map<string, number>;
  textures: Map<string, string | null>;
};

export type MaterialChange =
  | { kind: "color"; name: string; before?: Color; after?: Color }
  | { kind: "float"; name: string; before?: number; after?: number }
  | {
      kind: "texture";
      name: string;
      before?: string | null;
      after?: string | null;
    }
  | { kind: "shader"; name: "shader"; before: string; after: string };

/** Unity lists properties as "- _Name: value"; this reads them as pairs. */
const entries = (value: YamlValue | undefined): [string, YamlValue][] =>
  asList(value).flatMap((item) => (isMap(item) ? Object.entries(item) : []));

export function parseMaterial(text: string): MaterialProps | null {
  const doc = parseUnityYaml(text).find((d) => d.type === "Material");
  if (!doc) return null;
  const props = isMap(doc.data.m_SavedProperties)
    ? doc.data.m_SavedProperties
    : {};
  const colors = new Map<string, Color>();
  for (const [name, value] of entries(props.m_Colors))
    if (isMap(value)) {
      const [r, g, b, a] = ["r", "g", "b", "a"].map((k) =>
        Number(asText(value[k])),
      );
      colors.set(name, { r, g, b, a });
    }
  const floats = new Map<string, number>();
  for (const [name, value] of [
    ...entries(props.m_Floats),
    ...entries(props.m_Ints),
  ])
    if (typeof value === "string") floats.set(name, Number(value));
  const textures = new Map<string, string | null>();
  for (const [name, value] of entries(props.m_TexEnvs))
    if (isMap(value))
      textures.set(name, reference(value.m_Texture)?.guid || null);
  return {
    name: asText(doc.data.m_Name),
    shader: reference(doc.data.m_Shader)?.guid ?? "",
    colors,
    floats,
    textures,
  };
}

const sameColor = (a?: Color, b?: Color) =>
  !!a &&
  !!b &&
  (["r", "g", "b", "a"] as const).every((k) => Math.abs(a[k] - b[k]) < 1e-4);

export function diffMaterials(
  before: MaterialProps | null,
  after: MaterialProps | null,
): MaterialChange[] {
  const changes: MaterialChange[] = [];
  const a = before ?? {
    name: "",
    shader: "",
    colors: new Map(),
    floats: new Map(),
    textures: new Map(),
  };
  const b = after ?? {
    name: "",
    shader: "",
    colors: new Map(),
    floats: new Map(),
    textures: new Map(),
  };
  if (before && after && a.shader !== b.shader)
    changes.push({
      kind: "shader",
      name: "shader",
      before: a.shader,
      after: b.shader,
    });
  for (const name of new Set([...a.colors.keys(), ...b.colors.keys()]))
    if (!sameColor(a.colors.get(name), b.colors.get(name)))
      changes.push({
        kind: "color",
        name,
        before: a.colors.get(name),
        after: b.colors.get(name),
      });
  for (const name of new Set([...a.floats.keys(), ...b.floats.keys()]))
    if (a.floats.get(name) !== b.floats.get(name))
      changes.push({
        kind: "float",
        name,
        before: a.floats.get(name),
        after: b.floats.get(name),
      });
  for (const name of new Set([...a.textures.keys(), ...b.textures.keys()]))
    if (a.textures.get(name) !== b.textures.get(name))
      changes.push({
        kind: "texture",
        name,
        before: a.textures.get(name),
        after: b.textures.get(name),
      });
  return changes;
}

/** Friendly names for the properties of Unity's built-in and URP shaders. */
const known: Record<string, string> = {
  _BaseColor: "baseColor",
  _Color: "baseColor",
  _BaseMap: "baseMap",
  _MainTex: "baseMap",
  _BumpMap: "normalMap",
  _NormalMap: "normalMap",
  _BumpScale: "normalStrength",
  _Smoothness: "smoothness",
  _Glossiness: "smoothness",
  _Metallic: "metallic",
  _MetallicGlossMap: "metallicMap",
  _OcclusionMap: "occlusionMap",
  _OcclusionStrength: "occlusionStrength",
  _EmissionColor: "emissionColor",
  _EmissionMap: "emissionMap",
  _Cutoff: "alphaCutoff",
  _ParallaxMap: "heightMap",
  _DetailAlbedoMap: "detailMap",
};

/** A dictionary key for well-known properties, otherwise a readable form of the name. */
export function propertyLabel(name: string): { key?: string; text: string } {
  const key = known[name];
  const text = name
    .replace(/^_/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ");
  return { key, text };
}

export const cssColor = (c: Color) =>
  `rgba(${Math.round(Math.min(1, c.r) * 255)}, ${Math.round(Math.min(1, c.g) * 255)}, ${Math.round(Math.min(1, c.b) * 255)}, ${c.a})`;
