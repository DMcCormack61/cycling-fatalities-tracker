-- Bulk imports: where a filing came from, and whether a news row is still in review.
-- Curated and official rows are published. News stays pending until promoted.

alter table crashes add column if not exists ingest_source text not null default 'curated';
alter table crashes add column if not exists review_status text not null default 'published';

create index if not exists crashes_verified_occurred_idx on crashes (verified, occurred_on desc);
create index if not exists crashes_ingest_source_idx on crashes (ingest_source);
create index if not exists crashes_review_status_idx on crashes (review_status);
