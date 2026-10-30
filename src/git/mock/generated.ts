// Demo data for Unity's generated files, shown with `?gitignore=missing|committed`.
import { UNITY_GITIGNORE } from "../../unity/gitignore";
import type { FileChange, UnityGenerated } from "../types";

/**
 * A project without a .gitignore: "missing" has never committed Unity's
 * folders; "committed" saved them once, as `git add --all` does.
 */
export function demoGenerated(
  flag: "missing" | "committed" | null,
): UnityGenerated | undefined {
  if (flag === "missing")
    return {
      untracked: [
        "Assembly-CSharp.csproj",
        "Library/",
        "Logs/",
        "Temp/",
        "UserSettings/",
        "kinetic.sln",
      ],
      tracked: [],
    };
  if (flag === "committed")
    return {
      untracked: ["Temp/"],
      tracked: [
        "Assembly-CSharp.csproj",
        "Library/",
        "Logs/",
        "UserSettings/",
        "kinetic.sln",
      ],
    };
}

/** What sits in the committed folders, and so leaves git with them. */
const committedFiles: Record<string, string[]> = {
  "Library/": [
    "Library/ArtifactDB",
    "Library/SourceAssetDB",
    "Library/Artifacts/3f/3f8a9c2e41b7d05f6e1a2b3c4d5e6f70",
  ],
  "Logs/": ["Logs/AssetImportWorker0.log"],
  "UserSettings/": ["UserSettings/EditorUserSettings.asset"],
};

const binary = (path: string, status: FileChange["status"]): FileChange => ({
  path,
  status,
  hunks: [],
  binary: true,
});

/** Unity rewrites its committed folders all the time; those changes show up in the list. */
export const generatedChanges = (): FileChange[] => [
  binary("Library/ArtifactDB", "modified"),
  binary("Library/SourceAssetDB", "modified"),
  binary("Library/Artifacts/3f/3f8a9c2e41b7d05f6e1a2b3c4d5e6f70", "modified"),
  binary("UserSettings/EditorUserSettings.asset", "modified"),
];

/** The commit that stops tracking them: everything in them goes, Unity's .gitignore arrives. */
export const untrackCommit = (tracked: string[]): FileChange[] => [
  gitignoreChange(),
  ...tracked.flatMap((path) =>
    (committedFiles[path] ?? [path]).map((file) => binary(file, "deleted")),
  ),
];

/** Unity's .gitignore as a new file. */
export function gitignoreChange(): FileChange {
  const lines = UNITY_GITIGNORE.trimEnd().split("\n");
  return {
    path: ".gitignore",
    status: "added",
    hunks: [
      {
        header: `@@ -0,0 +1,${lines.length} @@`,
        staged: false,
        lines: lines.map((text) => ({ kind: "add", text })),
      },
    ],
  };
}
