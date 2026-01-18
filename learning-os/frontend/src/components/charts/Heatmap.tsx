import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface HeatmapDay {
    date: string;
    intensity: number; // 0-1
    totalHours: number;
}

interface HeatmapProps {
    data: HeatmapDay[];
    year?: number;
    className?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Heatmap({ data, year = new Date().getFullYear(), className }: HeatmapProps) {
    const { weeks, monthLabels } = useMemo(() => {
        const dataMap = new Map(data.map(d => [d.date, d]));

        // Start from first day of year
        const startDate = new Date(year, 0, 1);
        // Adjust to previous Sunday
        const firstSunday = new Date(startDate);
        firstSunday.setDate(startDate.getDate() - startDate.getDay());

        const endDate = new Date(year, 11, 31);
        const weeks: (HeatmapDay | null)[][] = [];
        const monthLabels: { month: string; weekIndex: number }[] = [];

        let currentDate = new Date(firstSunday);
        let weekIndex = 0;
        let lastMonth = -1;

        while (currentDate <= endDate || weeks[weeks.length - 1]?.length < 7) {
            if (!weeks[weekIndex]) {
                weeks[weekIndex] = [];
            }

            const dateStr = currentDate.toISOString().split('T')[0];
            const dayData = dataMap.get(dateStr);
            const currentMonth = currentDate.getMonth();

            // Track month boundaries
            if (currentMonth !== lastMonth && currentDate.getFullYear() === year) {
                monthLabels.push({ month: MONTHS[currentMonth], weekIndex });
                lastMonth = currentMonth;
            }

            if (currentDate.getFullYear() === year) {
                weeks[weekIndex].push(dayData || { date: dateStr, intensity: 0, totalHours: 0 });
            } else {
                weeks[weekIndex].push(null);
            }

            currentDate.setDate(currentDate.getDate() + 1);

            if (weeks[weekIndex].length === 7) {
                weekIndex++;
            }
        }

        return { weeks, monthLabels };
    }, [data, year]);

    const getIntensityColor = (intensity: number) => {
        if (intensity === 0) return 'bg-[#161b22]';
        if (intensity <= 0.25) return 'bg-green-900/60';
        if (intensity <= 0.5) return 'bg-green-700/70';
        if (intensity <= 0.75) return 'bg-green-500/80';
        return 'bg-green-400';
    };

    return (
        <div className={cn('overflow-x-auto', className)}>
            <div className="inline-block min-w-fit">
                {/* Month labels row */}
                <div className="flex mb-1">
                    {/* Spacer for day labels column */}
                    <div className="w-8 flex-shrink-0" />
                    {/* Months positioned relative to weeks */}
                    <div className="relative flex-1" style={{ height: 16 }}>
                        {monthLabels.map(({ month, weekIndex }, i) => (
                            <span
                                key={`${month}-${i}`}
                                className="absolute text-xs text-gray-500"
                                style={{ left: weekIndex * 14 }}
                            >
                                {month}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex">
                    {/* Day labels column - show Mon, Wed, Fri */}
                    <div className="flex flex-col w-8 flex-shrink-0 text-xs text-gray-500">
                        {DAYS.map((day, i) => (
                            <div
                                key={day}
                                className="flex items-center"
                                style={{ height: 14 }}
                            >
                                {i % 2 === 1 ? day : ''}
                            </div>
                        ))}
                    </div>

                    {/* Heatmap grid */}
                    <div className="flex gap-[3px]">
                        {weeks.map((week, weekIdx) => (
                            <div key={weekIdx} className="flex flex-col gap-[3px]">
                                {week.map((day, dayIdx) => (
                                    <motion.div
                                        key={dayIdx}
                                        className={cn(
                                            'w-[11px] h-[11px] rounded-[2px]',
                                            day ? getIntensityColor(day.intensity) : 'bg-transparent'
                                        )}
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: weekIdx * 0.005 }}
                                        title={day ? `${day.date}: ${day.totalHours}h` : undefined}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
                    <span>Less</span>
                    {[0, 0.25, 0.5, 0.75, 1].map(intensity => (
                        <div
                            key={intensity}
                            className={cn('w-[11px] h-[11px] rounded-[2px]', getIntensityColor(intensity))}
                        />
                    ))}
                    <span>More</span>
                </div>
            </div>
        </div>
    );
}
