import { invoke, isTauri } from "@tauri-apps/api/core";

/** UnityYAMLMerge, Unity's tool for merging scenes and prefabs; every editor ships one. */
export type MergeTool = { version: string; path: string };

/** "6000.3.11f1" → [6000, 3, 11, 1]; letters only separate the numbers. */
const parts = (version: string) =>
  version
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number);

export function compareVersions(a: string, b: string) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/** The newest editor's tool: Smart Merge only improves between versions. */
export const newestTool = (tools: MergeTool[]) =>
  [...tools].sort((a, b) => compareVersions(b.version, a.version))[0];

/** Unity editors installed through Unity Hub; the browser demo pretends there is one. */
export async function findMergeTools(): Promise<MergeTool[]> {
  if (!isTauri())
    return [
      {
        version: "6000.0.32f1",
        path: "C:/Program Files/Unity/Hub/Editor/6000.0.32f1/Editor/Data/Tools/UnityYAMLMerge.exe",
      },
    ];
  return invoke<MergeTool[]>("unity_merge_tools").catch(() => []);
}
