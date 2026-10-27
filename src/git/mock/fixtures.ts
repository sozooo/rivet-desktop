import type { Commit, DiffLine, FileChange, Hunk, Person } from "../types";
import { barkMaterial, crateModel, paintBark, treePrefab } from "./assets";
import {
  binaryScene,
  cliffPointers,
  forestScene,
  grassMeta,
  heroWave,
  paintBarkNormal,
  paintMoss,
  paintPoster,
  pipelineAsset,
  windSound,
} from "./samples";

const lines = (
  before: string[],
  removed: string[],
  added: string[],
  after: string[],
): DiffLine[] => [
  ...before.map((text) => ({ kind: "context" as const, text })),
  ...removed.map((text) => ({ kind: "del" as const, text })),
  ...added.map((text) => ({ kind: "add" as const, text })),
  ...after.map((text) => ({ kind: "context" as const, text })),
];

const minutes = (n: number) => Date.now() - n * 60_000;
const hours = (n: number) => minutes(n * 60);
const days = (n: number) => hours(n * 24);

export const people = {
  alex: { name: "Alex Morgan", email: "alex@kinetic.dev" },
  jamie: { name: "Jamie Chen", email: "jamie@kinetic.dev" },
  sam: { name: "Sam Rivera", email: "sam@kinetic.dev" },
  mira: { name: "Mira Sokolova", email: "mira@kinetic.dev" },
} satisfies Record<string, Person>;

/** One hunk around the lines that differ, with three lines of context. */
function textHunk(before: string, after: string): Hunk {
  const a = before.split("\n"),
    b = after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length,
    endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const from = Math.max(0, start - 3);
  const linesOut: DiffLine[] = [
    ...a.slice(from, start).map((text) => ({ kind: "context" as const, text })),
    ...a.slice(start, endA).map((text) => ({ kind: "del" as const, text })),
    ...b.slice(start, endB).map((text) => ({ kind: "add" as const, text })),
    ...a
      .slice(endA, Math.min(a.length, endA + 3))
      .map((text) => ({ kind: "context" as const, text })),
  ];
  return {
    header: `@@ -${from + 1},0 +${from + 1},0 @@`,
    lines: linesOut,
    staged: false,
  };
}

/** Art and scene changes, the kind an artist makes. */
function artChanges(): FileChange[] {
  return [
    {
      path: "Assets/Textures/Bark.png",
      status: "modified",
      hunks: [],
      binary: true,
    },
    {
      path: "Assets/Models/Crate.fbx",
      status: "modified",
      hunks: [],
      binary: true,
    },
    {
      path: "Assets/Materials/Bark.mat",
      status: "modified",
      hunks: [textHunk(barkMaterial.before, barkMaterial.after)],
    },
    {
      path: "Assets/Prefabs/Tree.prefab",
      status: "modified",
      hunks: [textHunk(treePrefab.before, treePrefab.after)],
    },
    {
      path: "Assets/Scenes/Forest.unity",
      status: "modified",
      hunks: [textHunk(forestScene.before, forestScene.after)],
    },
    {
      path: "Assets/Textures/Grass.png.meta",
      status: "modified",
      hunks: [textHunk(grassMeta.before, grassMeta.after)],
    },
  ];
}

const pointerText = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** A texturing pass: every kind of file a preview has to cope with. */
function artPass(): FileChange[] {
  const binary = (path: string, status: FileChange["status"] = "modified") => ({
    path,
    status,
    hunks: [],
    binary: true,
  });
  return [
    binary("Assets/Textures/Moss.tga"),
    binary("Assets/Art/Poster.psd"),
    {
      // Git LFS keeps the real file elsewhere; Git itself diffs the pointers.
      path: "Assets/Art/Cliffs.psd",
      status: "modified",
      hunks: [
        textHunk(
          pointerText(cliffPointers.before),
          pointerText(cliffPointers.after),
        ),
      ],
    },
    binary("Assets/Animations/Hero@Wave.fbx", "added"),
    binary("Assets/Textures/Bark_Old.png", "deleted"),
    binary("Assets/Audio/Wind.wav"),
    binary("Assets/Scenes/Cave.unity"),
    {
      path: "Assets/Settings/URP-HighFidelity.asset",
      status: "modified",
      hunks: [textHunk(pipelineAsset.before, pipelineAsset.after)],
    },
  ];
}

const encode = (text: string) => new TextEncoder().encode(text);

