import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useI18n, type Key } from "../i18n/i18n";
import { platform } from "../platform";
import { Dialog } from "../ui/Dialog";
import { useNotify } from "../ui/Toast";
import type { GitHubUser } from "./api";
import { SignInError, type DeviceCode, type SignInFailure } from "./deviceFlow";
import { github } from "./github";

const failures: Record<SignInFailure, Key> = {
  expired: "signin.error.expired",
  denied: "signin.error.denied",
  "not-configured": "signin.error.notConfigured",
  disabled: "signin.error.disabled",
  network: "signin.error.network",
  unexpected: "signin.error.unexpected",
};

type Step =
  | { name: "requesting" }
  | { name: "waiting"; code: DeviceCode }
  | { name: "failed"; reason: SignInFailure; detail: string };

/**
 * Device Flow sign-in: shows the code to enter on github.com and waits for approval.
 * Nothing to type here, and a stray click outside doesn't cancel it.
 */
export function SignInDialog({
  onClose,
  onSignedIn,
}: {
  onClose: () => void;
  onSignedIn: (user: GitHubUser) => void;
}) {
  const { t } = useI18n();
  const notify = useNotify();
  const [step, setStep] = useState<Step>({ name: "requesting" });
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setStep({ name: "requesting" });
    setCopied(false);
    (async () => {
      const code = await github.requestCode();
      signal.throwIfAborted();
      setStep({ name: "waiting", code });
      onSignedIn(await github.completeSignIn(code, signal));
    })().catch((error) => {
      if (signal.aborted) return;
      setStep(
        error instanceof SignInError
          ? { name: "failed", reason: error.reason, detail: error.message }
          : {
              name: "failed",
              reason: "unexpected",
              detail: error instanceof Error ? error.message : String(error),
            },
      );
    });
    return () => controller.abort();
  }, [attempt]);

  // Escape cancels sign-in only, not the screen underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      notify(t("common.clipboardUnavailable"), "error");
    }
  }

  async function copyAndOpen(code: DeviceCode) {
    await copy(code.userCode);
    github
      .openPage(code.verificationUri)
      .catch((error) => notify(String(error), "error"));
  }

  const code = step.name === "waiting" ? step.code : undefined;
  return (
    <Dialog
      eyebrow={t("signin.eyebrow")}
      title={t("signin.title")}
      onClose={onClose}
      closeOnOverlay={false}
    >
      {step.name === "failed" ? (
        <p className="signin-error" role="alert">
          {t(failures[step.reason], { message: step.detail })}
        </p>
      ) : (
        <>
          <p>{t("signin.text")}</p>
          <div className={`device-code ${code ? "" : "pending"}`}>
            <code aria-label={t("signin.codeLabel")}>
              {code?.userCode ?? "····-····"}
            </code>
            <button
              type="button"
              className="icon-button"
              disabled={!code}
              title={t(copied ? "signin.copied" : "signin.copy")}
              aria-label={t("signin.copy")}
              onClick={() => code && copy(code.userCode)}
            >
              {copied ? <Check /> : <Copy />}
            </button>
          </div>
          <p className="signin-status" role="status">
            <span className="signin-pulse" />
            {t(code ? "signin.waiting" : "signin.requesting")}
          </p>
          {code && (
            <p className="setting-hint">
              {t("signin.manual", {
                url: code.verificationUri.replace(/^https?:\/\//, ""),
              })}
            </p>
          )}
        </>
      )}
      {!platform.desktop && step.name !== "failed" && (
        <p className="setting-hint">{t("signin.demo")}</p>
      )}
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          {t("common.cancel")}
        </button>
        {step.name === "failed" ? (
          <button
            className="button primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t("signin.retry")}
          </button>
        ) : (
          <button
            className="button primary"
            disabled={!code}
            onClick={() => code && copyAndOpen(code)}
          >
            <ExternalLink />
            {t("signin.open")}
          </button>
        )}
      </div>
    </Dialog>
  );
}
