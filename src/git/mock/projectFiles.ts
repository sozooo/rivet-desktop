/**
 * The rest of the sample Unity project: files its history never touches but
 * any project of its kind holds, so search has something real to look through.
 */
const ASSETS = [
  "Assets/Scenes/Main.unity",
  "Assets/Scenes/Menu.unity",
  "Assets/Scenes/Cave.unity",
  "Assets/Scripts/Core/GameManager.cs",
  "Assets/Scripts/Core/SaveSystem.cs",
  "Assets/Scripts/Enemies/EnemyAI.cs",
  "Assets/Scripts/Enemies/EnemySpawner.cs",
  "Assets/Scripts/Inventory/Inventory.cs",
  "Assets/Scripts/Inventory/InventorySlot.cs",
  "Assets/Scripts/Inventory/ItemData.cs",
  "Assets/Scripts/UI/HealthBar.cs",
  "Assets/Scripts/UI/MainMenu.cs",
  "Assets/Scripts/UI/PauseMenu.cs",
  "Assets/Scripts/Audio/AudioManager.cs",
  "Assets/Prefabs/Player.prefab",
  "Assets/Prefabs/Enemies/Wolf.prefab",
  "Assets/Prefabs/Environment/Bush.prefab",
  "Assets/Prefabs/Environment/Rock_Large.prefab",
  "Assets/Prefabs/UI/HUD.prefab",
  "Assets/Models/Characters/Hero.fbx",
  "Assets/Models/Characters/Wolf.fbx",
  "Assets/Models/Environment/Bush.fbx",
  "Assets/Models/Environment/Rock_Large.fbx",
  "Assets/Textures/Characters/Hero_Albedo.png",
  "Assets/Textures/Characters/Hero_Normal.png",
  "Assets/Textures/Characters/Wolf_Albedo.png",
  "Assets/Textures/Environment/Rock_Albedo.png",
  "Assets/Textures/Environment/Rock_Normal.png",
  "Assets/Textures/UI/Icons/Potion.png",
  "Assets/Textures/UI/Icons/Shield.png",
  "Assets/Textures/UI/Icons/Sword.png",
  "Assets/Materials/Hero.mat",
  "Assets/Materials/Moss.mat",
  "Assets/Materials/Rock.mat",
  "Assets/Materials/Wolf.mat",
  "Assets/Animations/Hero.controller",
  "Assets/Animations/Hero@Idle.fbx",
  "Assets/Animations/Hero@Jump.fbx",
  "Assets/Animations/Hero@Run.fbx",
  "Assets/Animations/Wolf.controller",
  "Assets/Audio/Music/Forest_Theme.ogg",
  "Assets/Audio/SFX/Footstep_Grass_01.wav",
  "Assets/Audio/SFX/Footstep_Grass_02.wav",
  "Assets/Audio/SFX/Sword_Swing.wav",
  "Assets/Shaders/Foliage.shadergraph",
  "Assets/Shaders/Water.shader",
  "Assets/Art/Concepts/Forest_Concept.psd",
  "Assets/Art/Concepts/Hero_Concept.psd",
  "Assets/Fonts/Onest-Regular.ttf",
  "Assets/Settings/URP-Performant.asset",
];

const OUTSIDE_ASSETS = [
  ".gitattributes",
  ".gitignore",
  "Art/Rock.blend",
  "Art/Tree.blend",
  "Packages/manifest.json",
  "Packages/packages-lock.json",
  "ProjectSettings/EditorBuildSettings.asset",
  "ProjectSettings/GraphicsSettings.asset",
  "ProjectSettings/InputManager.asset",
  "ProjectSettings/ProjectSettings.asset",
  "ProjectSettings/ProjectVersion.txt",
  "ProjectSettings/QualitySettings.asset",
  "ProjectSettings/TagManager.asset",
];

/** Unity gives every file and folder under Assets a .meta file. */
export function withMetaFiles(paths: Iterable<string>) {
  const all = new Set(paths);
  for (const path of [...all]) {
    if (!path.startsWith("Assets/") || path.endsWith(".meta")) continue;
    all.add(`${path}.meta`);
    for (let end = path.lastIndexOf("/"); end > 6;) {
      all.add(`${path.slice(0, end)}.meta`);
      end = path.lastIndexOf("/", end - 1);
    }
  }
  return all;
}

export const projectFiles = () => [...ASSETS, ...OUTSIDE_ASSETS];

const AREAS = ["Forest", "Cave", "Village", "Castle", "Swamp", "Desert"];
const KINDS: [folder: string, extension: string][] = [
  ["Textures", "png"],
  ["Models", "fbx"],
  ["Materials", "mat"],
  ["Prefabs", "prefab"],
  ["Audio", "wav"],
  ["Scripts", "cs"],
];
const WORDS = [
  "Rock",
  "Tree",
  "Bush",
  "Moss",
  "Log",
  "Fence",
  "Barrel",
  "Crate",
  "Torch",
  "Lantern",
  "Bridge",
  "Cliff",
  "Mushroom",
  "Fern",
  "Stone",
  "Roof",
  "Wall",
  "Door",
  "Banner",
  "Chest",
];
const SUFFIXES = ["", "_Albedo", "_Normal", "_Mask", "_Large", "_Small"];

/**
 * `?files=<n>` in the browser demo: a project with about n more files (half
 * of them .meta files), the same every time, to try search on a big project.
 */
export function bulkFiles(count: number) {
  const files: string[] = [];
  let seed = 7;
  const next = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    // The high bits: an LCG's low ones repeat after a few steps.
    return Math.floor((seed / 2147483648) * n);
  };
  for (let i = 0; files.length < count; i++) {
    const [folder, extension] = KINDS[next(KINDS.length)];
    const area = AREAS[next(AREAS.length)];
    const name = `${WORDS[next(WORDS.length)]}${WORDS[next(WORDS.length)]}${SUFFIXES[next(SUFFIXES.length)]}_${String(i).padStart(5, "0")}`;
    const path = `Assets/Environment/${area}/${folder}/${name}.${extension}`;
    files.push(path, `${path}.meta`);
  }
  return files.slice(0, count);
}
