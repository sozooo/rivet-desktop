import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import { useI18n } from "../i18n/i18n";

type Tone = "success" | "info" | "warning" | "error";
export type ToastAction = { label: string; run: () => void };
type Options = {
  /** A button on the toast, e.g. Undo or Try again. */
  action?: ToastAction;
  /** Raw text behind "Details", for full mode. */
  details?: string;
  /** Wait for the toast on screen to go away instead of replacing it. */
  queue?: boolean;
};
type Notify = (message: string, tone?: Tone, options?: Options) => void;
type Toast = {
  message: string;
  tone: Tone;
  action?: ToastAction;
  details?: string;
};

const ToastContext = createContext<Notify>(() => {});
export const useNotify = () => useContext(ToastContext);

/** Toasts with a button or details stay long enough to reach them. */
const lifetime = (toast: Toast) =>
  toast.action || toast.details
    ? 12000
    : toast.tone === "success"
      ? 3500
      : 7000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showing = useRef(false);
  /** The latest queued toast; older ones are out of date by then. */
  const queued = useRef<Toast>(undefined);
  const { t } = useI18n();

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    const next = queued.current;
    queued.current = undefined;
    showing.current = !!next;
    setToast(next);
    setOpen(false);
    if (next) timer.current = setTimeout(hide, lifetime(next));
  }, []);
  const hideLater = useCallback(
    (shown: Toast) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(hide, lifetime(shown));
    },
    [hide],
  );
  const notify = useCallback<Notify>(
    (message, tone = "success", { queue, ...extras } = {}) => {
      const next = { message, tone, ...extras };
      if (queue && showing.current) {
        queued.current = next;
        return;
      }
      showing.current = true;
      setToast(next);
      setOpen(false);
      hideLater(next);
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
          ) : toast.tone === "info" ? (
            <Info size={16} />
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
              className="button toast-action"
              onClick={() => {
                const { run } = toast.action!;
                hide();
                run();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            className="icon-button"
            aria-label={t("common.dismiss")}
            onClick={hide}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
