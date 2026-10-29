import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useI18n } from "../i18n/i18n";

type Tone = "success" | "warning" | "error";
type Extras = {
  /** A button next to the message, e.g. "Try again". */
  action?: { label: string; run: () => void };
  /** Raw text behind "Details", for full mode. */
  details?: string;
};
type Notify = (message: string, tone?: Tone, extras?: Extras) => void;
type Toast = { message: string; tone: Tone } & Extras;

const ToastContext = createContext<Notify>(() => {});
export const useNotify = () => useContext(ToastContext);

const lifetime = (toast: Toast) =>
  toast.tone === "success"
    ? 3500
    : toast.action || toast.details
      ? 12000
      : 7000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { t } = useI18n();
  const hideLater = useCallback((shown: Toast) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(undefined), lifetime(shown));
  }, []);
  const notify = useCallback<Notify>(
    (message, tone = "success", extras = {}) => {
      const shown = { message, tone, ...extras };
      setToast(shown);
      setOpen(false);
      hideLater(shown);
    },
    [hideLater],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && (
        <div
          className={`toast ${toast.tone} ${open ? "open" : ""}`}
          role={toast.tone === "error" ? "alert" : "status"}
          // Reading or opening the details keeps it on screen.
          onMouseEnter={() => clearTimeout(timer.current)}
          onMouseLeave={() => !open && hideLater(toast)}
        >
          {toast.tone === "error" ? (
            <AlertCircle size={16} />
          ) : toast.tone === "warning" ? (
            <AlertTriangle size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          <div className="toast-body">
            <span>{toast.message}</span>
            {open && <pre className="error-details">{toast.details}</pre>}
          </div>
          {toast.details && (
            <button
              className="text-button"
              aria-expanded={open}
              onClick={() => {
                clearTimeout(timer.current);
                setOpen(!open);
              }}
            >
              {t(open ? "error.hideDetails" : "error.details")}
            </button>
          )}
          {toast.action && (
            <button
              className="button"
              onClick={() => {
                setToast(undefined);
                toast.action!.run();
              }}
            >
              {toast.action.label}
            </button>
          )}
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
