import { extension } from "./paths";
import type { FileChange } from "./types";

/** How a file is best shown: as text, as a readable card, or as a picture or model. */
export type FileKind =
  | "code"
  | "scene"
  | "material"
  | "unity-yaml"
  | "meta"
  | "image"
  | "model"
  | "binary";

const scenes = new Set(["unity", "prefab"]);
const unityYaml = new Set([
  "asset",
  "anim",
  "controller",
  "overridecontroller",
  "physicmaterial",
  "physicsmaterial2d",
  "mask",
  "lighting",
  "playable",
  "signal",
  "spriteatlas",
  "terrainlayer",
  "rendertexture",
  "cubemap",
  "flare",
  "guiskin",
  "fontsettings",
  "mixer",
  "brush",
  "giparams",
]);
const images = new Set(["png", "jpg", "jpeg", "tga", "psd", "gif", "bmp"]);
const models = new Set(["fbx", "obj", "gltf", "glb"]);

export function fileKind(file: Pick<FileChange, "path" | "binary">): FileKind {
  const ext = extension(file.path);
  if (images.has(ext)) return "image";
  if (models.has(ext)) return "model";
  if (ext === "mat") return "material";
  if (scenes.has(ext)) return "scene";
  if (ext === "meta") return "meta";
  if (unityYaml.has(ext)) return "unity-yaml";
  return file.binary ? "binary" : "code";
}

/** Git LFS stores large files on the server and commits a small text pointer instead. */
export function isLfsPointer(bytes: Uint8Array | null) {
  if (!bytes || bytes.length > 1024) return false;
  return new TextDecoder()
    .decode(bytes)
    .startsWith("version https://git-lfs.github.com/spec/v1");
}
