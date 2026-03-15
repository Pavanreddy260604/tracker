import { useEffect, useCallback, useRef, useState } from 'react';

type ViolationType =
  | 'tab_switch'
  | 'focus_loss'
  | 'fullscreen_exit'
  | 'mouse_idle'
  | 'key_pattern'
  | 'devtools_detected'
  | 'integrity_violation'
  | 'paste_detected'
  | 'automation_detected';

interface SecureViolation {
  type: ViolationType;
  timestamp: number;
  message: string;
  penalized: boolean;
  clientProof: string;
  sequenceNumber: number;
  mouseTrail?: { x: number; y: number; t: number }[];
  keystrokeDynamics?: { key: string; pressTime: number; releaseTime: number }[];
}

interface UseSecureProctoringProps {
  sessionId: string;
  secret: string;
  onViolation: (violation: SecureViolation) => void;
  onTerminate: () => void;
  maxViolations?: number;
  enableKeystrokeTracking?: boolean;
  enableMouseTracking?: boolean;
  enableIntegrityChecks?: boolean;
}

interface UseSecureProctoringReturn {
  violations: SecureViolation[];
  violationCount: number;
  isLocked: boolean;
  enterFullscreen: () => Promise<boolean>;
  generateEventProof: (type: ViolationType, data?: Record<string, unknown>) => string;
  terminateTest: () => void;
}

