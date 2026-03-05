import { useState, useEffect, useCallback, useRef } from 'react';
import { useDialog } from './useDialog';

interface ProctoringConfig {
    strictMode: boolean;
    allowTabSwitch: boolean;
    allowCopyPaste: boolean;
    enforceFullscreen: boolean;
    warnCount: number;
    maxViolations: number;
}

interface Violation {
    type: 'tab_switch' | 'focus_loss' | 'copy_attempt' | 'paste_attempt' | 'fullscreen_exit';
    timestamp: number;
    message: string;
}

export function useProctoring(config: ProctoringConfig) {
    const { showAlert } = useDialog();
    const [violations, setViolations] = useState<Violation[]>([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isProctoringActive, setIsProctoringActive] = useState(false);
    const violationCountRef = useRef(0);
    const lastViolationRef = useRef<Map<string, number>>(new Map());

    // Check if fullscreen is active
    const checkFullscreen = useCallback(() => {
        const fullscreenActive = !!(document.fullscreenElement || 
            (document as any).webkitFullscreenElement || 
            (document as any).mozFullScreenElement ||
            (document as any).msFullscreenElement);
        
        setIsFullscreen(fullscreenActive);
        
        if (config.enforceFullscreen && isProctoringActive && !fullscreenActive) {
            handleViolation('fullscreen_exit', 'Full screen mode is required. Please enter full screen mode immediately.');
        }
        
        return fullscreenActive;
    }, [config.enforceFullscreen, isProctoringActive]);

    // Handle violations with cooldown period
    const handleViolation = useCallback((type: Violation['type'], message: string) => {
        const now = Date.now();
        const lastViolation = lastViolationRef.current.get(type);
        const cooldownPeriod = 3000; // 3 seconds cooldown for same violation type
        
        if (lastViolation && now - lastViolation < cooldownPeriod) {
            return; // Skip if same violation occurred recently
        }
        
        lastViolationRef.current.set(type, now);
        violationCountRef.current += 1;
        
        const newViolation: Violation = {
            type,
            timestamp: now,
            message
        };
        
        setViolations(prev => [...prev, newViolation]);
        
        // Show warning
        showAlert('Proctoring Alert', `${message} (Warning ${violationCountRef.current}/${config.maxViolations})`);
        
        // Check if max violations reached
        if (violationCountRef.current >= config.maxViolations) {
            handleMaxViolationsReached();
        }
    }, [config.maxViolations, showAlert]);

    // Handle max violations reached
    const handleMaxViolationsReached = useCallback(() => {
        setIsProctoringActive(false);
        showAlert('Test Terminated', `Maximum violations (${config.maxViolations}) reached. Your test has been terminated due to multiple proctoring violations.`);
        
        // Optionally redirect or end the test
        window.location.href = '/interview';
    }, [config.maxViolations, showAlert]);

    // Tab switching detection
    useEffect(() => {
        if (!isProctoringActive || config.allowTabSwitch) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                handleViolation('tab_switch', 'Tab switching detected. Please remain on the test window.');
            }
        };

        const handleBlur = () => {
            handleViolation('focus_loss', 'Window focus lost. Please keep the test window active.');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [isProctoringActive, config.allowTabSwitch, handleViolation]);

    // Copy/Paste detection
    useEffect(() => {
        if (!isProctoringActive || config.allowCopyPaste) return;

        const handleCopy = (e: ClipboardEvent) => {
            e.preventDefault();
            handleViolation('copy_attempt', 'Copy functionality is disabled during the test.');
        };

        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault();
            handleViolation('paste_attempt', 'Paste functionality is disabled during the test.');
        };

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            handleViolation('copy_attempt', 'Right-click context menu is disabled during the test.');
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent common copy/paste shortcuts
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
                e.preventDefault();
                if (e.key === 'c' || e.key === 'x') {
                    handleViolation('copy_attempt', 'Copy shortcuts are disabled during the test.');
                } else {
                    handleViolation('paste_attempt', 'Paste shortcuts are disabled during the test.');
                }
            }
        };

        document.addEventListener('copy', handleCopy);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isProctoringActive, config.allowCopyPaste, handleViolation]);

    // Fullscreen monitoring
    useEffect(() => {
        if (!isProctoringActive || !config.enforceFullscreen) return;

        const handleFullscreenChange = () => {
            checkFullscreen();
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
    }, [isProctoringActive, config.enforceFullscreen, checkFullscreen]);

    // Request fullscreen
    const requestFullscreen = useCallback(async () => {
        try {
            if (!checkFullscreen()) {
                await document.documentElement.requestFullscreen();
                return true;
            }
            return true;
        } catch (error) {
            console.error('Fullscreen request failed:', error);
            showAlert('Fullscreen Required', 'Please enable fullscreen mode to begin the test.');
            return false;
        }
    }, [checkFullscreen, showAlert]);

    // Start proctoring
    const startProctoring = useCallback(async () => {
        if (config.enforceFullscreen) {
            const success = await requestFullscreen();
            if (!success) return false;
        }
        
        setIsProctoringActive(true);
        violationCountRef.current = 0;
        setViolations([]);
        lastViolationRef.current.clear();
        
        return true;
    }, [config.enforceFullscreen, requestFullscreen]);

    // Stop proctoring
    const stopProctoring = useCallback(() => {
        setIsProctoringActive(false);
        setViolations([]);
        violationCountRef.current = 0;
        lastViolationRef.current.clear();
    }, []);

    // Get violation summary
    const getViolationSummary = useCallback(() => {
        const summary = violations.reduce((acc, violation) => {
            acc[violation.type] = (acc[violation.type] || 0) + 1;
            return acc;
        }, {} as Record<Violation['type'], number>);
        
        return {
            total: violations.length,
            byType: summary,
            remaining: config.maxViolations - violations.length
        };
    }, [violations, config.maxViolations]);

    return {
        isProctoringActive,
        isFullscreen,
        violations,
        violationCount: violations.length,
        startProctoring,
        stopProctoring,
        requestFullscreen,
        getViolationSummary
    };
}
