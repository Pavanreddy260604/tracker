import { memo } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSecureProctoring } from '../../../hooks/useSecureProctoring';
import { FullscreenLockdown } from '../../../components/FullscreenLockdown';
import { CameraProctor } from '../../../components/CameraProctor';
import { useDialog } from '../../../hooks/useDialog';

interface ProctoringOverlayProps {
  sessionId: string;
  secret: string;
  timeLeft: number;
  isStrictMode: boolean;
  onViolation: (violation: any) => void;
  onTerminate: () => void;
}

export const ProctoringOverlay = memo(({
  sessionId,
  secret,
  timeLeft,
  isStrictMode,
  onViolation,
  onTerminate
}: ProctoringOverlayProps) => {
  const { showAlert } = useDialog();
  const MAX_VIOLATIONS = 2;

  const {
    violations,
    violationCount,
    isLocked,
    enterFullscreen,
    recordViolation,
    endGracePeriod
  } = useSecureProctoring({
    sessionId,
    secret,
    onViolation,
    onTerminate,
    maxViolations: MAX_VIOLATIONS,
    enableKeystrokeTracking: true,
    enableMouseTracking: true,
    enableIntegrityChecks: true
  });

  // Wrap enterFullscreen to end grace period after successful fullscreen entry
  const handleEnterFullscreen = async (): Promise<boolean> => {
    const success = await enterFullscreen();
    if (success) {
      endGracePeriod(); // NOW start counting violations
    }
    return success;
  };

  if (!isStrictMode) return null;

  return (
    <>
      <CameraProctor 
        isEnabled={true}
        onViolation={(type, message) => {
          recordViolation(type, message);
        }}
      />
      
      <FullscreenLockdown
        isActive={true}
        testName="Technical Assessment Protocol"
        timeLeft={timeLeft}
        violations={violations.map(v => ({ type: v.violationType, timestamp: Date.now(), message: v.message, penalized: v.penalized }))}
        violationCount={violationCount}
        maxViolations={MAX_VIOLATIONS}
        onEnterFullscreen={handleEnterFullscreen}
        onViolation={(message) => showAlert('Proctoring Violation', message)}
      >
        <></>
      </FullscreenLockdown>

      {/* Warning Overlay when close to termination */}
      {violationCount === MAX_VIOLATIONS - 1 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[10002] px-6 py-3 bg-status-error/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl flex items-center gap-4 text-white pointer-events-none"
        >
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center animate-pulse">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Critical Warning</div>
            <div className="text-xs font-black">Next violation will trigger immediate termination.</div>
          </div>
        </motion.div>
      )}
    </>
  );
});
