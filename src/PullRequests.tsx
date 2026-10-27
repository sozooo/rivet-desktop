import { useState } from "react";
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
export function PullRequests({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(42);
  const pr = requests.find((p) => p.id === selected)!;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="pr-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Pull requests"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pr-header">
          <div>
            <GitPullRequest />
            <h2>Pull requests</h2>
            <span className="count">3 open</span>
          </div>
          <button
            className="icon-button"
            aria-label="Close pull requests"
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
            <div className="eyebrow">PULL REQUEST #{pr.id}</div>
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
              {pr.comments} comments <span>· {pr.files} changed files</span>
            </div>
            <p className="pr-explanation">
              A pull request proposes merging one branch into another. Use Pull
              in the toolbar to download commits into your current branch.
            </p>
          </article>
        </div>
        <footer className="pr-footer">
          Demo pull requests · Hosting integration is not connected.
        </footer>
      </section>
    </div>
  );
}
