import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TypeStat, YearStat } from "@/lib/crashes-server";
import { typeLabel } from "@/lib/crashes";

const tooltipStyle = {
  background: "var(--color-elevated)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-fg)",
  fontSize: 12,
};

export function YearChart({ data }: { data: YearStat[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <XAxis
            dataKey="year"
            tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              value as number,
              name === "crashes" ? "Crashes" : "Killed",
            ]}
          />
          <Area
            type="monotone"
            dataKey="crashes"
            stroke="var(--color-accent)"
            fill="var(--color-accent)"
            fillOpacity={0.18}
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="fatalities"
            stroke="var(--color-critical)"
            fill="var(--color-critical)"
            fillOpacity={0.08}
            strokeWidth={1.2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TypeChart({ data }: { data: TypeStat[] }) {
  const rows = data.map((d) => ({ ...d, label: typeLabel(d.type) }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value as number, "Crashes"]} />
          <Bar dataKey="crashes" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
