import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Camera, CameraOff, Mic, MicOff, AlertCircle, Maximize2, Minimize2, GripHorizontal, ShieldCheck, ShieldAlert, Video, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface CameraProctorProps {
  onViolation: (type: 'camera_lost' | 'audio_threshold_reached', message: string) => void;
  isEnabled: boolean;
  onReady?: () => void;
  variant?: 'floating' | 'inline';
}

export const CameraProctor = memo(({ onViolation, isEnabled, onReady, variant = 'floating' }: CameraProctorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const hasInitializedRef = useRef(false);
  
  const [status, setStatus] = useState<'idle' | 'requesting' | 'active' | 'error' | 'denied'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const VOICE_THRESHOLD = 0.4;
  const CHECK_INTERVAL = 3000;

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    hasInitializedRef.current = false;
  }, []);

  const monitorAudio = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudio = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength / 255;
        setAudioLevel(average);

        if (average > VOICE_THRESHOLD && variant === 'floating') {
          onViolation('audio_threshold_reached', 'Suspicious background audio or voice detected');
        }

        requestAnimationFrame(checkAudio);
      };

      checkAudio();
    } catch (err) {
      console.error('[CameraProctor] Audio monitoring failed:', err);
    }
  }, [onViolation, variant]);

  const startStream = useCallback(async () => {
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      monitorAudio(stream);
      setStatus('active');
      setError(null);
      onReady?.();

      const interval = setInterval(() => {
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState === 'ended' || !videoTrack.enabled) {
          if (variant === 'floating') onViolation('camera_lost', 'Camera feed lost or disabled');
          setStatus('error');
          setError('Camera connection lost');
          clearInterval(interval);
        }
      }, CHECK_INTERVAL);

      return () => clearInterval(interval);
    } catch (err: any) {
      console.error('[CameraProctor] Media access failed:', err);
      if (err.name === 'NotAllowedError') {
        setStatus('denied');
        setError('Camera and microphone access was denied');
      } else {
        setStatus('error');
        setError(err.message || 'Failed to access camera/microphone');
      }
    }
  }, [monitorAudio, onViolation, onReady, variant]);

  useEffect(() => {
    if (isEnabled && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      startStream();
    } else if (!isEnabled) {
      stopTracks();
    }
    return () => stopTracks();
  }, [isEnabled, startStream, stopTracks]);

  if (!isEnabled) return null;

  const containerClasses = cn(
    variant === 'floating' 
      ? "fixed z-[10001] bottom-6 right-6 bg-console-surface/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden touch-none transition-all duration-300"
      : "w-full h-full bg-console-bg relative group",
    variant === 'floating' && isMinimized ? 'w-52 h-14' : 
    variant === 'floating' ? 'w-64' : ''
  );

  if (status === 'idle' || status === 'requesting' || status === 'denied') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={containerClasses}>
        <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center space-y-4">
           <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse", status === 'denied' ? 'bg-status-error/10 text-status-error' : 'bg-accent-primary/10 text-accent-primary')}>
              {status === 'denied' ? <ShieldAlert size={24} /> : <Video size={24} />}
           </div>
           <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#fff]/40 mb-1">Hardware Interface</div>
              <div className="text-xs font-bold text-text-primary uppercase tracking-widest leading-tight">
                {status === 'denied' ? 'Access Denied' : 'Awaiting Simulation Link...'}
              </div>
           </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      drag={variant === 'floating'}
      dragMomentum={false}
      initial={{ opacity: 0, scale: 1 }}
      animate={{ opacity: 1, scale: 1 }}
      className={containerClasses}
    >
      {variant === 'floating' && (
        <div className="h-10 bg-console-bg/50 flex items-center justify-between px-4 cursor-move border-b border-white/5">
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-3.5 h-3.5 text-text-muted/40" />
            <span className="text-[9px] uppercase tracking-[0.2em] font-black text-text-muted">Proctoring</span>
          </div>
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            {isMinimized ? <Maximize2 className="w-3 h-3 text-text-muted" /> : <Minimize2 className="w-3 h-3 text-text-muted" />}
          </button>
        </div>
      )}

      {(!isMinimized || variant === 'inline') && (
        <div className="relative aspect-video bg-black overflow-hidden h-full">
           <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
           
           {/* Visual Effects for Premium look */}
           <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
           
           {/* Scanline Effect */}
           <div className="absolute inset-0 bg-scanlines opacity-[0.03] pointer-events-none" />

           {/* Indicators */}
           <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                 <motion.div 
                    className={cn("h-full", audioLevel > VOICE_THRESHOLD ? 'bg-status-error' : 'bg-accent-primary')}
                    animate={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
                 />
              </div>
              <div className={cn("p-1.5 rounded-lg backdrop-blur-xl border border-white/10", audioLevel > VOICE_THRESHOLD ? 'bg-status-error/20 text-status-error' : 'bg-white/5 text-white/40')}>
                 <Mic size={10} />
              </div>
           </div>

           <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse" />
              <span className="text-[8px] font-black text-status-ok uppercase tracking-widest">Active Link</span>
           </div>
        </div>
      )}

      {isMinimized && variant === 'floating' && (
        <div className="h-14 flex items-center justify-between px-4">
           <div className="flex items-center gap-2">
              <Video className="w-3.5 h-3.5 text-status-ok" />
              <span className="text-[10px] text-text-secondary font-black uppercase tracking-widest">Secured</span>
           </div>
           <div className="flex items-center gap-3">
              <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                 <motion.div className="h-full bg-accent-primary" animate={{ width: `${Math.min(audioLevel * 100, 100)}%` }} />
              </div>
              <Mic size={12} className="text-white/20" />
           </div>
        </div>
      )}
    </motion.div>
  );
});
