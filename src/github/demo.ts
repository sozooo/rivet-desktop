import type { GitHubRepository, GitHubUser } from "./api";

const avatar = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#e3d3b4"/><circle cx="20" cy="16" r="7" fill="#9a7b4f"/><path d="M5 40c2-9 8-13 15-13s13 4 15 13z" fill="#9a7b4f"/></svg>`;

/** The account the browser demo signs in to. */
export const demoUser: GitHubUser = {
  id: 48213077,
  login: "alexkim-art",
  name: "Alex Kim",
  avatarUrl: `data:image/svg+xml,${encodeURIComponent(avatar)}`,
};

const day = 86_400_000;
const samples: [string, boolean, string | null, number][] = [
  ["alexkim-art/kinetic-art", true, "Art, animation and VFX for Kinetic", 0.1],
  [
    "kinetic-studio/kinetic",
    true,
    "Kinetic: a physics puzzle game (Unity 6)",
    1,
  ],
  ["kinetic-studio/kinetic-sandbox", true, "Prototypes and experiments", 3],
  ["alexkim-art/portfolio", false, "Turntables and renders", 9],
  ["kinetic-studio/tiny-tanks", true, "Couch multiplayer tank battles", 21],
  ["alexkim-art/brush-presets", false, "Photoshop and Substance brushes", 40],
  ["kinetic-studio/shader-lab", true, "URP shader experiments", 64],
  ["alexkim-art/low-poly-props", false, null, 130],
  ["kinetic-studio/ui-kit", true, "Shared UI sprites and fonts", 210],
  ["alexkim-art/blender-addons", false, "Small Blender helpers", 420],
  ["kinetic-studio/game-jam-2024", false, "48 hours, one dragon", 700],
];

/** Repositories of the demo account, dated relative to now. */
export const demoRepositories = (now = Date.now()): GitHubRepository[] =>
  samples.map(([fullName, isPrivate, description, daysAgo], index) => {
    const [owner, name] = fullName.split("/");
    return {
      id: index + 1,
      fullName,
      name,
      owner,
      private: isPrivate,
      description,
      updatedAt: now - daysAgo * day,
      cloneUrl: `https://github.com/${fullName}.git`,
    };
  });
