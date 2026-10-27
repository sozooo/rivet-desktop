import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useI18n } from "../i18n/i18n";

type Tone = "success" | "error";
type Notify = (message: string, tone?: Tone) => void;

const ToastContext = createContext<Notify>(() => {});
export const useNotify = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: Tone }>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { t } = useI18n();
  const notify = useCallback<Notify>((message, tone = "success") => {
    clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(
      () => setToast(undefined),
      tone === "error" ? 6000 : 3500,
    );
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && (
        <div
          className={`toast ${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          {toast.tone === "error" ? (
            <AlertCircle size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {toast.message}
          <button
            className="icon-button"
            aria-label={t("common.dismiss")}
            onClick={() => setToast(undefined)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
