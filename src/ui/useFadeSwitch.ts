import { useEffect, useRef, useState } from "react";

export function useFadeSwitch<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const [phase, setPhase] = useState("settled");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function switchTo(next: T) {
    clearTimeout(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(next);
      setPhase("settled");
      return;
    }
    if (next === value) {
      setPhase("settled");
      return;
    }
    setPhase("leaving");
    timer.current = setTimeout(() => {
      setValue(next);
      setPhase("entering");
      timer.current = setTimeout(() => setPhase("settled"), 190);
    }, 100);
  }
  return [value, switchTo, phase] as const;
}
