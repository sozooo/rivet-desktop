import { describe, expect, it } from "vitest";
import { CancelHandle, CancelledError, during, isCancelled } from "./cancel";

describe("CancelHandle", () => {
  it("offers cancelling only during steps that may stop", async () => {
    const cancel = new CancelHandle();
    const seen: boolean[] = [];
    cancel.subscribe(() => seen.push(cancel.available));
    expect(cancel.available).toBe(false);
    // Outside a step, e.g. while a pull merges, a click changes nothing.
    cancel.cancel();
    expect(cancel.cancelled).toBe(false);

    await cancel.during(async () => {
      expect(cancel.available).toBe(true);
    });
    expect(cancel.available).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it("aborts the step under way and refuses to start the next", async () => {
    const cancel = new CancelHandle();
    const step = cancel.during(
      (signal) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(new CancelledError())),
        ),
    );
    cancel.cancel();
    await expect(step).rejects.toBeInstanceOf(CancelledError);
    expect(cancel.cancelled).toBe(true);
    expect(cancel.available).toBe(false);

    let started = false;
    await expect(
      cancel.during(async () => {
        started = true;
      }),
    ).rejects.toBeInstanceOf(CancelledError);
    expect(started).toBe(false);
    expect(() => cancel.throwIfCancelled()).toThrow(CancelledError);
  });

  it("runs the step as it is when nobody can cancel", async () => {
    expect(await during(undefined, async (signal) => signal)).toBeUndefined();
    expect(isCancelled(new CancelledError())).toBe(true);
    expect(isCancelled(new Error("Cancelled."))).toBe(false);
  });
});
