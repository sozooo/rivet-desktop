import { createContext, useContext, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useI18n } from "../i18n/i18n";

export type SidebarState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  width: number;
  setWidth: (width: number) => void;
};

export const SidebarContext = createContext<SidebarState>({
  open: true,
  setOpen: () => {},
  width: 310,
  setWidth: () => {},
});

const clampWidth = (w: number) => Math.min(380, Math.max(260, w));

/** The collapsible, resizable sidebar beside a view's main area. */
export function Panes({
  title,
  count,
  search,
  sidebar,
  footer,
  main,
  phase,
}: {
  title: string;
  count?: number;
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  };
  sidebar: ReactNode;
  footer: ReactNode;
  main: ReactNode;
  phase: string;
}) {
  const { open, setOpen, width, setWidth } = useContext(SidebarContext);
  const { t } = useI18n();
  return (
    <>
      {open && (
        <>
          <aside className="sidebar">
            <div className="sidebar-title">
              <h1>{title}</h1>
              <div className="row">
                {count !== undefined && <span className="count">{count}</span>}
                <button
                  className="icon-button"
                  title={t("panes.collapse")}
                  onClick={() => setOpen(false)}
                >
                  <PanelLeftClose size={17} />
                </button>
              </div>
            </div>
            {search && (
              <label className="search">
                <Search size={14} />
                <input
                  aria-label={search.placeholder}
                  placeholder={search.placeholder}
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                />
              </label>
            )}
            <div className={`sidebar-content fade-switch ${phase}`}>
              {sidebar}
            </div>
            <div className="sidebar-footer">{footer}</div>
          </aside>
          <div
            className="resize-handle"
            role="separator"
            aria-label={t("panes.resize")}
            aria-orientation="vertical"
            aria-valuenow={width}
            aria-valuemin={260}
            aria-valuemax={380}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                setWidth(
                  clampWidth(width + (e.key === "ArrowLeft" ? -10 : 10)),
                );
              }
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const start = e.clientX,
                initial = width;
              const target = e.currentTarget;
              const move = (ev: PointerEvent) =>
                setWidth(clampWidth(initial + ev.clientX - start));
              const end = () => {
                target.removeEventListener("pointermove", move);
                target.removeEventListener("pointerup", end);
              };
              target.addEventListener("pointermove", move);
              target.addEventListener("pointerup", end);
            }}
          />
        </>
      )}
      <main
        className={`workspace fade-switch ${phase} ${!open ? "sidebar-collapsed" : ""}`}
      >
        {!open && (
          <button
            className="restore-sidebar icon-button"
            title={t("panes.expand")}
            onClick={() => setOpen(true)}
          >
            <PanelLeftOpen />
          </button>
        )}
        {main}
      </main>
    </>
  );
}
