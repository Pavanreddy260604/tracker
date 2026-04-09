import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMetricHistory, getWeeklyReport } from '../api/monitoringApi';
import { ProgressChart } from '../components/premium/ProgressChart';
import { WeeklyReportCard } from '../components/premium/WeeklyReportCard';
import { MetricLogger } from '../components/premium/MetricLogger';
import { Button } from '../components/ui/button';
import { ChevronLeft, LayoutDashboard, TrendingUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ProgressScreen: React.FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metricType, setMetricType] = useState<'weight' | 'volume'>('weight');
  const [limit, setLimit] = useState<number>(30);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [historyData, reportData] = await Promise.all([
        getMetricHistory(metricType, limit),
        getWeeklyReport()
      ]);
      setHistory(historyData);
      setReport(reportData);
    } catch (error) {
      console.error('Failed to fetch progress data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [metricType, limit]);

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
          <div className="w-10" /> {/* Spacer */}
        </header>

        <main className="grid gap-6 md:grid-cols-2">
          {/* Left Column - Real-time Trends */}
          <div className="space-y-6">
            <MetricLogger onSuccess={fetchData} />
            
            <div className="flex items-center justify-between">
              <Tabs defaultValue="weight" className="flex-1 max-w-[250px]" onValueChange={(v) => setMetricType(v as any)}>
                <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                  <TabsTrigger value="weight">Body Weight</TabsTrigger>
                  <TabsTrigger value="volume">Volume</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center space-x-1 bg-muted/50 rounded-lg p-1">
                {[7, 30, 90].map(days => (
                  <button 
                    key={days}
                    onClick={() => setLimit(days)}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-md transition-all",
                      limit === days ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mt-4">
              {loading ? (
                 <div className="h-[300px] w-full bg-muted animate-pulse rounded-2xl" />
              ) : (
                <ProgressChart 
                  title={metricType === 'weight' ? "Weight Trend" : "Volume Trend"}
                  data={history.map(h => ({ date: h.createdAt || new Date().toISOString(), value: h.value }))}
                  metricUnit={metricType === 'weight' ? "kg" : "kg"}
                />
              )}
            </div>
          </div>

          {/* Right Column - Deep Insights */}
          <div className="space-y-6">
            {report ? (
              <WeeklyReportCard 
                totalVolume={report.totalVolume}
                adherenceScore={report.adherenceScore}
                status={report.status}
                highlights={report.interventions || [
                  "Consistency is high this week.",
                  "Protein intake met 5/7 days.",
                  "Workout volume increased by 3.2%."
                ]}
              />
            ) : (
              <div className="h-[400px] w-full bg-muted animate-pulse rounded-2xl" />
            )}

            <Card className="p-6 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4 bg-muted/20">
              <div className="rounded-full bg-primary/10 p-4 text-primary">
                <LayoutDashboard className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold">Next Milestone</h4>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  Hit 3 more workouts this week to unlock the "Consistent Warrior" badge.
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
