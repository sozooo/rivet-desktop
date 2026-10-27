import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Search,
  FileCode2,
  FileJson2,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  ChevronDown,
  Folder,
} from "lucide-react";

type FileEntry = {
  id: number;
  name: string;
  path: string;
  status: string;
  hunks: { lines: { kind: string }[] }[];
};
export function CommitFiles({
  files,
  selected,
  onSelect,
  children,
}: {
  files: FileEntry[];
  selected?: number;
  onSelect: (id: number) => void;
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
    `${f.path}/${f.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  const groups = Array.from(new Set(filtered.map((f) => f.path))).sort();
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
              {groups.map((path) => (
                <div key={path}>
                  <button
                    className="commit-folder"
                    title={path || "Repository root"}
                    onClick={() =>
                      setClosed((c) =>
                        c.includes(path)
                          ? c.filter((x) => x !== path)
                          : [...c, path],
                      )
                    }
                  >
                    {closed.includes(path) && !query ? (
                      <ChevronRight />
                    ) : (
                      <ChevronDown />
                    )}
                    <Folder />
                    <span>{path || "Repository root"}</span>
                    <small>
                      {filtered.filter((f) => f.path === path).length}
                    </small>
                  </button>
                  {(!closed.includes(path) || query) &&
                    filtered
                      .filter((f) => f.path === path)
                      .map((f) => {
                        const Icon = f.name.endsWith(".json")
                          ? FileJson2
                          : f.name.endsWith(".md")
                            ? FileText
                            : FileCode2;
                        const added = f.hunks
                            .flatMap((h) => h.lines)
                            .filter((l) => l.kind === "add").length,
                          removed = f.hunks
                            .flatMap((h) => h.lines)
                            .filter((l) => l.kind === "del").length;
                        return (
                          <button
                            key={f.id}
                            title={`${f.path}/${f.name} · +${added} −${removed}`}
                            aria-label={`Inspect ${f.path}/${f.name}`}
                            aria-current={
                              selected === f.id ? "true" : undefined
                            }
                            className={`commit-file ${selected === f.id ? "selected" : ""}`}
                            onClick={() => onSelect(f.id)}
                          >
                            <Icon />
                            <span>{f.name}</span>
                            <small className={`status status-${f.status}`}>
                              {f.status}
                            </small>
                          </button>
                        );
                      })}
                </div>
              ))}
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
              if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                setWidth((w) =>
                  Math.max(
                    200,
                    Math.min(340, w + (e.key === "ArrowLeft" ? -10 : 10)),
                  ),
                );
              }
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                setWidth((w) => Math.max(200, Math.min(340, w + e.movementX)));
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
