import { BIKE_LANE_COLOR, BIKE_LANE_LABEL, BIKE_LANE_NOTE } from "@/lib/bike-lanes";
import { cn } from "@/lib/utils";

export function BikeLaneToggle({
  on,
  onChange,
  className,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={BIKE_LANE_NOTE}
      onClick={() => onChange(!on)}
      aria-label={`${BIKE_LANE_LABEL}, ${on ? "shown" : "hidden"}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-left text-[0.6875rem] uppercase tracking-[0.12em]",
        on ? "border-[#0891b2] bg-[#0891b2]/10 text-fg" : "border-current text-subtle",
        className,
      )}
    >
      <span
        className="inline-block h-1.5 w-7 shrink-0 rounded-full"
        style={{
          background: on ? BIKE_LANE_COLOR : "transparent",
          boxShadow: `inset 0 0 0 2px ${BIKE_LANE_COLOR}`,
        }}
        aria-hidden
      />
      {BIKE_LANE_LABEL}
      <span className="tracking-normal">{on ? "On" : "Off"}</span>
    </button>
  );
}
