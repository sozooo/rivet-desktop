import { FolderOpen, FolderPlus, GitFork } from "lucide-react";
import type { SetupMode } from "../repositories";

/** Labels and icons shared by the repository menu and the setup tabs. */
export const setupModeMeta: Record<
  SetupMode,
  { tab: string; menu: string; Icon: typeof GitFork }
> = {
  clone: { tab: "Clone", menu: "Clone repository…", Icon: GitFork },
  open: {
    tab: "Add existing",
    menu: "Add existing repository…",
    Icon: FolderOpen,
  },
  create: {
    tab: "Create new",
    menu: "Create new repository…",
    Icon: FolderPlus,
  },
};
