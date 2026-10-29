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
  /** A button on the toast, e.g. Undo. */
  action?: ToastAction;
  /** Wait for the toast on screen to go away instead of replacing it. */
  queue?: boolean;
};
type Notify = (message: string, tone?: Tone, options?: Options) => void;
type Toast = { message: string; tone: Tone; action?: ToastAction };

const ToastContext = createContext<Notify>(() => {});
export const useNotify = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>();
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
    if (next) timer.current = setTimeout(hide, duration(next));
  }, []);
  const notify = useCallback<Notify>(
    (message, tone = "success", options = {}) => {
      const next = { message, tone, action: options.action };
      if (options.queue && showing.current) {
        queued.current = next;
        return;
      }
      clearTimeout(timer.current);
      showing.current = true;
      setToast(next);
      timer.current = setTimeout(hide, duration(next));
    },
    [hide],
  );
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
          ) : toast.tone === "warning" ? (
            <AlertTriangle size={16} />
          ) : toast.tone === "info" ? (
            <Info size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {toast.message}
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

/** Toasts with a button stay long enough to reach it. */
const duration = (toast: Toast) =>
  toast.action ? 10_000 : toast.tone === "success" ? 3500 : 7000;
