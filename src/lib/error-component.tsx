import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-critical" aria-hidden="true">
        <TriangleAlert className="size-8" strokeWidth={1.75} />
      </span>
      <h1 className="font-display text-xl text-fg">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error instanceof Error && error.message
          ? error.message
          : "An unexpected error occurred. Try reloading the page."}
      </p>
    </main>
  );
}
