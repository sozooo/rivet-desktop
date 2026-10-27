import type { Hunk } from "../git/types";
import { Checkbox } from "../ui/Checkbox";
import { alignLines, changedRange, hunkLabel, type Cell } from "./align";

const keywords =
  "public|private|protected|class|struct|void|float|int|bool|string|var|if|else|for|foreach|while|new|using|return|true|false|null";
const tokens = new RegExp(
  `("[^"\\n]*"|\\b(?:${keywords})\\b|\\b\\d+(?:\\.\\d+)?f?\\b)`,
  "g",
);
const keyword = new RegExp(`^(?:${keywords})$`);

function syntax(text: string, whitespace: boolean) {
  return text.split(tokens).map((part, i) => (
    <span
      key={i}
      className={
        part.startsWith('"')
          ? "token-string"
          : keyword.test(part)
            ? "token-keyword"
            : /^\d/.test(part)
              ? "token-number"
              : undefined
      }
    >
      {whitespace ? part.replaceAll(" ", "·") : part}
    </span>
  ));
}

function code(cell: Cell, whitespace: boolean) {
  const text = cell.line.text;
  if (cell.counterpart === undefined) return syntax(text, whitespace);
  const { start, end } = changedRange(text, cell.counterpart);
  return (
    <>
      {syntax(text.slice(0, start), whitespace)}
      <mark>{syntax(text.slice(start, end), whitespace)}</mark>
      {syntax(text.slice(end), whitespace)}
    </>
  );
}

const sign = { add: "+", del: "−", context: "" };

export function DiffHunk({
  hunk,
  split,
  whitespace,
  onToggle,
}: {
  hunk: Hunk;
  split: boolean;
  whitespace: boolean;
  /** Present when the hunk can be selected for the next commit. */
  onToggle?: () => void;
}) {
  const rows = alignLines(hunk);
  return (
    <section className="hunk">
      <div className="hunk-header">
        {onToggle && (
          <Checkbox
            checked={hunk.staged}
            onChange={onToggle}
            label={
              hunk.staged
                ? "Remove this part from the commit"
                : "Include this part in the commit"
            }
          />
        )}
        <span>{hunkLabel(hunk)}</span>
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
                    {cell ? sign[cell.line.kind] : ""}
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
                      <span className="line-sign">{sign[cell.line.kind]}</span>
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
