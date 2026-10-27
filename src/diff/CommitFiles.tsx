import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { dirName, fileName, lineStats } from "../git/paths";
import type { FileChange } from "../git/types";
import { FileIcon, StatusIcon } from "../ui/FileIcon";

/** A searchable, folder-grouped file list beside the diff of the selected file. */
export function CommitFiles({
  files,
  selected,
  onSelect,
  children,
}: {
  files: FileChange[];
  selected?: string;
  onSelect: (path: string) => void;
  children: ReactNode;
}) {
  const [query, setQuery] = useState(""),
    [collapsed, setCollapsed] = useState(false),
    [width, setWidth] = useState(245),
    [closed, setClosed] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current,
      row = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !row) return;
    const bounds = list.getBoundingClientRect(),
      target = row.getBoundingClientRect();
    if (target.top < bounds.top) list.scrollTop += target.top - bounds.top;
    else if (target.bottom > bounds.bottom)
      list.scrollTop += target.bottom - bounds.bottom;
  }, [selected, collapsed, query]);
  const filtered = files.filter((f) =>
    f.path.toLowerCase().includes(query.toLowerCase()),
  );
  const groups = Array.from(
    new Set(filtered.map((f) => dirName(f.path))),
  ).sort();
  const resize = (delta: number) =>
    setWidth((w) => Math.max(200, Math.min(340, w + delta)));
  return (
    <div className="commit-explorer">
      {collapsed ? (
        <div className="commit-files-collapsed">
          <button
            className="icon-button"
            title={`Show ${files.length} changed files`}
            onClick={() => setCollapsed(false)}
          >
            <PanelLeftOpen />
          </button>
          <span>{files.length}</span>
        </div>
      ) : (
        <>
          <section
            className="commit-files"
            style={{ width }}
            aria-label="Changed files"
          >
            <div className="commit-files-heading">
              <strong>
                Changed files <span className="count">{files.length}</span>
              </strong>
              <button
                className="icon-button"
                title="Collapse changed files"
                onClick={() => setCollapsed(true)}
              >
                <PanelLeftClose />
              </button>
            </div>
            <div className="search">
              <Search size={13} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a file or folder…"
                aria-label="Search changed files"
              />
            </div>
            <div
              className="commit-file-scroll"
              ref={listRef}
              tabIndex={0}
              aria-label="Changed file list"
            >
              {groups.map((folder) => {
                const open = !closed.includes(folder) || !!query;
                const inFolder = filtered.filter(
                  (f) => dirName(f.path) === folder,
                );
                return (
                  <div key={folder}>
                    <button
                      className="commit-folder"
                      title={folder || "Repository root"}
                      onClick={() =>
                        setClosed((c) =>
                          c.includes(folder)
                            ? c.filter((x) => x !== folder)
                            : [...c, folder],
                        )
                      }
                    >
                      {open ? <ChevronDown /> : <ChevronRight />}
                      <Folder />
                      <span>{folder || "Repository root"}</span>
                      <small>{inFolder.length}</small>
                    </button>
                    {open &&
                      inFolder.map((f) => {
                        const { added, removed } = lineStats(f.hunks);
                        return (
                          <button
                            key={f.path}
                            title={`${f.path} · +${added} −${removed}`}
                            aria-label={`Inspect ${f.path}`}
                            aria-current={
                              selected === f.path ? "true" : undefined
                            }
                            className={`commit-file ${selected === f.path ? "selected" : ""}`}
                            onClick={() => onSelect(f.path)}
                          >
                            <FileIcon path={f.path} />
                            <span className="commit-file-name">
                              {fileName(f.path)}
                            </span>
                            <StatusIcon status={f.status} />
                          </button>
                        );
                      })}
                  </div>
                );
              })}
              {!filtered.length && (
                <p className="list-empty">No matching files.</p>
              )}
            </div>
            <div className="commit-file-summary">
              {query ? `${filtered.length} of ${files.length}` : files.length}{" "}
              files · Select to review
            </div>
          </section>
          <div
            className="resize-handle commit-files-divider"
            role="separator"
            aria-label="Resize changed files"
            aria-orientation="vertical"
            aria-valuenow={width}
            aria-valuemin={200}
            aria-valuemax={340}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                resize(e.key === "ArrowLeft" ? -10 : 10);
              }
            }}
            onPointerDown={(e) =>
              e.currentTarget.setPointerCapture(e.pointerId)
            }
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                resize(e.movementX);
            }}
            onPointerUp={(e) =>
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          />
        </>
      )}
      <section className="commit-diff-pane" aria-label="Selected file diff">
        {children}
      </section>
    </div>
  );
}
