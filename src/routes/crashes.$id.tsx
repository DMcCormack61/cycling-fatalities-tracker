import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CrashAtlas } from "@/components/crash-atlas";
import { CrashLocaleMap } from "@/components/crash-locale-map";
import { SeverityBadge } from "@/components/severity-badge";
import { Badge } from "@/components/ui/badge";
import { getCrash } from "@/lib/crashes-server";
import type { MapPoint } from "@/lib/crashes-server";
import { driverStatusLabel, ingestLabel, outcomeLabel, typeLabel } from "@/lib/crashes";
import { formatCompact, formatDate } from "@/lib/format";

export const Route = createFileRoute("/crashes/$id")({
  loader: async ({ params }) => {
    const crash = await getCrash({ data: params.id });
    if (!crash) throw notFound();
    return { crash };
  },
  component: CrashDetail,
});

function CrashDetail() {
  const { crash } = Route.useLoaderData();
  const mapPoints: MapPoint[] =
    typeof crash.latitude === "number" && typeof crash.longitude === "number"
      ? [
          {
            id: crash.id,
            title: crash.title,
            city: crash.city,
            country: crash.country,
            state: crash.state,
            occurredOn: crash.occurredOn,
            crashType: crash.crashType,
            outcome: crash.outcome,
            severity: crash.severity,
            fatalities: crash.fatalities,
            injured: crash.injured,
            latitude: crash.latitude,
            longitude: crash.longitude,
            ingestSource: crash.ingestSource ?? null,
            victimName: crash.victimName,
          },
        ]
      : [];

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/crashes"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        Back to crashes
      </Link>

      <div className="grid gap-6 lg:grid-cols-5">
        <article className="flex min-w-0 flex-col gap-5 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={crash.severity} />
            <Badge>{typeLabel(crash.crashType)}</Badge>
            <Badge variant="outline">{outcomeLabel(crash.outcome)}</Badge>
            {crash.verified ? <Badge variant="outline">Documented</Badge> : null}
            {crash.reviewStatus === "pending" ? <Badge variant="outline">Needs review</Badge> : null}
            <Badge variant="outline">{ingestLabel(crash.ingestSource)}</Badge>
          </div>
          <header>
            <p className="text-sm text-muted">
              <time dateTime={crash.occurredOn}>{formatDate(crash.occurredOn)}</time>
              {" · "}
              {crash.city}, {crash.state}
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-fg sm:text-4xl">
              {crash.title}
            </h1>
            <p className="mt-2 text-muted">{crash.locationName}</p>
            {crash.victimName ? (
              <p className="mt-1 text-base text-fg">Victim: {crash.victimName}</p>
            ) : (
              <p className="mt-1 text-sm text-subtle">Victim name not filed</p>
            )}
          </header>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Killed" value={formatCompact(crash.fatalities)} />
            <Fact label="Injured" value={formatCompact(crash.injured)} />
            <Fact label="Age band" value={crash.victimAgeBand ?? "—"} />
            <Fact label="Driver" value={driverStatusLabel(crash.driverStatus)} />
            <Fact label="Vehicle" value={crash.vehicleType ?? "—"} />
            <Fact label="Roadway" value={crash.roadwayType ?? "—"} />
            <Fact label="Lighting" value={crash.lighting ?? "—"} />
            <Fact label="Helmet" value={crash.helmet ?? "—"} />
          </dl>

          {crash.policeReportId ? (
            <p className="font-mono text-xs text-subtle">Report ID: {crash.policeReportId}</p>
          ) : null}

          <div className="space-y-3 text-base leading-relaxed text-fg">
            <p>{crash.summary}</p>
            {crash.context ? <p className="text-muted">{crash.context}</p> : null}
          </div>

          <p className="text-sm text-subtle">
            Source: {crash.sourceName}
            {crash.sourceUrl ? (
              <>
                {" · "}
                <a
                  href={crash.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-muted underline-offset-4 hover:text-fg hover:underline"
                >
                  Open report <ExternalLink className="size-3" />
                </a>
              </>
            ) : null}
          </p>

          {crash.mapPlace ? (
            <CrashLocaleMap
              place={crash.mapPlace}
              heading={placeHeading(crash.city, crash.state)}
              markerLabel={crash.locationName}
            />
          ) : null}
        </article>

        <aside className="flex flex-col gap-4 lg:col-span-2">
          <CrashAtlas points={mapPoints} highlightId={crash.id} />
          <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">Location</p>
            <p className="mt-2 font-display text-xl text-fg">
              {crash.city}, {crash.state}
            </p>
            <p className="mt-1 text-sm text-muted">{crash.region} · {crash.country}</p>
            {filedCoordinates(crash.latitude, crash.longitude) ? (
              <p className="mt-3 font-mono text-xs tabular-nums text-subtle">
                {filedCoordinates(crash.latitude, crash.longitude)}
              </p>
            ) : (
              <p className="mt-3 text-sm text-subtle">Site coordinates were not filed.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function placeHeading(city: string, state: string): string {
  const parts = [city?.trim(), state?.trim()].filter(Boolean);
  return parts.join(", ") || "Unlocated filing";
}

function filedCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]">
      <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">{label}</dt>
      <dd className="mt-1 text-sm text-fg">{value}</dd>
    </div>
  );
}
