import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium tracking-wide uppercase",
  {
    variants: {
      variant: {
        default: "bg-elevated text-muted",
        accent: "bg-accent text-accent-fg",
        critical: "bg-critical/15 text-critical",
        high: "bg-high/15 text-high",
        moderate: "bg-moderate/15 text-moderate",
        low: "bg-low/20 text-muted",
        outline: "shadow-[var(--shadow-border)] text-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
