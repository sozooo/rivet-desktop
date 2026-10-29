import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Github } from "lucide-react";
import { errorText } from "../errors/explain";
import type { GitHubUser } from "../github/api";
import { useAccount } from "../github/account";
import { useI18n } from "../i18n/i18n";
import { platform, type Identity } from "../platform";
import { Dialog } from "../ui/Dialog";
import { useNotify } from "../ui/Toast";

type IdentityApi = {
  /** Undefined while loading, null when commits can't be signed yet. */
  identity: Identity | null | undefined;
  /** Opens the dialog; true once a name and email are saved. */
  ask: () => Promise<boolean>;
};

const IdentityContext = createContext<IdentityApi>({
  identity: undefined,
  ask: async () => false,
});

export const useIdentity = () => useContext(IdentityContext);

/** GitHub's private address for the account, so a real one isn't published in commits. */
export const noreplyEmail = (user: GitHubUser) =>
  user.id ? `${user.id}+${user.login}@users.noreply.github.com` : "";

/**
 * The name and email commits are signed with. Asks once when they're missing and a
 * project is open (by then people have usually signed in to GitHub, which fills them in),
 * and again whenever a commit fails without them.
 */
export function IdentityProvider({
  prompt,
  children,
}: {
  /** True once there is a project to save versions in. */
  prompt: boolean;
  children: ReactNode;
}) {
  const [identity, setIdentity] = useState<Identity | null>();
  const [open, setOpen] = useState(false);
  const pending = useRef<(saved: boolean) => void>(undefined);
  const prompted = useRef(false);

  useEffect(() => {
    platform.identity().then(
      (found) => setIdentity(found.name && found.email ? found : null),
      () => setIdentity(null),
    );
  }, []);

  const ask = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        pending.current?.(false);
        pending.current = resolve;
        setOpen(true);
      }),
    [],
  );
  useEffect(() => {
    if (!prompt || identity !== null || prompted.current) return;
    prompted.current = true;
    ask();
  }, [prompt, identity, ask]);

  const finish = (saved: Identity | null) => {
    if (saved) setIdentity(saved);
    setOpen(false);
    pending.current?.(!!saved);
    pending.current = undefined;
  };
  const value = useMemo(() => ({ identity, ask }), [identity, ask]);

  return (
    <IdentityContext.Provider value={value}>
      {children}
      {open && <IdentityDialog current={identity ?? null} onDone={finish} />}
    </IdentityContext.Provider>
  );
}

const validEmail = (email: string) => /^[^\s@<>]+@[^\s@<>]+$/.test(email);

function IdentityDialog({
  current,
  onDone,
}: {
  current: Identity | null;
  onDone: (saved: Identity | null) => void;
}) {
  const { t } = useI18n();
  const notify = useNotify();
  const { available, user, signIn } = useAccount();
  const noreply = user ? noreplyEmail(user) : "";
  const [name, setName] = useState(
    current?.name || user?.name || user?.login || "",
  );
  const [email, setEmail] = useState(current?.email || noreply);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Signing in from here fills in whatever is still empty.
  useEffect(() => {
    if (!user) return;
    setName((typed) => typed || user.name || user.login);
    setEmail((typed) => typed || noreplyEmail(user));
  }, [user]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const saved = { name: name.trim(), email: email.trim() };
    if (!saved.name || /[<>\n]/.test(saved.name))
      return setError(t("identity.error.name"));
    if (!validEmail(saved.email)) return setError(t("identity.error.email"));
    setBusy(true);
    try {
      await platform.setIdentity(saved);
      notify(t("identity.saved", saved));
      onDone(saved);
    } catch (failure) {
      setError(errorText(failure));
      setBusy(false);
    }
  }

  return (
    <Dialog
      eyebrow={
        current
          ? t("settings.title").toLocaleUpperCase()
          : t("identity.eyebrow")
      }
      title={t("identity.title")}
      onClose={() => onDone(null)}
      closeOnOverlay={false}
    >
      <p>{t("identity.text")}</p>
      <form className="identity-form" onSubmit={save}>
        <label>
          {t("identity.name")}
          <input
            autoFocus
            value={name}
            placeholder={t("identity.namePlaceholder")}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </label>
        <label>
          {t("identity.email")}
          <input
            value={email}
            placeholder="name@example.com"
            spellCheck={false}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
          />
        </label>
        <p className="setting-hint">
          {noreply && email.trim() === noreply
            ? t("identity.githubHint")
            : t("identity.publicHint")}
        </p>
        {available && user === null && (
          <button type="button" className="text-button" onClick={signIn}>
            <Github />
            {t("identity.fromGitHub")}
          </button>
        )}
        {noreply && email.trim() !== noreply && (
          <button
            type="button"
            className="text-button"
            onClick={() => setEmail(noreply)}
          >
            <Github />
            {t("identity.useGitHub")}
          </button>
        )}
        {error && (
          <p className="signin-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button" onClick={() => onDone(null)}>
            {t(current ? "common.cancel" : "identity.later")}
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {t("identity.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
