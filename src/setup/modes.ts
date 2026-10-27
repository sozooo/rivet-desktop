import { FolderOpen, FolderPlus, GitFork } from "lucide-react";
import type { Key } from "../i18n/i18n";
import type { SetupMode } from "../repositories";

/** Labels and icons shared by the repository menu and the setup tabs. */
export const setupModeMeta: Record<
  SetupMode,
  { tab: Key; menu: Key; Icon: typeof GitFork }
> = {
  clone: { tab: "setup.tab.clone", menu: "setup.menu.clone", Icon: GitFork },
  open: { tab: "setup.tab.open", menu: "setup.menu.open", Icon: FolderOpen },
  create: {
    tab: "setup.tab.create",
    menu: "setup.menu.create",
    Icon: FolderPlus,
  },
};