/** Contents of the sample art files: the version before a change, or after it. */
export function sampleFile(
  path: string,
  before: boolean,
): Uint8Array | null | undefined | Promise<Uint8Array | null> {
  const pick = <T>(pair: { before: T; after: T }) =>
    before ? pair.before : pair.after;
  switch (path) {
    case "Assets/Textures/Bark.png":
      return paintBark(!before);
    case "Assets/Textures/Bark_Old.png":
      return paintBark(false);
    case "Assets/Textures/Bark_Normal.png":
      return paintBarkNormal();
    case "Assets/Models/Crate.fbx":
      return encode(pick(crateModel));
    case "Assets/Materials/Bark.mat":
      return encode(pick(barkMaterial));
    case "Assets/Prefabs/Tree.prefab":
      return encode(pick(treePrefab));
    case "Assets/Scenes/Forest.unity":
      return encode(pick(forestScene));
    case "Assets/Textures/Grass.png.meta":
      return encode(pick(grassMeta));
    case "Assets/Textures/Moss.tga":
      return paintMoss(!before);
    case "Assets/Art/Poster.psd":
      return paintPoster(!before);
    case "Assets/Art/Cliffs.psd":
      return pick(cliffPointers);
    case "Assets/Animations/Hero@Wave.fbx":
      return encode(heroWave);
    case "Assets/Audio/Wind.wav":
      return windSound(!before);
    case "Assets/Scenes/Cave.unity":
      return binaryScene(!before);
    case "Assets/Settings/URP-HighFidelity.asset":
      return encode(pick(pipelineAsset));
  }
}

