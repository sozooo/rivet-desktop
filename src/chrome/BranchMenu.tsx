import { useCallback, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Cloud,
  GitBranch,
  List,
  Plus,
  Search,
} from "lucide-react";
import { localName, remoteOnly } from "../git/branches";
import type { RepoSnapshot } from "../git/types";
import { useI18n } from "../i18n/i18n";
import { useDismiss } from "../ui/hooks";

/** From this many branches on, finding one by eye gets slow. */
const SEARCH_FROM = 8;

/** The current branch, and a list to switch to another one. */
export function BranchMenu({
  branches,
  blocked,
  onSwitch,
  onNewBranch,
  onAllBranches,
}: {
  branches: RepoSnapshot["branches"];
  /** Why switching has to wait, e.g. a merge in progress. */
  blocked: string | null;
  onSwitch: (target: string) => void;
  onNewBranch: () => void;
  onAllBranches: () => void;
}) {
  const { t, mode } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  useDismiss(ref, open, close);

  const full = mode === "full";
  const server = remoteOnly(branches);
  const label = (name: string) =>
    full || branches.local.includes(name) ? name : localName(name);
  const matches = (name: string) =>
    label(name).toLowerCase().includes(query.trim().toLowerCase());
  const local = branches.local.filter(matches);
  const remote = server.filter(matches);

  function pick(name: string) {
    close();
    if (name !== branches.current) onSwitch(name);
  }

  function item(name: string, onServer: boolean) {
    const current = name === branches.current;
    return (
      <button
        key={name}
        role="menuitemradio"
        aria-checked={current}
        disabled={!current && !!blocked}
        title={onServer ? t("branchMenu.remoteHint") : undefined}
        onClick={() => pick(name)}
      >
        {onServer ? <Cloud /> : <GitBranch />}
        <span>{label(name)}</span>
        {current && <Check />}
      </button>
    );
  }

  return (
    <div className="branch-wrap" ref={ref}>
      <button
        className="branch-selector"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("top.currentBranch", { branch: branches.current })}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <GitBranch />
        <span>{branches.current}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="dropdown branch-menu" role="menu">
          {branches.local.length + server.length >= SEARCH_FROM && (
            <form
              className="branch-search"
              onSubmit={(e) => {
                e.preventDefault();
                const first = [...local, ...remote].find(
                  (name) => name !== branches.current,
                );
                if (first && !blocked) pick(first);
              }}
            >
              <Search />
              <input
                autoFocus
                value={query}
                placeholder={t("branchMenu.search")}
                aria-label={t("branchMenu.search")}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
          )}
          {blocked && <p className="branch-menu-note">{blocked}</p>}
          <div className="branch-list">
            {local.length > 0 && <small>{t("branchMenu.local")}</small>}
            {local.map((name) => item(name, false))}
            {remote.length > 0 && <small>{t("branchMenu.remote")}</small>}
            {remote.map((name) => item(name, true))}
            {!local.length && !remote.length && (
              <p className="branch-menu-note">{t("branchMenu.nothing")}</p>
            )}
          </div>
          {full && (
            <div className="branch-menu-actions">
              <button
                onClick={() => {
                  close();
                  onNewBranch();
                }}
              >
                <Plus />
                {t("branchMenu.new")}
              </button>
              <button
                onClick={() => {
                  close();
                  onAllBranches();
                }}
              >
                <List />
                {t("branchMenu.all")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
