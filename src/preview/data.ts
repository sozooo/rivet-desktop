import { createContext, useContext, useEffect, useState } from "react";
import type { GitBackend } from "../git/backend";
import { fileName } from "../git/paths";
import type { FileChange, Revision } from "../git/types";
import { decodeImage } from "./decode";

/** Which two versions a preview compares. */
export type Revisions = { before: Revision; after: Revision };

/** What previews need from the workspace: where files come from, and the theme to draw on. */
export const PreviewContext = createContext<{
  backend: GitBackend | null;
  dark: boolean;
}>({ backend: null, dark: false });
export const useBackend = () => useContext(PreviewContext).backend;
export const useDark = () => useContext(PreviewContext).dark;

export type Pair = { before: Uint8Array | null; after: Uint8Array | null };

/** Loads both versions of a file; undefined while loading. */
export function usePair(file: FileChange, revisions: Revisions) {
  const backend = useBackend();
  const [pair, setPair] = useState<Pair>();
  useEffect(() => {
    let current = true;
    setPair(undefined);
    if (!backend) return;
    const read = (path: string, revision: Revision) =>
      backend.readFile(path, revision).catch(() => null);
    Promise.all([
      file.status === "added"
        ? null
        : read(file.oldPath ?? file.path, revisions.before),
      file.status === "deleted" ? null : read(file.path, revisions.after),
    ]).then(([before, after]) => current && setPair({ before, after }));
    return () => {
      current = false;
    };
  }, [
    backend,
    file.path,
    file.oldPath,
    file.status,
    revisions.before,
    revisions.after,
  ]);
  return pair;
}

/** Asset paths for Unity GUIDs, filled in as they are found. */
export function useAssetPaths(guids: Iterable<string>) {
  const backend = useBackend();
  const key = [...new Set(guids)].filter(Boolean).sort().join(",");
  const [paths, setPaths] = useState(() => new Map<string, string>());
  useEffect(() => {
    let current = true;
    if (!backend?.resolveGuid || !key) return;
    Promise.all(
      key
        .split(",")
        .map(async (guid) => [
          guid,
          await backend.resolveGuid!(guid).catch(() => null),
        ]),
    ).then(
      (found) =>
        current &&
        setPaths(new Map(found.filter((f): f is [string, string] => !!f[1]))),
    );
    return () => {
      current = false;
    };
  }, [backend, key]);
  return paths;
}

export type Texture = { name: string; url?: string };
export const textureKey = (guid: string, revision: Revision) =>
  `${guid}@${revision}`;

/** Textures found by GUID at a revision: their names, and pictures when they decode. */
export function useTextures(wanted: { guid: string; revision: Revision }[]) {
  const backend = useBackend();
  const key = [...new Set(wanted.map((w) => textureKey(w.guid, w.revision)))]
    .sort()
    .join("|");
  const [textures, setTextures] = useState(
    () => new Map<string, Texture | null>(),
  );
  useEffect(() => {
    let current = true;
    const urls: string[] = [];
    if (!backend?.resolveGuid || !key) return;
    const load = async (request: string): Promise<[string, Texture | null]> => {
      const at = request.lastIndexOf("@");
      const path = await backend.resolveGuid!(request.slice(0, at));
      if (!path) return [request, null];
      const bytes = await backend
        .readFile(path, request.slice(at + 1))
        .catch(() => null);
      const image = bytes
        ? await decodeImage(path, bytes).catch(() => null)
        : null;
      if (image) urls.push(image.url);
      return [request, { name: fileName(path), url: image?.url }];
    };
    Promise.all(key.split("|").map(load)).then(
      (found) => current && setTextures(new Map(found)),
    );
    return () => {
      current = false;
      for (const url of urls)
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [backend, key]);
  return textures;
}

export const text = (bytes: Uint8Array | null) =>
  bytes ? new TextDecoder().decode(bytes) : null;

/** "Assets/Prefabs/Tree_03.prefab" → "Tree_03". */
export const assetName = (path: string) =>
  fileName(path).replace(/\.[^.]*$/, "");

export function formatSize(bytes: number, language: string) {
  const units =
    language === "ru" ? ["Б", "КБ", "МБ", "ГБ"] : ["B", "KB", "MB", "GB"];
  let value = bytes,
    unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const number = new Intl.NumberFormat(language, {
    maximumFractionDigits: unit ? 1 : 0,
  }).format(value);
  return `${number} ${units[unit]}`;
}