export function workingChanges(): FileChange[] {
  return [
    {
      path: "Assets/Scripts/Player/PlayerController.cs",
      status: "modified",
      hunks: [
        {
          header:
            "@@ -12,12 +12,13 @@  public class PlayerController : MonoBehaviour",
          staged: false,
          lines: lines(
            [
              '    [Header("Movement")]',
              "    [SerializeField] private float moveSpeed = 5f;",
            ],
            ["    [SerializeField] private float jumpForce = 8f;"],
            [
              "    [SerializeField] private float jumpHeight = 2f;",
              "    [SerializeField] private float gravity = -9.81f;",
            ],
            [
              "",
              "    private CharacterController controller;",
              "    private Vector3 velocity;",
              "    private bool isGrounded;",
              "",
              "    private void Awake()",
              "    {",
              "        controller = GetComponent<CharacterController>();",
              "    }",
            ],
          ),
        },
        {
          header: "@@ -29,11 +33,14 @@  private void Update()",
          staged: false,
          lines: lines(
            ["    {", "        isGrounded = controller.isGrounded;", ""],
            ["        if (isGrounded) velocity.y = 0f;"],
            [
              "        if (isGrounded && velocity.y < 0)",
              "        {",
              "            velocity.y = -2f;",
              "        }",
            ],
            [
              "",
              '        float horizontal = Input.GetAxis("Horizontal");',
              '        float vertical = Input.GetAxis("Vertical");',
              "        Vector3 move = transform.right * horizontal",
              "                     + transform.forward * vertical;",
              "        controller.Move(move * moveSpeed * Time.deltaTime);",
              "    }",
            ],
          ),
        },
      ],
    },
    {
      path: "Assets/Scripts/Camera/CameraController.cs",
      status: "modified",
      hunks: [
        {
          header: "@@ -8,4 +8,5 @@  LateUpdate()",
          staged: false,
          lines: lines(
            ["    private void LateUpdate()", "    {"],
            ["        transform.position = target.position + offset;"],
            [
              "        Vector3 destination = target.position + offset;",
              "        transform.position = Vector3.Lerp(transform.position, destination, damping * Time.deltaTime);",
            ],
            ["    }"],
          ),
        },
      ],
    },
    {
      path: "Assets/Scripts/Input/InputManager.cs",
      status: "added",
      hunks: [
        {
          header: "@@ -0,0 +1,9 @@",
          staged: false,
          lines: lines(
            [],
            [],
            [
              "using UnityEngine;",
              "",
              "public class InputManager : MonoBehaviour",
              "{",
              "    public Vector2 Movement => new Vector2(",
              '        Input.GetAxisRaw("Horizontal"),',
              '        Input.GetAxisRaw("Vertical")',
              "    );",
              "}",
            ],
            [],
          ),
        },
      ],
    },
    {
      path: "Packages/manifest.json",
      status: "modified",
      hunks: [
        {
          header: "@@ -1,5 +1,5 @@",
          staged: false,
          lines: lines(
            ["{", '  "dependencies": {'],
            ['    "com.unity.inputsystem": "1.7.0"'],
            ['    "com.unity.inputsystem": "1.8.2"'],
            ["  }", "}"],
          ),
        },
      ],
    },
    {
      path: "Assets/Scripts/Input/LegacyInput.cs",
      status: "deleted",
      hunks: [
        {
          header: "@@ -1,4 +0,0 @@",
          staged: false,
          lines: lines(
            [],
            [
              "public static class LegacyInput",
              "{",
              "    public static float Speed = 5f;",
              "}",
            ],
            [],
            [],
          ),
        },
      ],
    },
    {
      path: "README.md",
      status: "modified",
      hunks: [
        {
          header: "@@ -4,3 +4,5 @@",
          staged: false,
          lines: lines(
            ["## Getting started", ""],
            ["Open the project in Unity."],
            [
              "Open the project in Unity 6.",
              "Use WASD to move and Space to jump.",
              "A gamepad is supported through the Input System.",
            ],
            [],
          ),
        },
      ],
    },
    {
      path: "Assets/Settings/DefaultSettings.json",
      status: "added",
      hunks: [
        {
          header: "@@ -0,0 +1,5 @@",
          staged: false,
          lines: lines(
            [],
            [],
            [
              "{",
              '  "sensitivity": 1.5,',
              '  "invertY": false,',
              '  "smoothing": true',
              "}",
            ],
            [],
          ),
        },
      ],
    },
    {
      path: "Assets/Shaders/PlayerOutline.shader",
      status: "modified",
      hunks: [
        {
          header: "@@ -2,4 +2,4 @@",
          staged: false,
          lines: lines(
            ["Properties", "{"],
            ['    _OutlineWidth ("Width", Float) = 0.01'],
            ['    _OutlineWidth ("Width", Float) = 0.02'],
            ["}"],
          ),
        },
      ],
    },
    {
      path: ".github/workflows/ci.yml",
      status: "modified",
      hunks: [
        {
          header: "@@ -1,4 +1,4 @@",
          staged: false,
          lines: lines(
            ["name: Unity checks", "on: [push, pull_request]"],
            ["timeout-minutes: 10"],
            ["timeout-minutes: 20"],
            [],
          ),
        },
      ],
    },
    {
      path: "Assets/Scripts/Input/InputManager.cs.meta",
      status: "added",
      hunks: [
        {
          header: "@@ -0,0 +1,3 @@",
          staged: false,
          lines: lines(
            [],
            [],
            [
              "fileFormatVersion: 2",
              "guid: 5b2f0c41a7e94d1c9f3e8a6d2c7b1e04",
              "MonoImporter:",
            ],
            [],
          ),
        },
      ],
    },
    {
      path: "Assets/Scripts/Input/LegacyInput.cs.meta",
      status: "deleted",
      hunks: [
        {
          header: "@@ -1,2 +0,0 @@",
          staged: false,
          lines: lines(
            [],
            ["fileFormatVersion: 2", "guid: 9a41e2b7c0d34f5e8b1a6c3d7e2f9b10"],
            [],
            [],
          ),
        },
      ],
    },
    {
      path: "Assets/Textures/Bark.png.meta",
      status: "modified",
      hunks: [
        {
          header: "@@ -54,6 +54,6 @@  platformSettings:",
          staged: false,
          lines: lines(
            [
              "  - serializedVersion: 3",
              "    buildTarget: DefaultTexturePlatform",
            ],
            ["    maxTextureSize: 1024"],
            ["    maxTextureSize: 2048"],
            ["    resizeAlgorithm: 0", "    textureFormat: -1"],
          ),
        },
      ],
    },
    {
      path: "Assets/Textures/Bark_Normal.png.meta",
      status: "modified",
      hunks: [
        {
          header: "@@ -36,6 +36,6 @@ TextureImporter:",
          staged: false,
          lines: lines(
            ["  spriteTessellationDetail: -1"],
            ["  textureType: 0"],
            ["  textureType: 1"],
            ["  textureShape: 1", "  singleChannelComponent: 0"],
          ),
        },
      ],
    },
    {
      path: "Assets/Settings.meta",
      status: "added",
      hunks: [
        {
          header: "@@ -0,0 +1,3 @@",
          staged: false,
          lines: lines(
            [],
            [],
            [
              "fileFormatVersion: 2",
              "guid: c8e3a1f5b6d24e7a9c0b2d4f6a8e1c37",
              "folderAsset: yes",
            ],
            [],
          ),
        },
      ],
    },
    ...artChanges(),
  ];
}

