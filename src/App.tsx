import { useEffect, useRef, useState } from "react";
import type { GitBackend } from "./git/backend";
import { CliBackend } from "./git/cli/CliBackend";
import { tauriRunner } from "./git/cli/tauriRunner";
import { MockBackend } from "./git/mock/MockBackend";
import { platform } from "./platform";
import {
  demoRepositories,
  loadRepositories,
  saveRepositories,
  type Repository,
} from "./repositories";
import { RepositorySetup } from "./setup/RepositorySetup";
import { useStoredState } from "./ui/hooks";
import { ToastProvider } from "./ui/Toast";
import { Workspace } from "./Workspace";

export type ThemePreference = "light" | "dark" | "system";

function useSystemDark() {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return dark;
}

/** Real repositories run git in the desktop app; demo ones (and the browser build) use sample data. */
function createBackend(repository: Repository): GitBackend {
  if (platform.desktop && repository.kind !== "demo")
    return new CliBackend(tauriRunner(repository.path));
  return new MockBackend(repository.kind === "create" ? "empty" : "sample");
}

export function App() {
  // The desktop app starts empty and asks for a repository; the browser build shows samples.
  const [repositories, setRepositories] = useState(() =>
    loadRepositories(platform.desktop ? [] : demoRepositories),
  );
  const [activeId, setActiveId] = useStoredState<string | null>(
    "rivet.activeRepository",
    repositories[0]?.id ?? null,
  );
  const [theme, setTheme] = useStoredState<ThemePreference>(
    "rivet.theme",
    "system",
  );
  const systemDark = useSystemDark();
  const dark = theme === "dark" || (theme === "system" && systemDark);
  // Each repository keeps its backend, and with it its working state, while you switch.
  const backends = useRef(new Map<string, GitBackend>());

  const update = (next: Repository[]) => {
    setRepositories(next);
    saveRepositories(next);
  };
  const add = (r: Repository) => {
    update([...repositories, r]);
    setActiveId(r.id);
  };

  const repository =
    repositories.find((r) => r.id === activeId) ?? repositories[0];
  let backend = repository && backends.current.get(repository.id);
  if (repository && !backend) {
    backend = createBackend(repository);
    backends.current.set(repository.id, backend);
  }

  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <ToastProvider>
        {repository && backend ? (
          <Workspace
            key={repository.id}
            repository={repository}
            repositories={repositories}
            backend={backend}
            dark={dark}
            theme={theme}
            setTheme={setTheme}
            onSwitchRepository={setActiveId}
            onAddRepository={add}
            onRemoveRepository={(id) => {
              const next = repositories.filter((r) => r.id !== id);
              backends.current.delete(id);
              update(next);
              if (id === repository.id) setActiveId(next[0]?.id ?? null);
            }}
          />
        ) : (
          <RepositorySetup
            initialMode="open"
            repositories={repositories}
            onComplete={add}
          />
        )}
      </ToastProvider>
    </div>
  );
}
