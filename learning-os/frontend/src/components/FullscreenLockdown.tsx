import { useEffect, useRef, useState } from 'react';
import { Shield, Clock, AlertTriangle, Fullscreen, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface Violation {
  type: string;
  timestamp: number;
  message: string;
  penalized?: boolean;
}

interface FullscreenLockdownProps {
  children: React.ReactNode;
  isActive: boolean;
  testName: string;
  timeLeft: number;
  violations: Violation[];
  violationCount: number;
  maxViolations: number;
  onEnterFullscreen: () => Promise<boolean>;
  onViolation: (message: string) => void;
}

export function FullscreenLockdown({
  children,
  isActive,
  testName,
  timeLeft,
  violations,
  violationCount,
  maxViolations,
  onEnterFullscreen,
  onViolation
}: FullscreenLockdownProps) {
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [currentViolation, setCurrentViolation] = useState<Violation | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasShownViolationWarningRef = useRef(false);

  // Check fullscreen status
  useEffect(() => {
    const checkFullscreen = () => {
      const fullscreenActive = !!(document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        (document as any).mozFullScreenElement);
      setIsFullscreen(fullscreenActive);
    };

    checkFullscreen();
    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('webkitfullscreenchange', checkFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
      document.removeEventListener('webkitfullscreenchange', checkFullscreen);
    };
  }, []);

  // Handle new violations — reset ref so each new violation shows
  useEffect(() => {
    if (violations.length > 0) {
      if (hasShownViolationWarningRef.current) return;
      hasShownViolationWarningRef.current = true;

      const latest = violations[violations.length - 1];
      setCurrentViolation(latest);
      setShowViolationAlert(true);
      if (latest.penalized !== false) {
        onViolation(latest.message);
      }

      const timer = setTimeout(() => {
        setShowViolationAlert(false);
        // Reset so the NEXT violation can show a new alert
        hasShownViolationWarningRef.current = false;
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [violations, onViolation]);

  // Format time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get timer color based on time left
  const getTimerColor = () => {
    if (timeLeft < 300) return 'text-status-error animate-pulse'; // Less than 5 min
    if (timeLeft < 900) return 'text-amber-500'; // Less than 15 min
    return 'text-status-ok';
  };

  if (!isActive) {
    return <>{children}</>;
  }

  // Pre-test fullscreen gate
  if (!isFullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-console-bg flex flex-col items-center justify-center">
        <div className="max-w-lg w-full mx-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-accent-primary to-accent-dark rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-accent-primary/20">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-text-primary tracking-tight mb-2">Secure Assessment</h1>
            <p className="text-text-muted font-medium">Enterprise Proctored Environment</p>
          </div>

          {/* Test Info Card */}
          <div className="bg-console-surface/80 border border-white/5 rounded-2xl p-6 mb-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-accent-primary/10 rounded-xl flex items-center justify-center border border-accent-primary/20">
                <Fullscreen className="w-5 h-5 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-lg font-black text-text-primary tracking-tight">{testName}</h2>
                <p className="text-sm text-text-muted font-medium">Technical Assessment</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-text-secondary">
                <ChevronRight className="w-4 h-4 text-accent-primary" />
                <span>Fullscreen mode is required throughout the test</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary">
                <ChevronRight className="w-4 h-4 text-accent-primary" />
                <span>Tab switching or window switching will trigger violations</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary">
                <ChevronRight className="w-4 h-4 text-accent-primary" />
                <span>{maxViolations} violation(s) allowed before auto-termination</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onEnterFullscreen}
            className="w-full bg-gradient-to-r from-accent-primary to-accent-dark text-white font-black py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-accent-primary/20 hover:scale-[1.02] active:scale-95 uppercase tracking-widest text-sm"
          >
            <div className="flex items-center justify-center gap-2">
              <Fullscreen className="w-5 h-5" />
              Enter Fullscreen & Start Test
            </div>
          </button>

          <p className="text-center text-[10px] text-text-muted/60 mt-4 uppercase tracking-wider font-bold">
            By entering fullscreen, you agree to the proctoring terms and conditions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-console-bg">
      {/* Violation Alert Overlay */}
      {showViolationAlert && currentViolation && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000]">
          <div className={cn(
            "border rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl animate-pulse",
            currentViolation.penalized === false 
              ? 'bg-accent-primary/90 border-accent-primary/50' 
              : 'bg-status-error/90 border-status-error/50'
          )}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-white" />
              <div>
                <p className="font-black text-white uppercase tracking-widest text-xs">
                  {currentViolation.penalized === false ? 'Action Blocked' : 'Proctoring Violation'}
                </p>
                <p className="text-white/80 text-sm font-medium">{currentViolation.message}</p>
                {currentViolation.penalized === false ? (
                  <p className="text-white/60 text-xs mt-1 font-medium">No penalty applied. Continue your test.</p>
                ) : (
                  <p className="text-white/60 text-xs mt-1 font-bold">
                    Warning {violationCount} of {maxViolations} — Test will terminate on next violation
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="h-14 bg-console-surface/60 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-6">
        {/* Left: Test Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-status-ok" />
            <span className="text-text-primary font-black text-sm uppercase tracking-widest">{testName}</span>
          </div>
          <div className="h-6 w-px bg-white/5" />
          <div className="flex items-center gap-2 text-text-muted text-[10px] font-black uppercase tracking-widest">
            <span>Secure Mode Active</span>
            <span className="w-2 h-2 bg-status-ok rounded-full animate-pulse" />
          </div>
        </div>

        {/* Center: Timer */}
        <div className="flex items-center gap-3">
          <Clock className={cn("w-5 h-5", getTimerColor())} />
          <span className={cn("font-mono text-xl font-black", getTimerColor())}>
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Right: Violation Counter */}
        <div className="flex items-center gap-4">
          <div className={cn(
            "text-[10px] font-black uppercase tracking-widest",
            violationCount >= maxViolations - 1 ? 'text-status-error' : 'text-text-muted'
          )}>
            Warnings: {violationCount}/{maxViolations}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
        {children}
      </div>
    </div>
  );
}
