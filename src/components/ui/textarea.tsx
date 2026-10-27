import { type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-32 w-full rounded-md bg-elevated px-3 py-2.5 text-sm text-fg shadow-[var(--shadow-border)]",
      "placeholder:text-subtle",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
      "disabled:cursor-not-allowed disabled:opacity-40",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
