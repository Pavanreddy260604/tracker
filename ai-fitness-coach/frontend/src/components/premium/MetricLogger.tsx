import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Scale } from 'lucide-react';
import { logMetric } from '@/api/monitoringApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MetricLoggerProps {
  onSuccess?: () => void;
  className?: string;
}

export const MetricLogger: React.FC<MetricLoggerProps> = ({ onSuccess, className }) => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLog = async () => {
    if (!value) return;
    setLoading(true);
    try {
      await logMetric('weight', parseFloat(value), 'kg');
      toast.success("Weight logged successfully!");
      setValue('');
      onSuccess?.();
    } catch (error) {
      toast.error("Failed to log weight");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn(
      "p-6 flex items-center justify-between space-x-4",
      "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800",
      className
    )}>
      <div className="flex items-center space-x-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <h4 className="font-bold text-sm">Log Weight</h4>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Daily Tracking</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative max-w-[100px]">
          <Input 
            type="number" 
            placeholder="0.0" 
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-10 text-center pr-8 bg-zinc-50 dark:bg-zinc-900 border-none ring-1 ring-zinc-200 dark:ring-zinc-800"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">kg</span>
        </div>
        <Button size="icon" onClick={handleLog} disabled={loading || !value} className="h-10 w-10">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
