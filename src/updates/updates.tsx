import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { isTauri } from "@tauri-apps/api/core";

/** A newer release found on GitHub. */
export type AvailableUpdate = {
  version: string;
  notes: string;
  /** Downloads, verifies the signature, installs and restarts the app. */
  install: (onProgress: (share: number | null) => void) => Promise<void>;
};

export type UpdateState =
  | { status: "idle" | "checking" | "latest" | "unpublished" | "unavailable" }
  | { status: "available"; update: AvailableUpdate }
  | { status: "error"; error: string };

export async function currentVersion(): Promise<string> {
  if (!isTauri()) return __APP_VERSION__;
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

async function checkForUpdate(): Promise<AvailableUpdate | null> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    notes: update.body?.trim() ?? "",
    install: async (onProgress) => {
      let total = 0,
        received = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        else if (event.event === "Progress") {
          received += event.data.chunkLength;
          onProgress(total ? received / total : null);
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}

// Check soon after launch, then a few times a day for people who never close the app.
const FIRST_CHECK = 5_000;
const RECHECK = 6 * 60 * 60 * 1000;

type Updates = { state: UpdateState; version: string; check: () => void };

const UpdatesContext = createContext<Updates>({
  state: { status: "unavailable" },
  version: __APP_VERSION__,
  check: () => {},
});
export const useUpdates = () => useContext(UpdatesContext);

export function UpdatesProvider({ children }: { children: ReactNode }) {
  // The browser build has nothing to update.
  const desktop = isTauri();
  const [state, setState] = useState<UpdateState>({
    status: desktop ? "idle" : "unavailable",
  });
  const [version, setVersion] = useState(__APP_VERSION__);

  const check = useCallback(() => {
    if (!desktop) return;
    setState({ status: "checking" });
    checkForUpdate()
      .then((update) =>
        setState(
          update ? { status: "available", update } : { status: "latest" },
        ),
      )
      .catch((error: unknown) =>
        setState(
          // GitHub answered, but there is no release with latest.json yet.
          /valid release JSON/.test(String(error))
            ? { status: "unpublished" }
            : { status: "error", error: String(error) },
        ),
      );
  }, [desktop]);

  useEffect(() => {
    currentVersion().then(setVersion);
    if (!desktop) return;
    const first = setTimeout(check, FIRST_CHECK);
    const again = setInterval(check, RECHECK);
    return () => {
      clearTimeout(first);
      clearInterval(again);
    };
  }, [desktop, check]);

  return (
    <UpdatesContext.Provider value={{ state, version, check }}>
      {children}
    </UpdatesContext.Provider>
  );
}
