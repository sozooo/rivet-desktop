import type { Commit, DiffLine, FileChange, Person } from "../types";

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
} satisfies Record<string, Person>;

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
        ["e29a641"],
      ),
      refs: ["main", "origin/main"],
    },
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
      files: [changes[2], changes[3]],
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
