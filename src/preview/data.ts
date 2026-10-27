import { createContext, useContext, useEffect, useState } from "react";
import type { GitBackend } from "../git/backend";
import type { FileChange, Revision } from "../git/types";

/** Which two versions a preview compares. */
export type Revisions = { before: Revision; after: Revision };

export const BackendContext = createContext<GitBackend | null>(null);
export const useBackend = () => useContext(BackendContext);

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

export const text = (bytes: Uint8Array | null) =>
  bytes ? new TextDecoder().decode(bytes) : null;

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
