import { Link } from "@tanstack/react-router";
import { useCurrentUserState, type AppUser } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuthSlot({ tone = "default" }: { tone?: "default" | "inverse" }) {
  const { user, isPending } = useCurrentUserState();
  const inverse = tone === "inverse";

  return (
    <div className="flex h-9 min-w-20 items-center justify-end" suppressHydrationWarning>
      {isPending ? (
        <div
          className={cn(
            "size-9 shrink-0 animate-pulse rounded-full",
            inverse ? "bg-cream/15" : "bg-elevated",
          )}
        />
      ) : !user ? (
        <Button asChild variant={inverse ? "inverse" : "outline"} size="sm">
          <Link to="/login">Sign in</Link>
        </Button>
      ) : (
        <SignedChip user={user} inverse={inverse} />
      )}
    </div>
  );
}

function SignedChip({ user, inverse }: { user: AppUser; inverse: boolean }) {
  const label = user.displayName ?? user.primaryEmail ?? "Account";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt=""
          className="size-8 rounded-full object-cover outline outline-1 -outline-offset-1 outline-cream/20"
        />
      ) : (
        <span
          className={cn(
            "grid size-8 place-items-center rounded-full text-xs font-medium",
            inverse ? "bg-cream/15 text-cream" : "bg-elevated text-fg",
          )}
        >
          {initial}
        </span>
      )}
      <span
        className={cn(
          "hidden max-w-28 truncate text-sm sm:inline",
          inverse ? "text-cream/80" : "text-muted",
        )}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className={cn(
          "text-sm underline-offset-4 hover:underline",
          inverse ? "text-cream/65 hover:text-cream" : "text-subtle hover:text-fg",
        )}
      >
        Sign out
      </button>
    </div>
  );
}
