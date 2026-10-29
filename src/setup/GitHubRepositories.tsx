import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  FolderGit2,
  Github,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";
import { errorMessage, useAccount } from "../github/account";
import {
  cloneUrlFor,
  type GitHubRepository,
  type GitHubUser,
} from "../github/api";
import { github } from "../github/github";
import { useI18n } from "../i18n/i18n";
import { Avatar } from "../ui/Avatar";

/** Signed out: sign in and pick from a list instead of hunting for a link. */
export function GitHubSignInCard() {
  const { t } = useI18n();
  const { signIn } = useAccount();
  return (
    <div className="github-card">
      <Github />
      <span className="github-card-text">
        <strong>{t("setup.github.title")}</strong>
        <small>{t("setup.github.text")}</small>
      </span>
      <button type="button" className="button primary" onClick={signIn}>
        {t("github.signIn")}
      </button>
    </div>
  );
}

/** "On GitHub · @login" with an action on the right (switch between list and link). */
export function GitHubHeading({
  user,
  children,
}: {
  user: GitHubUser;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="github-heading">
      <Avatar name={user.name ?? user.login} url={user.avatarUrl} />
      <span>{t("setup.github.heading", { login: user.login })}</span>
      {children}
    </div>
  );
}

/** The list is loaded once per account while the app runs; refresh reloads it. */
let cache: { login: string; repositories: GitHubRepository[] } | undefined;

const day = 86_400_000;

export function GitHubRepositoryList({
  user,
  url,
  onPick,
  onSubmit,
  onManual,
}: {
  user: GitHubUser;
  /** The URL in the form; the repository it belongs to shows as picked. */
  url: string;
  onPick: (url: string) => void;
  onSubmit: () => void;
  onManual: () => void;
}) {
  const { t, language, timeAgo } = useI18n();
  const cached = cache?.login === user.login ? cache.repositories : undefined;
  const [repositories, setRepositories] = useState(cached);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (cached && reloads === 0) return;
    let current = true;
    setError("");
    setRepositories(undefined);
    github.repositories().then(
      (list) => {
        cache = { login: user.login, repositories: list };
        if (current) setRepositories(list);
      },
      (failure) => current && setError(errorMessage(failure)),
    );
    return () => {
      current = false;
    };
  }, [user.login, reloads]);

  const words = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      repositories?.filter((r) =>
        `${r.fullName} ${r.description ?? ""}`.toLowerCase().includes(words),
      ) ?? [],
    [repositories, words],
  );
  const updated = (date: number) =>
    Date.now() - date < 30 * day
      ? timeAgo(date)
      : new Date(date).toLocaleDateString(language, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

  const note = error ? (
    <>
      {t("setup.github.error", { message: error })}{" "}
      <button
        type="button"
        className="text-button"
        onClick={() => setReloads((n) => n + 1)}
      >
        {t("setup.github.retry")}
      </button>
    </>
  ) : !repositories ? (
    t("setup.github.loading")
  ) : !shown.length ? (
    t(repositories.length ? "setup.github.noMatches" : "setup.github.empty", {
      query: query.trim(),
    })
  ) : null;

  return (
    <div className="github-repos">
      <GitHubHeading user={user}>
        <button
          type="button"
          className="icon-button"
          title={t("setup.github.refresh")}
          aria-label={t("setup.github.refresh")}
          disabled={!repositories && !error}
          onClick={() => setReloads((n) => n + 1)}
        >
          <RefreshCw />
        </button>
        <button type="button" className="text-button" onClick={onManual}>
          {t("setup.github.manual")}
        </button>
      </GitHubHeading>
      <div className="github-search">
        <Search />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("setup.github.search")}
          aria-label={t("setup.github.search")}
        />
      </div>
      <div
        className="github-repo-list"
        role="listbox"
        aria-label={t("setup.github.title")}
        aria-busy={!repositories && !error}
      >
        {note ? (
          <p className="github-note" role={error ? "alert" : undefined}>
            {note}
          </p>
        ) : (
          shown.map((r) => {
            const cloneUrl = cloneUrlFor(r, user.login);
            const picked = url === cloneUrl;
            return (
              <button
                type="button"
                key={r.id}
                role="option"
                aria-selected={picked}
                className={`found-repo github-repo ${picked ? "picked" : ""}`}
                title={t("setup.github.updated", {
                  time: updated(r.updatedAt),
                })}
                onClick={() => onPick(cloneUrl)}
                onDoubleClick={onSubmit}
              >
                {picked ? <Check /> : <FolderGit2 />}
                <span className="found-name">
                  <strong>
                    <span className="github-owner">{r.owner}/</span>
                    {r.name}
                  </strong>
                  {r.description && <small>{r.description}</small>}
                </span>
                <span className="found-meta">
                  {r.private && (
                    <em>
                      <Lock />
                      {t("setup.github.private")}
                    </em>
                  )}
                </span>
                <span className="github-updated">{updated(r.updatedAt)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
