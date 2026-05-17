'use client';

import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: number[];
  positive: boolean;
}

interface SparkTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { total: number } }>;
  label?: number;
}

function relativeLabel(index: number, total: number): string {
  const daysAgo = total - 1 - index;
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return `${daysAgo}d ago`;
}

function SparkTooltip({ active, payload, label }: SparkTooltipProps) {
  if (!active || !payload?.length) return null;
  const price = payload[0].value;
  const total = payload[0].payload.total;
  const dayLabel = relativeLabel(label ?? 0, total);
  return (
    <div className="bg-[#1f1f1f] border border-[#2a2a2a] rounded px-2 py-1 text-[11px] leading-tight pointer-events-none">
      <span className="text-gray-500">{dayLabel}</span>
      <span className="text-white font-semibold ml-1.5">
        ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

export function Sparkline({ data, positive }: Props) {
  const color = positive ? '#22c55e' : '#ef4444';
  const total = data.length;
  const chartData = data.map((v, i) => ({ i, v, total }));

  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <YAxis domain={['auto', 'auto']} hide />
        <Tooltip
          content={<SparkTooltip />}
          cursor={{ stroke: '#2a2a2a', strokeWidth: 1 }}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={color}
          fillOpacity={0.15}
          dot={false}
          activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
