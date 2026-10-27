import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <circle
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle cx="32" cy="32" r="5" fill="currentColor" />
      <path
        d="M32 8 V56 M8 32 H56 M14 14 L50 50 M50 14 L14 50"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
