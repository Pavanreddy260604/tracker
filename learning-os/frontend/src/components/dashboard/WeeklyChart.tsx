import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { getDayName } from '../../lib/utils';

interface WeeklyData {
    date: string;
    dsaHours: number;
    backendHours: number;
    projectHours: number;
    totalHours: number;
}

interface WeeklyChartProps {
    data: WeeklyData[];
    className?: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
    if (!active || !payload) return null;

    return (
        <div className="bg-[#1c2128] border border-white/10 rounded-lg p-3 shadow-lg">
            <p className="text-white font-medium mb-2">{getDayName(label || '')}</p>
            {payload.map((entry, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-gray-400">{entry.name}:</span>
                    <span className="text-white font-medium">{entry.value}h</span>
                </div>
            ))}
        </div>
    );
};

export function WeeklyChart({ data, className }: WeeklyChartProps) {
    const today = new Date().toISOString().split('T')[0];

    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data} barCategoryGap="20%">
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#8b949e', fontSize: 12 }}
                        tickFormatter={(value) => getDayName(value)}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6e7681', fontSize: 11 }}
                        tickFormatter={(value) => `${value}h`}
                        width={35}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar
                        dataKey="dsaHours"
                        stackId="hours"
                        fill="#3b82f6"
                        radius={[0, 0, 0, 0]}
                        name="DSA"
                    />
                    <Bar
                        dataKey="backendHours"
                        stackId="hours"
                        fill="#8b5cf6"
                        radius={[0, 0, 0, 0]}
                        name="Backend"
                    />
                    <Bar
                        dataKey="projectHours"
                        stackId="hours"
                        fill="#06b6d4"
                        radius={[4, 4, 0, 0]}
                        name="Project"
                    >
                        {data.map((entry) => (
                            <Cell
                                key={entry.date}
                                opacity={entry.date === today ? 1 : 0.7}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
                {[
                    { color: '#3b82f6', label: 'DSA' },
                    { color: '#8b5cf6', label: 'Backend' },
                    { color: '#06b6d4', label: 'Project' },
                ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                        <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: color }}
                        />
                        <span className="text-gray-400">{label}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
