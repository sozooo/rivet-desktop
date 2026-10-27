import { useState } from "react";
import { useI18n } from "../i18n/i18n";
import {
  GitPullRequest,
  X,
  GitBranch,
  CheckCircle2,
  Clock,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
const requests = [
  {
    id: 42,
    title: "Add gamepad navigation to the inventory",
    author: "Jamie Chen",
    from: "feature/gamepad-navigation",
    to: "main",
    files: 14,
    checks: "All checks passed",
    review: "Ready for review",
    description:
      "Adds controller focus, input profiles and navigation hints for the inventory. Includes coverage for Xbox and PlayStation bindings.",
    time: "2 hours ago",
    comments: 4,
  },
  {
    id: 41,
    title: "Smooth camera transitions between rooms",
    author: "Alex Morgan",
    from: "fix/camera-transitions",
    to: "main",
    files: 6,
    checks: "All checks passed",
    review: "Approved",
    description:
      "Preserves camera velocity between room transitions and prevents snapping when entering a new trigger volume.",
    time: "Yesterday",
    comments: 2,
  },
  {
    id: 39,
    title: "Explore a softer outline for interactable objects",
    author: "Sam Rivera",
    from: "art/outline-pass",
    to: "develop",
    files: 11,
    checks: "Checks in progress",
    review: "Draft",
    description:
      "An early visual pass on object outlines. Updates shader parameters and material presets for lighter and darker environments.",
    time: "2 days ago",
    comments: 7,
  },
];
export const openPullRequests = requests.length;
export function PullRequests({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(42);
  const pr = requests.find((p) => p.id === selected)!;
  const { t } = useI18n();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="pr-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("prs.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pr-header">
          <div>
            <GitPullRequest />
            <h2>{t("prs.title")}</h2>
            <span className="count">
              {t("prs.open", { count: requests.length })}
            </span>
          </div>
          <button
            className="icon-button"
            aria-label={t("prs.close")}
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <div className="pr-body">
          <div className="pr-list">
            {requests.map((p) => (
              <button
                key={p.id}
                className={p.id === selected ? "selected" : ""}
                onClick={() => setSelected(p.id)}
              >
                <GitPullRequest />
                <span>
                  <strong>{p.title}</strong>
                  <small>
                    #{p.id} · {p.author} · {p.time}
                  </small>
                  <em>{p.review}</em>
                </span>
              </button>
            ))}
          </div>
          <article className="pr-detail" key={pr.id}>
            <div className="eyebrow">{t("prs.eyebrow", { id: pr.id })}</div>
            <h3>{pr.title}</h3>
            <p>{pr.description}</p>
            <div className="pr-branches">
              <GitBranch />
              <code>{pr.from}</code>
              <ArrowRight />
              <code>{pr.to}</code>
            </div>
            <div className="pr-check">
              <CheckCircle2 />
              {pr.review}
            </div>
            <div className="pr-check">
              {pr.checks.includes("passed") ? <CheckCircle2 /> : <Clock />}
              {pr.checks}
            </div>
            <div className="pr-check">
              <MessageSquare />
              {t("prs.comments", { count: pr.comments })}{" "}
              <span>· {t("prs.files", { count: pr.files })}</span>
            </div>
            <p className="pr-explanation">{t("prs.explanation")}</p>
          </article>
        </div>
        <footer className="pr-footer">{t("prs.footer")}</footer>
      </section>
    </div>
  );
}
