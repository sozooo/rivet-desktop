import { useState } from "react";
import { ChevronDown, ChevronRight, CircleDot, X } from "lucide-react";
import { useI18n } from "../i18n/i18n";
import {
  opKey,
  operations,
  type OpContext,
  type OperationId,
} from "./operations";

export function OperationDialog({
  id,
  context,
  demo,
  onRun,
  onClose,
}: {
  id: OperationId;
  context: OpContext;
  demo: boolean;
  onRun: (input: string) => void;
  onClose: () => void;
}) {
  const { t, mode } = useI18n();
  const op = operations[id];
  const [input, setInput] = useState("");
  // Rivet can't run every operation yet; then the command is the useful part.
  const [details, setDetails] = useState(!op.run);
  const problem = op.input?.problem(input, context) ?? null;
  const params = op.params(context, t, input);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t(opKey(id, "title"))}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label={t("dialog.close")}
          onClick={onClose}
        >
          <X />
        </button>
        <div className="eyebrow">
          {t(op.run ? "dialog.eyebrow" : "dialog.eyebrowPreview")}
        </div>
        <h2>{t(opKey(id, "title"))}</h2>
        <p>{t(opKey(id, "describe"), params)}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (op.run && !problem) onRun(input);
          }}
        >
          {op.input && (
            <input
              autoFocus
              aria-label={t(op.input.label)}
              placeholder={op.input.placeholder}
              value={input}
              onChange={(e) => setInput(op.input!.sanitize(e.target.value))}
            />
          )}
          {(demo || !op.run) && (
            <div className="preview-note">
              <CircleDot size={17} />
              <span>{t(op.run ? "dialog.demoNote" : "dialog.cannotYet")}</span>
            </div>
          )}
          {/* Simple mode doesn't talk about Git commands. */}
          {mode === "full" && (
            <>
              <button
                type="button"
                className="text-button"
                onClick={() => setDetails(!details)}
              >
                {details ? <ChevronDown /> : <ChevronRight />}
                {t("dialog.showCommand")}
              </button>
              {details && <pre>{op.command(context, input)}</pre>}
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="button" onClick={onClose}>
              {t(op.run ? "common.cancel" : "common.close")}
            </button>
            {op.run && (
              <button
                type="submit"
                className={`button ${op.danger ? "danger" : "primary"}`}
                disabled={!!problem}
                title={problem ? t(problem) : undefined}
              >
                {t(opKey(id, "confirm"))}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
