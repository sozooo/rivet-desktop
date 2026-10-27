import { Check, Minus } from "lucide-react";

/** A compact checkbox with a third, "partly selected" state. */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean | "mixed";
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`checkbox ${checked ? "on" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      {checked === "mixed" ? <Minus /> : checked ? <Check /> : null}
    </button>
  );
}
