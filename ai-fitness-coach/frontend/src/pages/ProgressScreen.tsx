import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMetricHistory, getWeeklyReport } from '../api/monitoringApi';
import { ProgressChart } from '../components/premium/ProgressChart';
import { WeeklyReportCard } from '../components/premium/WeeklyReportCard';
import { MetricLogger } from '../components/premium/MetricLogger';
import { Button } from '../components/ui/button';
import { ChevronLeft, LayoutDashboard, TrendingUp, AlertCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ProgressScreen: React.FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricType, setMetricType] = useState<'weight' | 'bodyfat'>('weight');
  const [limit, setLimit] = useState<number>(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyData, reportData] = await Promise.all([
        getMetricHistory(metricType, limit),
        getWeeklyReport(),
      ]);
      setHistory(Array.isArray(historyData) ? historyData : []);
      setReport(reportData);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to load progress data';
      setError(msg);
      console.error('Failed to fetch progress data', err);
    } finally {
      setLoading(false);
    }
  }, [metricType, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive adherence score from days logged out of 7
  const adherenceScore = report
    ? Math.min(100, Math.round(((report.nutritionSummary?.daysLogged ?? 0) / 7) * 100))
    : 0;

  // Normalize status to uppercase for WeeklyReportCard
  const reportStatus = report?.status
    ? (report.status.toUpperCase() as 'PROGRESSING' | 'STAGNANT' | 'REGRESSING')
    : 'STAGNANT';

  // Build highlights from report data
  const highlights: string[] = [];
  if (report) {
    const sessions = report.workoutSummary?.sessionCount ?? 0;
    const daysLogged = report.nutritionSummary?.daysLogged ?? 0;
    const weightChange = report.metrics?.weightChange ?? 0;
    const streak = report.streak?.current ?? 0;

    if (sessions > 0) highlights.push(`${sessions} workout${sessions !== 1 ? 's' : ''} completed this week.`);
    else highlights.push('No workouts logged yet — start your first session!');

    if (daysLogged > 0) highlights.push(`Nutrition tracked ${daysLogged}/7 days this week.`);
    else highlights.push('Start logging meals to unlock nutrition insights.');

    if (Math.abs(weightChange) > 0) {
      highlights.push(`Body weight ${weightChange > 0 ? '+' : ''}${weightChange}kg vs last week.`);
    }
    if (streak > 0) highlights.push(`Current streak: ${streak} day${streak !== 1 ? 's' : ''} strong!`);
  }

  if (highlights.length === 0) {
    highlights.push('Log your first workout and meal to see insights here.');
  }

  return (
    <div className="min-h-screen bg-background text-foreground animate-in fade-in duration-500 pb-24">
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Analytics</h1>
            <p className="text-xs font-medium text-primary flex items-center justify-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              Progress Trends
            </p>
          </div>
          <div className="w-10" />
        </header>

        {error && (
          <div className="flex items-center space-x-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchData} className="ml-auto">Retry</Button>
          </div>
        )}

        <main className="grid gap-6 md:grid-cols-2">
          {/* Left Column - Real-time Trends */}
          <div className="space-y-6">
            <MetricLogger onSuccess={fetchData} />

            <div className="flex items-center justify-between">
              <Tabs
                defaultValue="weight"
                className="flex-1 max-w-[240px]"
                onValueChange={(v) => setMetricType(v as 'weight' | 'bodyfat')}
              >
                <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                  <TabsTrigger value="weight">Weight</TabsTrigger>
                  <TabsTrigger value="bodyfat">Body Fat</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center space-x-1 bg-muted/50 rounded-lg p-1">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setLimit(days)}
                    className={cn(
                      'px-3 py-1 text-xs font-bold rounded-md transition-all',
                      limit === days
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>

            <div>
              {loading ? (
                <div className="h-[300px] w-full bg-muted animate-pulse rounded-2xl" />
              ) : history.length > 0 ? (
                <ProgressChart
                  title={metricType === 'weight' ? 'Weight Trend' : 'Body Fat Trend'}
                  data={history.map((h) => ({
                    date: h.timestamp || h.createdAt || new Date().toISOString(),
                    value: h.value,
                  }))}
                  metricUnit={metricType === 'weight' ? 'kg' : '%'}
                />
              ) : (
                <div className="h-[300px] w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center space-y-3 opacity-50">
                  <TrendingUp className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-bold text-sm">No data yet</p>
                    <p className="text-xs text-muted-foreground">
                      Log your {metricType === 'weight' ? 'body weight' : 'body fat %'} above to start tracking.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Deep Insights */}
          <div className="space-y-6">
            {loading ? (
              <div className="h-[400px] w-full bg-muted animate-pulse rounded-2xl" />
            ) : report ? (
              <WeeklyReportCard
                totalVolume={report.workoutSummary?.totalVolume ?? 0}
                adherenceScore={adherenceScore}
                status={reportStatus}
                highlights={highlights}
              />
            ) : (
              <div className="h-[400px] w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center space-y-3 opacity-50">
                <LayoutDashboard className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Weekly report not available</p>
              </div>
            )}

            <Card className="p-6 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4 bg-muted/20">
              <div className="rounded-full bg-primary/10 p-4 text-primary">
                <LayoutDashboard className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold">Next Milestone</h4>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  {report?.streak?.current >= 7
                    ? `${report.streak.current} day streak — keep going for 30!`
                    : 'Hit 7 consecutive workouts to unlock the "Consistent Warrior" badge.'}
                </p>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProgressScreen;
