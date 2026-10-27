import { useEffect, useRef, useState } from "react";
import type { GitBackend } from "./git/backend";
import { MockBackend } from "./git/mock/MockBackend";
import {
  loadRepositories,
  saveRepositories,
  type Repository,
} from "./repositories";
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

export function App() {
  const [repositories, setRepositories] = useState(loadRepositories);
  const [activeId, setActiveId] = useStoredState(
    "rivet.activeRepository",
    repositories[0].id,
  );
  const [theme, setTheme] = useStoredState<ThemePreference>(
    "rivet.theme",
    "system",
  );
  const systemDark = useSystemDark();
  const dark = theme === "dark" || (theme === "system" && systemDark);
  // Each repository keeps its backend, and with it its working state, while you switch.
  const backends = useRef(new Map<string, GitBackend>());

  const repository =
    repositories.find((r) => r.id === activeId) ?? repositories[0];
  let backend = backends.current.get(repository.id);
  if (!backend) {
    backend = new MockBackend(
      repository.kind === "create" ? "empty" : "sample",
    );
    backends.current.set(repository.id, backend);
  }

  const update = (next: Repository[]) => {
    setRepositories(next);
    saveRepositories(next);
  };

  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <ToastProvider>
        <Workspace
          key={repository.id}
          repository={repository}
          repositories={repositories}
          backend={backend}
          dark={dark}
          theme={theme}
          setTheme={setTheme}
          onSwitchRepository={setActiveId}
          onAddRepository={(r) => {
            update([...repositories, r]);
            setActiveId(r.id);
          }}
          onRemoveRepository={(id) => {
            const next = repositories.filter((r) => r.id !== id);
            if (!next.length) return;
            backends.current.delete(id);
            update(next);
            if (id === repository.id) setActiveId(next[0].id);
          }}
        />
      </ToastProvider>
    </div>
  );
}
