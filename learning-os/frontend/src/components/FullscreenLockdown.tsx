import { useEffect, useRef, useState } from 'react';
import { Shield, Clock, AlertTriangle, Fullscreen, ChevronRight } from 'lucide-react';

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

  // Handle new violations
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

      // Show a single transient warning, then return to normal state.
      const timer = setTimeout(() => {
        setShowViolationAlert(false);
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
    if (timeLeft < 300) return 'text-red-500 animate-pulse'; // Less than 5 min
    if (timeLeft < 900) return 'text-yellow-500'; // Less than 15 min
    return 'text-green-400';
  };

  if (!isActive) {
    return <>{children}</>;
  }

  // Pre-test fullscreen gate
  if (!isFullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center">
        <div className="max-w-lg w-full mx-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Secure Assessment</h1>
            <p className="text-slate-400">Enterprise Proctored Environment</p>
          </div>

          {/* Test Info Card */}
          <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Fullscreen className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{testName}</h2>
                <p className="text-sm text-slate-400">Technical Assessment</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <ChevronRight className="w-4 h-4 text-blue-400" />
                <span>Fullscreen mode is required throughout the test</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <ChevronRight className="w-4 h-4 text-blue-400" />
                <span>Tab switching or window switching will terminate the test</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <ChevronRight className="w-4 h-4 text-blue-400" />
                <span>{maxViolations} violation(s) allowed before auto-termination</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onEnterFullscreen}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          >
            <div className="flex items-center justify-center gap-2">
              <Fullscreen className="w-5 h-5" />
              Enter Fullscreen & Start Test
            </div>
          </button>

          <p className="text-center text-xs text-slate-500 mt-4">
            By entering fullscreen, you agree to the proctoring terms and conditions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950">
      {/* Violation Alert Overlay */}
      {showViolationAlert && currentViolation && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000]">
          <div className={`${currentViolation.penalized === false ? 'bg-blue-600/95 border-blue-500' : 'bg-red-600/95 border-red-500'} border rounded-xl px-6 py-4 shadow-2xl animate-pulse`}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-white" />
              <div>
                <p className="font-semibold text-white">
                  {currentViolation.penalized === false ? 'Action Blocked' : 'Proctoring Violation Detected'}
                </p>
                <p className="text-slate-100 text-sm">{currentViolation.message}</p>
                {currentViolation.penalized === false ? (
                  <p className="text-slate-200 text-xs mt-1">No penalty applied. Continue your test.</p>
                ) : (
                  <p className="text-red-200 text-xs mt-1">
                    Violation {violationCount} of {maxViolations} - Test will terminate on next violation
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar - Minimal */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
        {/* Left: Test Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            <span className="text-white font-medium">{testName}</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <span>Secure Mode Active</span>
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Center: Timer */}
        <div className="flex items-center gap-3">
          <Clock className={`w-5 h-5 ${getTimerColor()}`} />
          <span className={`font-mono text-xl font-bold ${getTimerColor()}`}>
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Right: Violation Counter */}
        <div className="flex items-center gap-4">
          <div className={`text-sm font-medium ${violationCount >= maxViolations - 1 ? 'text-red-400' : 'text-slate-400'}`}>
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
