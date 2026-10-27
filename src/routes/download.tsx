import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";

export const Route = createFileRoute("/download")({
  component: DownloadSource,
});

function DownloadSource() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-5">
      <BrandMark className="h-12 w-12 text-navy" />
      <div>
        <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-subtle">Source</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-fg">
          Cycling Fatalities Tracker
        </h1>
        <p className="mt-2 text-muted">
          This project lives on GitHub as{" "}
          <span className="text-fg">cycling-fatalities-tracker</span>. Clone the repo rather
          than downloading a SiteGround zip.
        </p>
      </div>
      <Link
        to="/briefing"
        className="inline-flex h-11 w-fit items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
      >
        Read the briefing
      </Link>
    </div>
  );
}
