import { Plus, Minus } from "lucide-react";

type Line = { kind: "context" | "add" | "del"; text: string };
type Hunk = { label: string; staged: boolean; lines: Line[] };
type Cell = { line: Line; number: number; counterpart?: string };
export function alignLines(hunk: Hunk): { left?: Cell; right?: Cell }[] {
  let oldNumber = Number(hunk.label.match(/-(\d+)/)?.[1] || 1);
  let newNumber = Number(hunk.label.match(/\+(\d+)/)?.[1] || 1);
  const rows: { left?: Cell; right?: Cell }[] = [];
  for (let i = 0; i < hunk.lines.length;) {
    const line = hunk.lines[i];
    if (line.kind === "context") {
      rows.push({
        left: { line, number: oldNumber++ },
        right: { line, number: newNumber++ },
      });
      i++;
      continue;
    }
    const removed: Line[] = [],
      added: Line[] = [];
    while (i < hunk.lines.length && hunk.lines[i].kind !== "context") {
      (hunk.lines[i].kind === "del" ? removed : added).push(hunk.lines[i++]);
    }
    for (let j = 0; j < Math.max(removed.length, added.length); j++) {
      rows.push({
        left: removed[j] && {
          line: removed[j],
          number: oldNumber++,
          counterpart: added[j]?.text,
        },
        right: added[j] && {
          line: added[j],
          number: newNumber++,
          counterpart: removed[j]?.text,
        },
      });
    }
  }
  return rows;
}
function syntax(text: string, whitespace: boolean) {
  return text
    .split(
      /("[^"\n]*"|\b(?:public|private|class|void|float|bool|if|new|using|return|true|false)\b|\b\d+(?:\.\d+)?f?\b)/g,
    )
    .map((part, i) => (
      <span
        key={i}
        className={
          /^"/.test(part)
            ? "token-string"
            : /^(public|private|class|void|float|bool|if|new|using|return|true|false)$/.test(
                  part,
                )
              ? "token-keyword"
              : /^\d/.test(part)
                ? "token-number"
                : ""
        }
      >
        {whitespace ? part.replaceAll(" ", "·") : part}
      </span>
    ));
}
function code(cell: Cell, whitespace: boolean) {
  const text = cell.line.text,
    other = cell.counterpart;
  if (other === undefined) return syntax(text, whitespace);
  let start = 0,
    end = text.length,
    otherEnd = other.length;
  while (start < end && start < otherEnd && text[start] === other[start])
    start++;
  while (
    end > start &&
    otherEnd > start &&
    text[end - 1] === other[otherEnd - 1]
  ) {
    end--;
    otherEnd--;
  }
  return (
    <>
      {syntax(text.slice(0, start), whitespace)}
      <mark>{syntax(text.slice(start, end), whitespace)}</mark>
      {syntax(text.slice(end), whitespace)}
    </>
  );
}
export function DiffHunk({
  hunk,
  split,
  whitespace,
  editable,
  onStage,
}: {
  hunk: Hunk;
  split: boolean;
  whitespace: boolean;
  editable: boolean;
  onStage: () => void;
}) {
  const rows = alignLines(hunk);
  const label = hunk.label.replace(
    /-(\d+),\d+ \+(\d+),\d+/,
    `-$1,${hunk.lines.filter((l) => l.kind !== "add").length} +$2,${hunk.lines.filter((l) => l.kind !== "del").length}`,
  );
  return (
    <section className="hunk">
      <div className="hunk-header">
        <span>{label}</span>
        {editable && (
          <button onClick={onStage}>
            {hunk.staged ? <Minus /> : <Plus />}
            {hunk.staged ? "Unstage hunk" : "Stage hunk"}
          </button>
        )}
      </div>
      {split ? (
        <div className="aligned-diff">
          {rows.map((row, i) => (
            <div className="aligned-row" key={i}>
              {[row.left, row.right].map((cell, side) => (
                <div
                  key={side}
                  className={`code-line ${cell?.line.kind || "absent"}`}
                >
                  <span className="line-number">{cell?.number}</span>
                  <span className="line-sign">
                    {cell?.line.kind === "add"
                      ? "+"
                      : cell?.line.kind === "del"
                        ? "−"
                        : ""}
                  </span>
                  <code>{cell ? code(cell, whitespace) : " "}</code>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        rows.map((row, i) =>
          row.left?.line.kind === "context" ? (
            <div className="code-line" key={i}>
              <span className="line-number">{row.left.number}</span>
              <span className="line-number">{row.right?.number}</span>
              <span className="line-sign" />
              <code>{code(row.left, whitespace)}</code>
            </div>
          ) : (
            <div key={i}>
              {[row.left, row.right].map(
                (cell, j) =>
                  cell && (
                    <div className={`code-line ${cell.line.kind}`} key={j}>
                      <span className="line-number">
                        {j === 0 ? cell.number : ""}
                      </span>
                      <span className="line-number">
                        {j === 1 ? cell.number : ""}
                      </span>
                      <span className="line-sign">{j === 0 ? "−" : "+"}</span>
                      <code>{code(cell, whitespace)}</code>
                    </div>
                  ),
              )}
            </div>
          ),
        )
      )}
    </section>
  );
}
