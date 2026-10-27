/** A repository found on this computer that can be added in one click. */
export type FoundRepository = {
  name: string;
  path: string;
  source: "Unity Hub" | "SourceGit" | "Projects folder";
  branch: string;
  unity?: string;
};

/**
 * Operating-system services. The browser build returns sample data; the
 * desktop build will open a native folder dialog and scan Unity Hub's project
 * list, SourceGit's repository list and the projects folder.
 */
export interface Platform {
  pickFolder(): Promise<string | null>;
  discoverRepositories(): Promise<FoundRepository[]>;
}

export const platform: Platform = {
  async pickFolder() {
    return "D:\\Projects\\kinetic-art";
  },
  async discoverRepositories() {
    return [
      {
        name: "kinetic-art",
        path: "D:\\Projects\\kinetic-art",
        source: "Unity Hub",
        branch: "main",
        unity: "6000.0.32f1",
      },
      {
        name: "kinetic",
        path: "D:/Projects/kinetic",
        source: "Unity Hub",
        branch: "feature/player-movement",
        unity: "6000.0.32f1",
      },
      {
        name: "tiny-tanks",
        path: "D:\\Projects\\tiny-tanks",
        source: "Projects folder",
        branch: "main",
        unity: "2022.3.48f1",
      },
      {
        name: "shader-lab",
        path: "D:\\Work\\shader-lab",
        source: "SourceGit",
        branch: "develop",
      },
    ];
  },
};