export function useSecureProctoring({
  sessionId,
  secret,
  onViolation,
  onTerminate,
  maxViolations = 2,
  enableKeystrokeTracking = true,
  enableMouseTracking = true,
  enableIntegrityChecks = true
}: UseSecureProctoringProps): UseSecureProctoringReturn {
  const [violations, setViolations] = useState<SecureViolation[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  
  const violationCountRef = useRef(0);
  const lastViolationTimestampRef = useRef(0);
  const sequenceNumberRef = useRef(0);
  const isTerminatingRef = useRef(false);
  const mouseTrailRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const keystrokeBufferRef = useRef<{ key: string; pressTime: number; releaseTime: number }[]>([]);
  const integrityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const expectedHashRef = useRef<string>('');

  // Generate HMAC proof for server verification (async due to Web Crypto API)
  const generateEventProof = useCallback(async (
    type: ViolationType,
    data?: Record<string, unknown>
  ): Promise<string> => {
    sequenceNumberRef.current++;
    const timestamp = Date.now();
    const seq = sequenceNumberRef.current;
    
    // Create HMAC of event data using Web Crypto API
    const dataStr = JSON.stringify({ sessionId, type, timestamp, seq, ...data });
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(dataStr);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }, [sessionId, secret]);

  // Record a violation with cryptographic proof (now async)
  const recordViolation = useCallback(async (
    type: ViolationType,
    message: string,
    extraData?: Record<string, unknown>
  ): Promise<void> => {
    if (isTerminatingRef.current) return;

    const now = Date.now();
    
    // Rate limit violations (1.2s between violations)
    if (now - lastViolationTimestampRef.current < 1200) return;
    lastViolationTimestampRef.current = now;

    const clientProof = await generateEventProof(type, extraData);

    const violation: SecureViolation = {
      type,
      timestamp: now,
      message,
      penalized: true,
      clientProof,
      sequenceNumber: sequenceNumberRef.current,
      mouseTrail: enableMouseTracking ? [...mouseTrailRef.current] : undefined,
      keystrokeDynamics: enableKeystrokeTracking ? [...keystrokeBufferRef.current] : undefined
    };

    // Clear buffers after recording
    mouseTrailRef.current = [];
    keystrokeBufferRef.current = [];

    setViolations(prev => [...prev, violation]);
    onViolation(violation);

    violationCountRef.current++;

    if (violationCountRef.current >= maxViolations) {
      terminateTest();
    }
  }, [generateEventProof, onViolation, maxViolations, enableMouseTracking, enableKeystrokeTracking]);

  // Terminate test
  const terminateTest = useCallback(() => {
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;
    setIsLocked(false);
    onTerminate();
  }, [onTerminate]);

  // Fullscreen enforcement
  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      const element = document.documentElement;
      
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as HTMLElement).webkitRequestFullscreen) {
        await (element as HTMLElement).webkitRequestFullscreen();
      } else if ((element as HTMLElement).msRequestFullscreen) {
        await (element as HTMLElement).msRequestFullscreen();
      }
      
      setIsLocked(true);
      return true;
    } catch (error) {
      console.error('[SecureProctoring] Fullscreen failed:', error);
      return false;
    }
  }, []);

  // Detect dev tools
  useEffect(() => {
    if (!enableIntegrityChecks) return;

    const threshold = 160;
    let devToolsOpen = false;

    const checkDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if ((widthThreshold || heightThreshold) && !devToolsOpen) {
        devToolsOpen = true;
        recordViolation(
          'devtools_detected',
          'Developer tools detected - potential inspection/copying',
          { widthDiff: window.outerWidth - window.innerWidth }
        );
      } else if (!widthThreshold && !heightThreshold) {
        devToolsOpen = false;
      }
    };

    // Check every second
    const interval = window.setInterval(checkDevTools, 1000);

    // Also detect via debugger timing
    const detectDebugger = () => {
      const start = performance.now();
      debugger;
      const end = performance.now();
      
      if (end - start > 100) {
        recordViolation(
          'devtools_detected',
          'Debugger statement triggered - developer tools likely open'
        );
      }
    };

    // Periodic debugger detection
    const debuggerInterval = window.setInterval(detectDebugger, 5000);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(debuggerInterval);
    };
  }, [recordViolation, enableIntegrityChecks]);

  // Fullscreen change detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (isTerminatingRef.current) return;

      const fullscreenActive = !!(
        document.fullscreenElement ||
        (document as Document).webkitFullscreenElement ||
        (document as Document).mozFullScreenElement ||
        (document as Document).msFullscreenElement
      );

      if (!fullscreenActive && isLocked) {
        setIsLocked(false);
        recordViolation('fullscreen_exit', 'Exited fullscreen mode. Re-enter to continue.');
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

  // Tab/window switching
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

  // Mouse tracking for automation detection
  useEffect(() => {
    if (!enableMouseTracking || !isLocked) return;

    let lastX = 0;
    let lastY = 0;
    let lastT = Date.now();

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const t = now;
      const x = e.clientX;
      const y = e.clientY;

      // Calculate speed
      const dt = t - lastT;
      const dx = x - lastX;
      const dy = y - lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = dt > 0 ? distance / dt : 0;

      // Detect teleportation (instant moves)
      if (distance > 500 && dt < 10) {
        recordViolation(
          'automation_detected',
          'Mouse cursor teleportation detected',
          { distance, timeDelta: dt }
        );
      }

      // Add to trail (keep last 50 points)
      mouseTrailRef.current.push({ x, y, t });
      if (mouseTrailRef.current.length > 50) {
        mouseTrailRef.current.shift();
      }

      lastX = x;
      lastY = y;
      lastT = t;
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isLocked, recordViolation, enableMouseTracking]);

  // Keystroke tracking for external help detection
  useEffect(() => {
    if (!enableKeystrokeTracking || !isLocked) return;

    const keyTimings: Record<string, number> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keyTimings[e.key] = Date.now();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const pressTime = keyTimings[e.key];
      if (!pressTime) return;

      const releaseTime = Date.now();
      
      keystrokeBufferRef.current.push({
        key: e.key,
        pressTime,
        releaseTime
      });

      // Keep last 100 keystrokes
      if (keystrokeBufferRef.current.length > 100) {
        keystrokeBufferRef.current.shift();
      }

      delete keyTimings[e.key];
    };

    // Detect paste operations
    const handlePaste = (e: ClipboardEvent) => {
      recordViolation('paste_detected', 'Paste operation detected in editor', {
        target: (e.target as HTMLElement)?.tagName
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('paste', handlePaste, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('paste', handlePaste, true);
    };
  }, [isLocked, recordViolation, enableKeystrokeTracking]);

  // Integrity checks (verify code hasn't been tampered with)
  useEffect(() => {
    if (!enableIntegrityChecks || !isLocked) return;

    // Calculate hash of critical proctoring code
    const calculateIntegrityHash = () => {
      // In production, this would hash the actual proctoring code
      // For now, return a placeholder
      return 'integrity-hash-' + Date.now();
    };

    expectedHashRef.current = calculateIntegrityHash();

    integrityCheckIntervalRef.current = window.setInterval(() => {
      const currentHash = calculateIntegrityHash();
      
      if (currentHash !== expectedHashRef.current) {
        recordViolation(
          'integrity_violation',
          'Proctoring code integrity check failed - possible tampering'
        );
      }
    }, 5000);

    return () => {
      if (integrityCheckIntervalRef.current) {
        window.clearInterval(integrityCheckIntervalRef.current);
      }
    };
  }, [isLocked, recordViolation, enableIntegrityChecks]);

  // Prevent certain keyboard shortcuts
  useEffect(() => {
    if (!isLocked) return;

    const preventShortcuts = (e: KeyboardEvent) => {
      // Prevent F12, Ctrl+Shift+I, Cmd+Option+I (dev tools)
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') ||
          (e.metaKey && e.altKey && e.key.toLowerCase() === 'i')) {
        e.preventDefault();
        recordViolation('devtools_detected', 'Attempted to open developer tools');
      }

      // Prevent Ctrl+U (view source)
      if (e.ctrlKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
      }

      // Prevent Ctrl+Shift+J (console)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
      }

      // Prevent Ctrl+S (save page)
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
      }

      // Prevent Ctrl+P (print)
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
      }

      // Prevent Alt+Tab detection (when window loses focus via blur handler)
    };

    document.addEventListener('keydown', preventShortcuts);

    return () => {
      document.removeEventListener('keydown', preventShortcuts);
    };
  }, [isLocked, recordViolation]);

  return {
    violations,
    violationCount: violationCountRef.current,
    isLocked,
    enterFullscreen,
    generateEventProof,
    terminateTest
  };
}
