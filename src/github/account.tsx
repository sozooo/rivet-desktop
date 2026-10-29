import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useI18n } from "../i18n/i18n";
import { useNotify } from "../ui/Toast";
import type { GitHubUser } from "./api";
import { github } from "./github";
import { SignInDialog } from "./SignInDialog";

type Account = {
  /** False when this build can't sign in (no OAuth client ID). */
  available: boolean;
  /** Undefined while the keychain is being checked on startup. */
  user: GitHubUser | null | undefined;
  /** Opens the sign-in dialog. */
  signIn: () => void;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<Account>({
  available: false,
  user: null,
  signIn: () => {},
  signOut: async () => {},
});

export const useAccount = () => useContext(AccountContext);

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** The GitHub account for the whole app, and the sign-in dialog any screen can open. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const notify = useNotify();
  const [user, setUser] = useState<GitHubUser | null>();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!github.available) return setUser(null);
    github.restore().then(setUser, () => setUser(null));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await github.signOut();
      notify(t("github.signedOut"));
    } catch (error) {
      notify(errorMessage(error), "error");
    }
    setUser(null);
  }, [notify, t]);

  const value = useMemo<Account>(
    () => ({
      available: github.available,
      user,
      signIn: () => setSigningIn(true),
      signOut,
    }),
    [user, signOut],
  );

  return (
    <AccountContext.Provider value={value}>
      {children}
      {signingIn && (
        <SignInDialog
          onClose={() => setSigningIn(false)}
          onSignedIn={(signedIn) => {
            setUser(signedIn);
            setSigningIn(false);
            notify(t("github.signedIn", { login: signedIn.login }));
          }}
        />
      )}
    </AccountContext.Provider>
  );
}
