import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  className?: string;
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  label, 
  className = '',
  showPercentage = true
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1.5 px-1">
        {label && (
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">
            {label}
          </span>
        )}
        {showPercentage && (
          <span className="text-[10px] font-mono font-medium text-zinc-500">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800/50 relative">
        {/* Glow effect */}
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent blur-sm -translate-x-full animate-[shimmer_2s_infinite]"
          style={{ width: '200%' }}
        />
        
        {/* Progress Fill */}
        <div 
          className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 transition-all duration-500 ease-out relative"
          style={{ width: `${progress}%` }}
        >
          {/* Internal Shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] animate-[shimmer_1.5s_infinite] opacity-30" />
          
          {/* Subtle top light */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/20 rounded-full" />
        </div>
      </div>
    </div>
  );
};
