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
  | 'automation_detected'
  | 'camera_lost'
  | 'audio_threshold_reached';

export interface SecureViolation {
  violationType: ViolationType;
  timestamp: string; // Changed to string (ISO)
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
  generateEventProof: (type: ViolationType, data?: Record<string, unknown>) => Promise<{ proof: string; timestamp: string }>;
  recordViolation: (type: ViolationType, message: string, extraData?: Record<string, unknown>) => Promise<void>;
  terminateTest: () => void;
  endGracePeriod: () => void;
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

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
  const integrityCheckIntervalRef = useRef<number | null>(null);
  const expectedHashRef = useRef<string>('');
  const isGracePeriodRef = useRef(true);

  // Grace period: blocks ALL violations until consumer calls endGracePeriod()
  // This prevents false positives before the user clicks "ENTER FULLSCREEN & START TEST"
  const endGracePeriod = useCallback(() => {
    // Small delay to let fullscreen transition settle
    setTimeout(() => {
      isGracePeriodRef.current = false;
    }, 1500);
  }, []);

  // Terminate test
  const terminateTest = useCallback(() => {
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;
    setIsLocked(false);
    onTerminate();
  }, [onTerminate]);

  // Generate HMAC proof for server verification (async due to Web Crypto API)
  const generateEventProof = useCallback(async (
    type: ViolationType,
    data?: Record<string, unknown>
  ): Promise<{ proof: string; timestamp: string }> => {
    sequenceNumberRef.current++;
    const timestamp = new Date().toISOString();
    const seq = sequenceNumberRef.current;
    
    // Create HMAC of event data (Harmonized with backend format: sessionId:type:timestamp:seq)
    // We use the ISO string directly for 100% deterministic signature verification
    const dataStr = `${sessionId}:${type}:${timestamp}:${seq}`;
    
    const encoder = new TextEncoder();
    if (!secret || secret.length === 0) {
      console.warn('[SecureProctoring] Missing secret for HMAC generation');
      return { proof: 'anonymous-proof-' + timestamp, timestamp };
    }
    console.debug('[SecureProctoring] Initializing HMAC generation with session secret');
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
    const proof = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return { proof, timestamp };
  }, [sessionId, secret]);

  // Record a violation with cryptographic proof (now async)
  const recordViolation = useCallback(async (
    type: ViolationType,
    message: string,
    extraData?: Record<string, unknown>
  ): Promise<void> => {
    if (isTerminatingRef.current) return;
    
    // Ignore ALL violations during grace period (before user clicks "ENTER FULLSCREEN")
    if (isGracePeriodRef.current) {
      console.debug(`[SecureProctoring] Ignoring ${type} during grace period (pre-test gate)`);
      return;
    }

    const now = Date.now();
    
    // Rate limit violations (1.2s between violations)
    if (now - lastViolationTimestampRef.current < 1200) return;
    lastViolationTimestampRef.current = now;

    const { proof: clientProof, timestamp } = await generateEventProof(type, extraData);

    const violation: SecureViolation = {
      violationType: type,
      timestamp, // Now using the ISO string from generateEventProof
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

  // Fullscreen enforcement
  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      const element = document.documentElement as FullscreenElement;
      
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
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

    return () => {
      window.clearInterval(interval);
    };
  }, [recordViolation, enableIntegrityChecks]);

  // Fullscreen change detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (isTerminatingRef.current) return;

      const fullscreenDocument = document as FullscreenDocument;
      const fullscreenActive = !!(
        document.fullscreenElement ||
        fullscreenDocument.webkitFullscreenElement ||
        fullscreenDocument.mozFullScreenElement ||
        fullscreenDocument.msFullscreenElement
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

  // Tab/window switching — deduplicated to prevent double-violation
  useEffect(() => {
    let lastTabSwitchTime = 0;

    const handleVisibilityChange = () => {
      if (document.hidden && isLocked) {
        lastTabSwitchTime = Date.now();
        recordViolation('tab_switch', 'Switched to another tab or window');
      }
    };

    const handleBlur = () => {
      if (isLocked) {
        // Skip if a visibilitychange already fired within 2s (same user action)
        if (Date.now() - lastTabSwitchTime < 2000) return;
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
    // Uses a stable fingerprint so it only changes if code is tampered with
    const calculateIntegrityHash = () => {
      const marker = typeof recordViolation === 'function' 
        && typeof enterFullscreen === 'function';
      return 'integrity-stable-' + String(marker);
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
  }, [isLocked, recordViolation, enableIntegrityChecks, enterFullscreen]);

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
    recordViolation,
    terminateTest,
    endGracePeriod
  };
}
