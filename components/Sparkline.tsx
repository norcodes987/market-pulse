'use client';

import { AreaChart, Area, YAxis, ResponsiveContainer } from 'recharts';

interface Props {
  data: number[];
  positive: boolean;
}

export function Sparkline({ data, positive }: Props) {
  const color = positive ? '#22c55e' : '#ef4444';
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <YAxis domain={['auto', 'auto']} hide />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={color}
          fillOpacity={0.15}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
