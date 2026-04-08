import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Activity, Zap, Scale } from 'lucide-react';

interface PhysicalStatsCardProps {
  height: number; // in cm
  weight: number; // in kg
  age: number;
  gender: 'male' | 'female';
  activityLevel: number; // multiplier 1.2 to 1.9
  className?: string;
}

export const PhysicalStatsCard: React.FC<PhysicalStatsCardProps> = ({
  height,
  weight,
  age,
  gender,
  activityLevel,
  className,
}) => {
  // BMI calculation
  const bmi = weight / (Math.pow(height / 100, 2));
  
  // BMR (Mifflin-St Jeor Equation)
  const bmr = (10 * weight) + (6.25 * height) - (5 * age) + (gender === 'male' ? 5 : -161);
  
  // TDEE
  const tdee = Math.round(bmr * activityLevel);

  const getBmiCategory = () => {
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-500', bg: 'bg-blue-500/10' };
    if (bmi < 25) return { label: 'Healthy', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    if (bmi < 30) return { label: 'Overweight', color: 'text-amber-500', bg: 'bg-amber-500/10' };
    return { label: 'Obese', color: 'text-rose-500', bg: 'bg-rose-500/10' };
  };

  const category = getBmiCategory();

  return (
    <Card className={cn(
      "p-6 space-y-6 transition-all duration-300",
      "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-xl",
      className
    )}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Derived Health Metrics</h3>
        <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-current", category.bg, category.color)}>
          {category.label}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
           {/* BMI Display */}
           <div className="space-y-1">
             <div className="flex items-center space-x-2 text-muted-foreground">
               <Scale className="h-3 w-3" />
               <span className="text-[10px] font-bold uppercase tracking-wider">BMI</span>
             </div>
             <p className="text-3xl font-black text-foreground">{bmi.toFixed(1)}</p>
           </div>

           {/* Health Meter Mockup */}
           <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full relative overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-1000", 
                  bmi < 18.5 ? "bg-blue-500" : bmi < 25 ? "bg-emerald-500" : bmi < 30 ? "bg-amber-500" : "bg-rose-500"
                )} 
                style={{ width: `${Math.min((bmi / 40) * 100, 100)}%` }} 
              />
           </div>
        </div>

        <div className="space-y-6">
           <div className="space-y-1">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Zap className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">BMR</span>
              </div>
              <p className="text-xl font-black text-foreground">{Math.round(bmr)} <span className="text-xs font-normal">kcal</span></p>
           </div>

           <div className="space-y-1">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Estimated TDEE</span>
              </div>
              <p className="text-xl font-black text-primary">{tdee} <span className="text-xs font-normal">kcal/day</span></p>
           </div>
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900">
         <p className="text-[10px] text-muted-foreground italic">
           * Metrics are estimated based on the Mifflin-St Jeor equation. Consult a professional for precise medical assessments.
         </p>
      </div>
    </Card>
  );
};
