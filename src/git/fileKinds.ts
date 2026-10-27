import { extension } from "./paths";
import type { FileChange, Hunk } from "./types";

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

export function fileKind(
  file: Pick<FileChange, "path" | "binary"> & { hunks?: Hunk[] },
): FileKind {
  const ext = extension(file.path);
  if (images.has(ext)) return "image";
  if (models.has(ext)) return "model";
  // Unity files keep their kind even when Git calls them binary (Force Binary
  // serialization, or .gitattributes); the previews check the bytes themselves.
  if (ext === "mat") return "material";
  if (scenes.has(ext)) return "scene";
  if (ext === "meta") return "meta";
  if (unityYaml.has(ext)) return "unity-yaml";
  return file.binary || isLfsDiff(file.hunks ?? []) ? "binary" : "code";
}

const LFS_VERSION = "version https://git-lfs.github.com/spec/v1";

export type LfsPointer = { oid: string; size: number };

/** Git LFS stores large files on the server and commits a small text pointer instead. */
export function lfsPointer(bytes: Uint8Array | null): LfsPointer | null {
  if (!bytes || bytes.length > 1024) return null;
  const text = new TextDecoder().decode(bytes);
  if (!text.startsWith(LFS_VERSION)) return null;
  const oid = text.match(/^oid sha256:([0-9a-f]{64})$/m)?.[1];
  const size = Number(text.match(/^size (\d+)$/m)?.[1]);
  return oid ? { oid, size: size || 0 } : null;
}

/** A diff of LFS pointers says nothing a person can read: the real file is binary. */
export function isLfsDiff(hunks: Hunk[]) {
  const lines = hunks.flatMap((h) => h.lines);
  return (
    lines.some((l) => l.text.startsWith("oid sha256:")) &&
    lines.every((l) =>
      /^(version https:\/\/git-lfs|oid |size |ext-)/.test(l.text),
    )
  );
}
