/**
 * Stopping long transfers (clone, fetch, pull, push, LFS downloads). The UI
 * makes a CancelHandle and passes it next to `onProgress`; the operation runs
 * the steps that may be cut short through `during`, and only those. While
 * one runs, cancelling is offered; a step that changes files (a pull's merge)
 * runs outside, so the button goes away and a late click changes nothing.
 */

/** The person stopped the operation: not an error, nothing to explain. */
export class CancelledError extends Error {
  constructor() {
    super("Cancelled.");
    this.name = "CancelledError";
  }
}

export const isCancelled = (error: unknown): error is CancelledError =>
  error instanceof CancelledError;

export class CancelHandle {
  private controller = new AbortController();
  /** Steps under way that may be cut short. */
  private open = 0;
  private listeners = new Set<() => void>();

  /** Aborts when the person cancels; runners then stop git and its helpers. */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get cancelled() {
    return this.signal.aborted;
  }

  /** Whether cancelling is offered right now. */
  get available() {
    return this.open > 0 && !this.cancelled;
  }

  /** Stops the step under way; does nothing when that isn't safe now. */
  cancel() {
    if (!this.available) return;
    this.controller.abort(new CancelledError());
    this.changed();
  }

  throwIfCancelled() {
    if (this.cancelled) throw new CancelledError();
  }

  /**
   * Runs a step that can stop half-way without harm, such as a download.
   * Cancelling rejects it with CancelledError (unless git had just finished).
   * A cancel that came before refuses to start it.
   */
  async during<T>(step: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.throwIfCancelled();
    this.open++;
    this.changed();
    try {
      return await step(this.signal);
    } finally {
      this.open--;
      this.changed();
    }
  }

  /** Hears when `available` or `cancelled` may have changed. */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  private changed() {
    this.listeners.forEach((listener) => listener());
  }
}

/** `cancel.during(step)`, or just the step when nobody can cancel. */
export const during = <T>(
  cancel: CancelHandle | undefined,
  step: (signal?: AbortSignal) => Promise<T>,
): Promise<T> => (cancel ? cancel.during(step) : step(undefined));
