import { extension } from "./paths";
import type { FileChange } from "./types";

const MB = 1024 * 1024;
/** GitHub refuses files over 100 MB and warns from 50 MB. */
export const GITHUB_LIMIT = 100 * MB;
export const LARGE_FILE = 50 * MB;

/** Art that belongs in Git LFS: a standard set for Unity projects. */
export const LFS_EXTENSIONS = [
  "png",
  "psd",
  "tga",
  "tif",
  "tiff",
  "exr",
  "jpg",
  "jpeg",
  "fbx",
  "obj",
  "blend",
  "wav",
  "mp3",
  "ogg",
  "mp4",
  "mov",
];

const kept = (file: FileChange) =>
  !file.lfs && !file.conflict && file.status !== "deleted";

/** A changed file that would go in as a regular file, though it belongs in LFS. */
export const needsLfs = (file: FileChange) =>
  kept(file) &&
  (LFS_EXTENSIONS.includes(extension(file.path)) ||
    (file.size ?? 0) > LARGE_FILE);

/** A changed file GitHub would refuse. */
export const tooLarge = (file: FileChange) =>
  kept(file) && (file.size ?? 0) > GITHUB_LIMIT;

/** Patterns for `git lfs track`: the standard art set plus whatever else is too large. */
export function lfsPatterns(files: FileChange[]) {
  const extra = files
    .filter(tooLarge)
    .map((f) => (extension(f.path) ? `*.${extension(f.path)}` : f.path));
  return [...new Set([...LFS_EXTENSIONS.map((e) => `*.${e}`), ...extra])];
}

/** Files git merges with Unity's Smart Merge once it is set up. */
export const SMART_MERGE_EXTENSIONS = [
  "unity",
  "prefab",
  "asset",
  "mat",
  "anim",
  "controller",
];
export const SMART_MERGE_DRIVER = "unityyamlmerge";

type Rule = { pattern: string; attributes: string[] };

function rules(text: string): Rule[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [pattern, ...attributes] = line.split(/\s+/);
      return { pattern, attributes };
    });
}

/** What a .gitattributes file says about LFS and Unity scene merging. */
export function readAttributes(text: string) {
  const all = rules(text);
  const scene = all.find(
    (r) =>
      /\.(unity|prefab)$/i.test(r.pattern) &&
      r.attributes.some((a) => a.startsWith("merge=")),
  );
  return {
    lfs: all.some((r) => r.attributes.includes("filter=lfs")),
    /** The merge driver scenes use, if any. */
    sceneDriver:
      scene?.attributes
        .find((a) => a.startsWith("merge="))
        ?.slice("merge=".length) ?? null,
  };
}

/** .gitattributes with Smart Merge lines added for Unity files that have no merge rule yet. */
export function withSmartMerge(text: string, driver = SMART_MERGE_DRIVER) {
  const ruled = new Set(
    rules(text)
      .filter((r) => r.attributes.some((a) => a.startsWith("merge=")))
      .map((r) => r.pattern.toLowerCase()),
  );
  const missing = SMART_MERGE_EXTENSIONS.map((e) => `*.${e}`).filter(
    (pattern) => !ruled.has(pattern),
  );
  if (!missing.length) return text;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = [
    "# Unity Smart Merge: git merges scenes and prefabs with UnityYAMLMerge",
    ...missing.map((p) => `${p} merge=${driver}`),
  ];
  const base = text && !text.endsWith("\n") ? text + eol : text;
  return base + (base ? eol : "") + lines.join(eol) + eol;
}
