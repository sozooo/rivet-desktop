import { useState } from "react";
import { ChevronDown, ChevronRight, CircleDot, X } from "lucide-react";
import { operations, type OpContext, type OperationId } from "./operations";

export function OperationDialog({
  id,
  context,
  onRun,
  onClose,
}: {
  id: OperationId;
  context: OpContext;
  onRun: (input: string) => void;
  onClose: () => void;
}) {
  const op = operations[id];
  const [input, setInput] = useState("");
  const [details, setDetails] = useState(false);
  const problem = op.input?.problem(input, context) ?? null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={op.title}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
        <div className="eyebrow">
          {op.run ? "GIT OPERATION" : "GIT OPERATION PREVIEW"}
        </div>
        <h2>{op.title}</h2>
        <p>{op.describe(context)}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (op.run && !problem) onRun(input);
          }}
        >
          {op.input && (
            <input
              autoFocus
              aria-label={op.input.label}
              placeholder={op.input.placeholder}
              value={input}
              onChange={(e) => setInput(op.input!.sanitize(e.target.value))}
            />
          )}
          <div className="preview-note">
            <CircleDot size={17} />
            <span>
              {op.run
                ? "Demo repository: nothing on disk changes."
                : "The demo shows what this operation would do but does not perform it yet."}
            </span>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => setDetails(!details)}
          >
            {details ? <ChevronDown /> : <ChevronRight />}Show Git command
          </button>
          {details && <pre>{op.command(context, input)}</pre>}
          <div className="modal-actions">
            <button type="button" className="button" onClick={onClose}>
              {op.run ? "Cancel" : "Close"}
            </button>
            {op.run && (
              <button
                type="submit"
                className={`button ${op.danger ? "danger" : "primary"}`}
                disabled={!!problem}
                title={problem ?? undefined}
              >
                {op.confirm}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
