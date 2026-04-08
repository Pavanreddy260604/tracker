import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DataPoint {
  date: string;
  value: number;
}

interface ProgressChartProps {
  title: string;
  data: DataPoint[];
  metricUnit: string;
  color?: string;
  className?: string;
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-black text-foreground">
          {payload[0].value} <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{unit}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const ProgressChart: React.FC<ProgressChartProps> = ({
  title,
  data,
  metricUnit,
  color = "hsl(var(--primary))",
  className,
}) => {
  // Format dates for display
  const formattedData = data.map(d => ({
    ...d,
    displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <Card className={cn(
      "p-6 space-y-4 transition-all duration-300",
      "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-lg",
      className
    )}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black tracking-tight text-foreground">{title}</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded">
          Last {data.length} entries
        </span>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
            <XAxis 
              dataKey="displayDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip content={<CustomTooltip unit={metricUnit} />} />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
