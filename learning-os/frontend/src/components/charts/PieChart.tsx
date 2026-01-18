import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface PieChartData {
    name: string;
    value: number;
    color?: string;
}

interface PieChartProps {
    data: PieChartData[];
    title?: string;
    className?: string;
    showLegend?: boolean;
    innerRadius?: number;
    outerRadius?: number;
}

const COLORS = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#ec4899', // pink
    '#6366f1', // indigo
];

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="bg-[#1c2128] border border-white/10 rounded-lg px-3 py-2 shadow-lg">
            <p className="text-white font-medium">{payload[0].name}</p>
            <p className="text-gray-400 text-sm">{payload[0].value} problems</p>
        </div>
    );
};

export function TopicPieChart({
    data,
    title,
    className,
    showLegend = true,
    innerRadius = 60,
    outerRadius = 100,
}: PieChartProps) {
    if (data.length === 0) {
        return (
            <div className={cn('flex items-center justify-center h-[300px] text-gray-500', className)}>
                No data to display
            </div>
        );
    }

    const chartData = data.map((item, index) => ({
        ...item,
        color: item.color || COLORS[index % COLORS.length],
    }));

    return (
        <motion.div
            className={className}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            {title && (
                <h3 className="text-sm font-semibold text-gray-400 mb-4">{title}</h3>
            )}
            <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={innerRadius}
                        outerRadius={outerRadius}
                        paddingAngle={2}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={800}
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                stroke="transparent"
                            />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    {showLegend && (
                        <Legend
                            layout="vertical"
                            align="right"
                            verticalAlign="middle"
                            formatter={(value) => (
                                <span className="text-sm text-gray-300">{value}</span>
                            )}
                        />
                    )}
                </RechartsPie>
            </ResponsiveContainer>
        </motion.div>
    );
}