const profileFiles = (): FileChange[] =>
  (
    [
      ["Assets/Input/Profiles/XboxController.json", "xbox", 1.0],
      ["Assets/Input/Profiles/DualSenseController.json", "dualsense", 0.85],
      ["Assets/Input/Profiles/SwitchProController.json", "switch-pro", 0.9],
      ["Assets/Input/Profiles/KeyboardMouse.json", "keyboard-mouse", 1.0],
      ["Assets/Input/Bindings/InventoryNavigation.json", "inventory", 0.75],
      ["Assets/Input/Bindings/MenuNavigation.json", "menu", 0.8],
      ["Assets/Input/Settings/Accessibility.json", "accessible", 0.65],
      ["Assets/Input/Settings/DeadZoneSettings.json", "dead-zones", 0.15],
      ["Assets/UI/Localization/GamepadHints.json", "en", 1.0],
    ] as const
  ).map(([path, profile, sensitivity]) => ({
    path,
    status: "added" as const,
    hunks: [
      {
        header: "@@ -0,0 +1,8 @@",
        staged: false,
        lines: lines(
          [],
          [],
          [
            "{",
            `  "profile": "${profile}",`,
            `  "sensitivity": ${sensitivity},`,
            '  "navigation": {',
            '    "repeatDelay": 0.25,',
            '    "wrapAround": true',
            "  }",
            "}",
          ],
          [],
        ),
      },
    ],
  }));

const commit = (
  sha: string,
  summary: string,
  author: Person,
  date: number,
  parents: string[],
  description = "",
): Commit => ({ sha, summary, description, author, date, parents });

/** Newest first, as `git log` lists them. */
export function history(): Commit[] {
  return [
    commit(
      "a7c92e1",
      "Improve camera follow smoothing",
      people.alex,
      minutes(12),
      ["b3f18d0"],
    ),
    commit("b3f18d0", "Merge branch feature/input", people.alex, hours(1), [
      "f1b03c7",
      "d84e2a9",
    ]),
    commit(
      "d84e2a9",
      "Add gamepad input support",
      people.jamie,
      hours(2),
      ["f1b03c7"],
      "Controller profiles for Xbox, DualSense and Switch Pro, plus navigation bindings for menus and the inventory.",
    ),
    {
      ...commit(
        "f1b03c7",
        "Set up player movement and collision",
        people.alex,
        days(1),
        ["c5d2f80"],
      ),
      refs: ["main", "origin/main"],
    },
    commit(
      "c5d2f80",
      "Texture pass: moss, cliffs, poster and a waving hero",
      people.mira,
      hours(25),
      ["e29a641"],
      "Moss is greener, the cliff source got a sky layer, the poster says FOREST now. Old bark texture removed.",
    ),
    commit(
      "e29a641",
      "Add outline shader for interactable objects",
      people.jamie,
      hours(27),
      ["82c6b05"],
    ),
    commit(
      "82c6b05",
      "Configure automated editor tests",
      people.alex,
      days(2),
      ["4d791e2"],
    ),
    commit(
      "4d791e2",
      "Create base scene and project structure",
      people.alex,
      days(3),
      [],
    ),
  ];
}

/** File snapshots for commits; commits without an entry get a small sample. */
export function commitContents(): Map<string, FileChange[]> {
  const changes = workingChanges();
  const gamepad = [...changes.slice(0, 4), changes[5], ...profileFiles()];
  return new Map([
    ["a7c92e1", gamepad],
    ["d84e2a9", gamepad],
    ["f1b03c7", artChanges()],
    ["c5d2f80", artPass()],
  ]);
}

export function sampleContents(seed: number): FileChange[] {
  const changes = workingChanges();
  return [changes[seed % changes.length], changes[(seed + 1) % changes.length]];
}

export function stashes() {
  const changes = workingChanges();
  return [
    {
      message: "WIP: inventory interaction",
      branch: "feature/player-movement",
      date: hours(2),
      files: [
        changes[2],
        changes[3],
        changes.find((c) => c.path === "Assets/Textures/Bark.png")!,
      ],
    },
    {
      message: "Before camera refactor",
      branch: "feature/player-movement",
      date: days(1),
      files: [changes[1], changes[3]],
    },
  ];
}

/** Commits waiting on the remote; Pull brings them in. */
export function incoming(): Omit<Commit, "parents">[] {
  return [
    {
      sha: "82fb1a0",
      summary: "Update shared input profiles",
      description: "",
      author: people.jamie,
      date: minutes(5),
    },
    {
      sha: "93cd2b1",
      summary: "Add controller navigation hints",
      description: "",
      author: people.sam,
      date: minutes(6),
    },
  ];
}

/** Ahead/behind counts relative to main for the sample branches. */
export const divergence: Record<string, [ahead: number, behind: number]> = {
  develop: [5, 0],
  "feature/player-movement": [3, 1],
  "fix/camera-jitter": [1, 2],
};
