import { useEffect, useCallback, useRef, useState } from 'react';

type ViolationType =
  | 'tab_switch'
  | 'focus_loss'
  | 'fullscreen_exit';

interface Violation {
  type: ViolationType;
  timestamp: number;
  message: string;
  penalized: boolean;
}

interface UseStrictProctoringProps {
  onViolation: (violation: Violation) => void;
  onTerminate: () => void;
  maxViolations?: number;
}

export function useStrictProctoring({ onViolation, onTerminate, maxViolations = 2 }: UseStrictProctoringProps) {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const violationCountRef = useRef(0);
  const lastViolationTimestampRef = useRef(0);
  const isTerminatingRef = useRef(false);
  const lockdownRef = useRef<HTMLDivElement | null>(null);

  const terminateTest = useCallback(() => {
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;
    
    // Release all locks
    setIsLocked(false);
    
    // Call termination handler
    onTerminate();
  }, [onTerminate]);

  const recordViolation = useCallback((type: ViolationType, message: string) => {
    if (isTerminatingRef.current) return;
    const now = Date.now();
    if (now - lastViolationTimestampRef.current < 1200) return;
    lastViolationTimestampRef.current = now;

    const violation: Violation = {
      type,
      timestamp: now,
      message,
      penalized: true,
    };

    setViolations(prev => [...prev, violation]);
    onViolation(violation);

    violationCountRef.current += 1;

    if (violationCountRef.current >= maxViolations) {
      terminateTest();
    }
  }, [onViolation, terminateTest, maxViolations]);

  // Fullscreen enforcement
  const enterFullscreen = useCallback(async () => {
    try {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      }
      setIsLocked(true);
      return true;
    } catch (error) {
      console.error('Fullscreen failed:', error);
      return false;
    }
  }, []);

  // Prevent silent fullscreen exits. Re-entry must be user-initiated.
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (isTerminatingRef.current) return;

      const fullscreenActive = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!fullscreenActive && isLocked) {
        setIsLocked(false);
        recordViolation('fullscreen_exit', 'Exited fullscreen mode. Re-enter fullscreen to continue.');
      } else if (fullscreenActive && !isLocked) {
        setIsLocked(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isLocked, recordViolation]);

  // Tab/window switching detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isLocked) {
        recordViolation('tab_switch', 'Switched to another tab or window');
      }
    };

    const handleBlur = () => {
      if (isLocked) {
        recordViolation('focus_loss', 'Window lost focus');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isLocked, recordViolation]);

  return {
    violations,
    violationCount: violationCountRef.current,
    isLocked,
    enterFullscreen,
    terminateTest,
    lockdownRef
  };
}
