import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

function NotFound() {
  return (
    <main className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-subtle">404</p>
      <h1 className="font-display text-2xl text-fg">That file is not on the desk</h1>
      <p className="text-sm text-muted">The crash or page you asked for is not here.</p>
    </main>
  );
}

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: NotFound,
  });
}
