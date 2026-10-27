import { useLayoutEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";

const shapes = "path, line, polyline, polygon, circle, ellipse, rect";

/**
 * A Lucide icon that draws its strokes in, one after another, whenever it
 * becomes active. Each stroke is normalised to length 1 so the dash animation
 * works for every shape.
 */
export function DrawIcon({
  icon: Icon,
  active,
  size,
}: {
  icon: LucideIcon;
  active: boolean;
  size?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    ref.current?.querySelectorAll<SVGElement>(shapes).forEach((shape, i) => {
      shape.setAttribute("pathLength", "1");
      shape.style.setProperty("--stroke", String(i));
    });
  }, [active]);
  // Remounting on activation restarts the animation.
  return (
    <Icon
      key={String(active)}
      ref={ref}
      size={size}
      className={active ? "draw-on" : undefined}
    />
  );
}
