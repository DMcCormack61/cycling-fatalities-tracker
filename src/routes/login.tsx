import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6">
      <div>
        <BrandMark className="h-12 w-10 text-navy" />
        <p className="mt-4 text-[0.6875rem] uppercase tracking-[0.2em] text-subtle">
          Cycling Fatalities Tracker
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-fg">Sign in</h1>
        <p className="mt-2 text-muted">Public Incident Reports stay open without an account.</p>
      </div>

      {authEnabled ? (
        <div className="flex flex-col gap-3">
          {GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => signIn(p.providerId, { callbackURL: "/" })}
            >
              Continue with {p.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled in this environment.</p>
      )}

      <Link to="/" className="text-sm text-muted hover:text-fg">
        Return to the desk
      </Link>
    </div>
  );
}
