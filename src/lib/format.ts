import { format, parseISO } from "date-fns";

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
