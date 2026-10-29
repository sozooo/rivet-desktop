import { demoFlags } from "../demoFlags";
import type { GitBackend } from "../git/backend";
import { platform } from "../platform";
import { errorSamples } from "./samples";

const sample = (id: string | null) => errorSamples.find((s) => s.id === id);

/**
 * The browser demo's `?fail=<sample>`: the backend method where that failure happens
 * throws git's message every time. With `?identity=empty`, saving fails until a name
 * and email are given, as it does with real git.
 */
export function withDemoFailures(backend: GitBackend): GitBackend {
  const failure = sample(demoFlags.fail);
  const identity = sample("identity")!;
  if (!failure && !demoFlags.identity) return backend;
  return new Proxy(backend, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      const method = value.bind(target);
      if (property === failure?.at)
        return async () => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          throw new Error(failure.stderr);
        };
      if (property === "commit")
        return async (...args: unknown[]) => {
          if (!(await platform.identity()).email)
            throw new Error(identity.stderr);
          return method(...args);
        };
      return method;
    },
  });
}
