import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMoney } from './ui';

/** Greyscale ramp, darkest first — enough steps to tell slices apart. */
export const GREYS = ['#0a0a0a', '#404040', '#6b6b6b', '#939393', '#b8b8b8', '#d6d6d6'];

const axis = { fontSize: 11, fill: '#6b6b6b' };
const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k` : String(n);

function TipBox({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  const money = useMoney();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-xs text-paper shadow-lg">
      {label && <div className="mb-1 opacity-60">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="num flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-semibold">{money(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export interface Slice {
  name: string;
  value: number;
}

/** Top slices kept, the rest grouped as "Everything else" so greys stay distinguishable. */
export function groupSlices(slices: Slice[], keep = 5): Slice[] {
  const sorted = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= keep + 1) return sorted;
  const rest = sorted.slice(keep).reduce((a, s) => a + s.value, 0);
  return [...sorted.slice(0, keep), { name: 'Everything else', value: rest }];
}

export function Donut({ data, center }: { data: Slice[]; center: string }) {
  return (
    <div className="relative h-52">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={1.5} stroke="none" isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={GREYS[i % GREYS.length]} />
            ))}
          </Pie>
          <Tooltip content={<TipBox />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="label">Spent</div>
        <div className="num text-xl font-semibold tracking-tight">{center}</div>
      </div>
    </div>
  );
}

export function Legendary({ data, total }: { data: Slice[]; total: number }) {
  const money = useMoney();
  return (
    <div className="mt-4 space-y-2">
      {data.map((s, i) => (
        <div key={s.name} className="flex items-center gap-3 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GREYS[i % GREYS.length] }} />
          <span className="flex-1 truncate">{s.name}</span>
          <span className="num text-mute">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          <span className="num w-24 text-right font-medium">{money(s.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Grouped bars, e.g. planned vs actual per goal. series[0] is drawn light, series[1] black. */
export function GroupedBars({
  data,
  series,
  height = 220,
}: {
  data: Record<string, string | number>[];
  series: { key: string; name: string }[];
  height?: number;
}) {
  const fills = series.length === 1 ? ['#0a0a0a'] : ['#d0d0d0', '#0a0a0a', '#6b6b6b'];
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 0, left: -12, bottom: 0 }} barGap={3}>
          <CartesianGrid vertical={false} stroke="#efefef" />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={compact} width={52} />
          <Tooltip content={<TipBox />} cursor={{ fill: '#f5f5f5' }} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => <span style={{ color: '#0a0a0a' }}>{v}</span>} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={fills[i]} radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLine({ data, series }: { data: Record<string, string | number>[]; series: { key: string; name: string }[] }) {
  const strokes = ['#0a0a0a', '#939393'];
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#efefef" />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={compact} width={52} />
          <Tooltip content={<TipBox />} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => <span style={{ color: '#0a0a0a' }}>{v}</span>} />}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={strokes[i]}
              strokeWidth={2}
              strokeDasharray={i === 1 ? '4 4' : undefined}
              dot={{ r: 3, fill: strokes[i], stroke: 'none' }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
