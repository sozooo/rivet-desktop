import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "../i18n/i18n";

export function Dialog({
  eyebrow,
  title,
  onClose,
  closeOnOverlay = true,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  /** Off for dialogs a stray click shouldn't cancel. */
  closeOnOverlay?: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div
      className="modal-overlay"
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label={t("dialog.close")}
          onClick={onClose}
        >
          <X />
        </button>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
