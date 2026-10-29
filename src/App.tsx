import { useEffect, useRef, useState } from "react";
import type { GitBackend } from "./git/backend";
import { CliBackend } from "./git/cli/CliBackend";
import { tauriRunner } from "./git/cli/tauriRunner";
import { MockBackend } from "./git/mock/MockBackend";
import { ErrorBoundary } from "./errors/ErrorBoundary";
import { withDemoFailures } from "./errors/demoFailure";
import { AccountProvider } from "./github/account";
import { I18nProvider, type Language, type UiMode } from "./i18n/i18n";
import { GitCheck } from "./onboarding/GitCheck";
import { IdentityProvider } from "./onboarding/identity";
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
import { UpdatesProvider } from "./updates/updates";
import { Workspace } from "./Workspace";

export type ThemePreference = "light" | "dark" | "system";

/** Settings that apply to every repository. */
export type Preferences = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  mode: UiMode;
  setMode: (mode: UiMode) => void;
};

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
  return withDemoFailures(
    new MockBackend(
      repository.kind === "create" ? "empty" : "sample",
      repository.id,
    ),
  );
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
  const [language, setLanguage] = useStoredState<Language>(
    "rivet.language",
    "ru",
  );
  // New installs start simple; developers switch to full in Settings.
  const [mode, setMode] = useStoredState<UiMode>("rivet.mode", "simple");
  const preferences: Preferences = {
    theme,
    setTheme,
    language,
    setLanguage,
    mode,
    setMode,
  };
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
    <div className={`app ${dark ? "dark" : ""}`} lang={language}>
      <I18nProvider language={language} mode={mode}>
        <ErrorBoundary>
          <UpdatesProvider>
            <ToastProvider>
              <AccountProvider>
                <GitCheck>
                  <IdentityProvider prompt={!!repository}>
                    {repository && backend ? (
                      <Workspace
                        key={repository.id}
                        repository={repository}
                        repositories={repositories}
                        backend={backend}
                        dark={dark}
                        preferences={preferences}
                        onSwitchRepository={setActiveId}
                        onAddRepository={add}
                        onRemoveRepository={(id) => {
                          const next = repositories.filter((r) => r.id !== id);
                          backends.current.delete(id);
                          update(next);
                          if (id === repository.id)
                            setActiveId(next[0]?.id ?? null);
                        }}
                      />
                    ) : (
                      <RepositorySetup
                        initialMode="open"
                        repositories={repositories}
                        onComplete={add}
                      />
                    )}
                  </IdentityProvider>
                </GitCheck>
              </AccountProvider>
            </ToastProvider>
          </UpdatesProvider>
        </ErrorBoundary>
      </I18nProvider>
    </div>
  );
}
