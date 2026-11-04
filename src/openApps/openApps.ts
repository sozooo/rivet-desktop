import type { GitBackend } from "../git/backend";
import { extension } from "../git/paths";

/**
 * What Unity and Blender have open inside a repository, as the desktop app
 * finds it (src-tauri/src/open_apps.rs). Both keep files in memory: saving in
 * them after Rivet rewrote those files on disk puts the old version back.
 */
export type OpenApps = {
  /** Unity projects open in the editor, as folders in the repository: "" or "Game/". */
  unity: string[];
  /** .blend files open in Blender, relative to the repository. */
  blender: { path: string; unsaved: boolean }[];
};

export const nothingOpen: OpenApps = { unity: [], blender: [] };

/** One line of the warning: a program and what to do in it first. */
export type OpenAppWarning =
  | { app: "unity"; project: string }
  | { app: "blender"; path: string; unsaved: boolean };

/**
 * Files an action rewrites on disk; null when any file may change. A function
 * is only called when something is open, since working it out can take a fetch.
 */
export type Rewrites = string[] | null | (() => Promise<string[] | null>);

/**
 * Unity reloads most assets by itself; only an open scene or prefab with
 * unsaved edits can be saved back over a newer file.
 */
const UNITY_OPEN_IN_EDITOR = ["unity", "prefab"];

/**
 * The open programs an action would hurt, given the files it rewrites (null:
 * unknown, so everything open counts). Paths compare without case, as on Windows.
 */
export function openAppWarnings(
  open: OpenApps,
  rewrites: string[] | null,
): OpenAppWarning[] {
  const paths = rewrites?.map((path) => path.toLowerCase());
  const touches = (test: (path: string) => boolean) =>
    !paths || paths.some(test);
  return [
    ...open.unity
      .filter((project) =>
        touches(
          (path) =>
            path.startsWith(project.toLowerCase()) &&
            UNITY_OPEN_IN_EDITOR.includes(extension(path)),
        ),
      )
      .map((project) => ({ app: "unity" as const, project })),
    ...open.blender
      .filter((file) => touches((path) => path === file.path.toLowerCase()))
      .map((file) => ({ app: "blender" as const, ...file })),
  ];
}

/** What a pull writes, from the last fetch; null when the backend can't tell. */
export const incomingPaths = async (backend: GitBackend) =>
  (await backend.changedPaths?.("@{upstream}", true)) ?? null;

/** What a pull writes, asking the server first so that nothing new is missed. */
export async function pullRewrites(backend: GitBackend) {
  await backend.fetch();
  return incomingPaths(backend);
}

export const anythingOpen = (open: OpenApps) =>
  open.unity.length > 0 || open.blender.length > 0;

/**
 * Whether to go ahead with an action that rewrites files: at once when nothing
 * open is affected, otherwise as `ask` answers. It never blocks: when looking
 * fails, the action goes ahead as before.
 */
export async function confirmRewrite(
  detect: () => Promise<OpenApps>,
  rewrites: Rewrites,
  ask: (warnings: OpenAppWarning[]) => Promise<boolean>,
): Promise<boolean> {
  const open = await detect().catch(() => nothingOpen);
  if (!anythingOpen(open)) return true;
  const paths =
    typeof rewrites === "function"
      ? await rewrites().catch(() => null)
      : rewrites;
  const warnings = openAppWarnings(open, paths);
  return warnings.length ? ask(warnings) : true;
}

/** `?open=unity,blender` in the browser demo pretends both are open. */
export function demoOpenApps(flag: string | null): OpenApps {
  const apps = (flag ?? "").split(",");
  return {
    unity: apps.includes("unity") ? [""] : [],
    blender: apps.includes("blender")
      ? [{ path: "Art/Tree.blend", unsaved: true }]
      : [],
  };
}
