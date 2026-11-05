import {
  Archive,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CloudUpload,
  FileDiff,
  GitBranch,
  GitMerge,
  GitPullRequestArrow,
  History,
  Keyboard,
  List,
  Plus,
  RefreshCw,
  Settings,
  SunMoon,
  type LucideIcon,
} from "lucide-react";
import type { Key, Params, UiMode } from "../i18n/i18n";
import type { RepoApi } from "../views/repoApi";

/** Search picks a branch next, for this. */
export type BranchPick = "switch" | "merge" | "rebase";

export type SearchAction = {
  id: string;
  label: string;
  /**
   * More words that find it, never shown: git's names for it, and the other
   * language's, since people type what they know.
   */
  keywords: string;
  Icon: LucideIcon;
  /** Why it can't run right now. */
  blocked?: string | null;
  /** Runs it with the workspace as it is by then, or picks a branch first. */
  run: ((repo: RepoApi) => void) | { pick: BranchPick };
};

type Translate = (key: Key, params?: Params) => string;

/** What search offers to do: only what this mode has, in the order it is used. */
export function searchActions(
  { snapshot, blocked }: Pick<RepoApi, "snapshot" | "blocked">,
  mode: UiMode,
  t: Translate,
): SearchAction[] {
  const { sync, branches, files } = snapshot;
  const full = mode === "full";
  const hasRemote = !!sync.upstream || branches.remote.length > 0;
  const branchCount = branches.local.length + branches.remote.length;
  const actions: (SearchAction | false)[] = [
    !full &&
      hasRemote && {
        id: "sync",
        label: t("search.action.sync"),
        keywords: "sync pull push fetch синхронизировать получить отправить",
        Icon: ArrowDownUp,
        blocked,
        run: (r) => void r.sync(),
      },
    full &&
      !!sync.upstream && {
        id: "fetch",
        label: t("search.action.fetch"),
        keywords: "fetch check remote server проверить сервер",
        Icon: RefreshCw,
        blocked,
        run: (r) => r.command("fetch"),
      },
    full &&
      hasRemote && {
        id: "pull",
        label: t("search.action.pull"),
        keywords: "pull получить забрать",
        Icon: ArrowDown,
        blocked: blocked ?? (sync.behind ? null : t("top.nothingToPull")),
        run: (r) => r.openOperation("pull"),
      },
    full &&
      hasRemote && {
        id: "push",
        label: t(
          sync.upstream ? "search.action.push" : "search.action.publish",
        ),
        keywords: "push publish отправить опубликовать",
        Icon: sync.upstream ? ArrowUp : CloudUpload,
        blocked:
          blocked ??
          (sync.ahead || !sync.upstream ? null : t("top.nothingToPush")),
        run: (r) => r.openOperation(sync.upstream ? "push" : "publish"),
      },
    {
      id: "stash",
      label: t("search.action.stash"),
      keywords: "stash put aside отложить спрятать",
      Icon: Archive,
      blocked: files.length ? blocked : t("search.nothingToStash"),
      run: async (r) => {
        const paths = r.snapshot.files.map((f) => f.path);
        if (await r.askBeforeRewrite(paths))
          r.act((b) => b.stash(), t("changes.stashed"));
      },
    },
    full && {
      id: "new-branch",
      label: t("branchMenu.new"),
      keywords: "new branch create новая ветка создать",
      Icon: Plus,
      run: (r) => r.openOperation("new-branch"),
    },
    branchCount > 1 && {
      id: "switch-branch",
      label: t("search.action.switch"),
      keywords: "switch checkout branch перейти переключить ветка",
      Icon: GitBranch,
      blocked,
      run: { pick: "switch" },
    },
    full &&
      branchCount > 1 && {
        id: "merge",
        label: t("search.action.merge"),
        keywords: "merge слить влить",
        Icon: GitMerge,
        run: { pick: "merge" },
      },
    full &&
      branchCount > 1 && {
        id: "rebase",
        label: t("search.action.rebase"),
        keywords: "rebase перебазировать",
        Icon: GitPullRequestArrow,
        run: { pick: "rebase" },
      },
    {
      id: "changes",
      label: t("search.action.changes"),
      keywords: "changes status изменения",
      Icon: FileDiff,
      run: (r) => r.showChanges(),
    },
    {
      id: "history",
      label: t("search.action.history"),
      keywords: "history log versions commits история версии",
      Icon: History,
      run: (r) => r.command("history"),
    },
    full && {
      id: "branches",
      label: t("search.action.branches"),
      keywords: "branches ветки",
      Icon: List,
      run: (r) => r.command("branches"),
    },
    {
      id: "settings",
      label: t("nav.settings"),
      keywords: "settings preferences options настройки параметры",
      Icon: Settings,
      run: (r) => r.command("settings"),
    },
    {
      id: "theme",
      label: t("nav.toggleTheme"),
      keywords: "theme dark light тема тёмная темная светлая",
      Icon: SunMoon,
      run: (r) => r.command("theme"),
    },
    {
      id: "shortcuts",
      label: t("shortcuts.title"),
      keywords: "shortcuts keys keyboard горячие клавиши сочетания",
      Icon: Keyboard,
      run: (r) => r.command("shortcuts"),
    },
  ];
  return actions.filter((a): a is SearchAction => !!a);
}
