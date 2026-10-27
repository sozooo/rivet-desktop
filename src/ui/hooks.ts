import { useEffect, useState, type RefObject } from "react";

/** State that survives reloads, kept in localStorage under `key`. */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : (JSON.parse(stored) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

/** Calls `onDismiss` on Escape or a pointer press outside `ref`. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const press = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onDismiss();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    document.addEventListener("pointerdown", press);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("keydown", key);
    };
  }, [ref, open, onDismiss]);
}

/** Loads a value asynchronously; undefined until the latest request resolves. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let current = true;
    setValue(undefined);
    load().then((v) => current && setValue(v));
    return () => {
      current = false;
    };
  }, deps);
  return value;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
