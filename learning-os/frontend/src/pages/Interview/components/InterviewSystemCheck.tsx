import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Mic, Monitor, Shield, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CameraProctor } from '../../../components/CameraProctor';
import { Button } from '../../../components/ui/Button';
import { api } from '../../../services/api';
import type { InterviewSession } from '../../../services/api';
import { useDialog } from '../../../hooks/useDialog';

export function InterviewSystemCheck() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useDialog();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [fullscreenPossible, setFullscreenPossible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      if (!id) return;
      try {
        const data = await api.getInterviewSession(id);
        setSession(data);
        setIsLoading(false);
      } catch (err) {
        showAlert('Error', 'Failed to load session for check-in');
        navigate('/interview');
      }
    };
    loadSession();
  }, [id, navigate, showAlert]);

  const handleStart = () => {
    if (!id) return;
    navigate(`/interview/${id}/room`);
  };

  if (isLoading || !session) {
    return (
      <div className="min-h-screen bg-console-bg flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-accent-primary/20 border-t-accent-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isReady = cameraReady && (session.config.strictMode ? fullscreenPossible : true);

  return (
    <div className="min-h-screen bg-console-bg p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full space-y-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-3 text-accent-primary font-black uppercase tracking-[0.4em] text-[10px]">
            <Shield size={16} /> Technical Integrity Protocol
          </div>
          <h1 className="text-5xl font-black text-text-primary tracking-tighter">
            System <span className="text-accent-primary">Readiness</span>
          </h1>
          <p className="text-text-muted font-medium max-w-xl mx-auto">
            Please verify your sensory hardware and environment before the simulation begins. 
            Integrity monitoring will activate upon entry.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Component Checks */}
          <div className="space-y-4">
            <div className="interview-card p-6 bg-console-surface/40 border-white/5 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                <Shield size={14} className="text-accent-primary" /> Vital Indicators
              </h3>
              
              <div className="space-y-3">
                <CheckItem 
                  icon={<Camera size={18} />}
                  label="Camera Feed"
                  status={cameraReady ? 'ok' : 'pending'}
                  description="Required for identity verification"
                />
                <CheckItem 
                  icon={<Mic size={18} />}
                  label="Audio Stream"
                  status={micReady ? 'ok' : 'pending'}
                  description="Monitored for background pattern detection"
                />
                {session.config.strictMode && (
                  <CheckItem 
                    icon={<Monitor size={18} />}
                    label="Fullscreen Proxy"
                    status={fullscreenPossible ? 'ok' : 'pending'}
                    description="Environment lockdown capability"
                  />
                )}
              </div>

              {!isReady && (
                <div className="p-4 bg-status-warning/10 border border-status-warning/20 rounded-2xl flex gap-3">
                  <AlertCircle className="text-status-warning shrink-0" size={18} />
                  <p className="text-[11px] text-text-secondary font-medium leading-relaxed">
                    Awaiting permissions. Please grant camera and microphone access when prompted by your browser.
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={handleStart}
              disabled={!isReady}
              className="w-full h-16 bg-accent-primary text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl shadow-accent-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30"
            >
              Finalize Entry <Play size={18} fill="currentColor" className="ml-2" />
            </Button>
          </div>

          {/* Right: Preview Feed */}
          <div className="relative aspect-video rounded-[2.5rem] bg-console-surface/40 border border-white/10 overflow-hidden shadow-2xl">
            <CameraProctor 
              isEnabled={true}
              variant="inline"
              onReady={() => {
                setCameraReady(true);
                setMicReady(true);
                setFullscreenPossible(true);
              }}
              onViolation={() => {}} // No violations in preview
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-console-bg/50 backdrop-blur-sm">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Camera size={24} className="text-text-muted opacity-30" />
                </div>
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Awaiting Feed...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckItem({ icon, label, status, description }: { icon: any, label: string, status: 'ok' | 'pending' | 'error', description: string }) {
  return (
    <div className="p-4 bg-console-bg/50 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-accent-primary/20 transition-all">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
          status === 'ok' ? 'bg-status-ok/10 text-status-ok' : 'bg-white/5 text-text-muted opacity-50'
        )}>
          {icon}
        </div>
        <div>
          <div className="text-[11px] font-black text-text-primary uppercase tracking-wider">{label}</div>
          <div className="text-[9px] text-text-muted font-medium italic">{description}</div>
        </div>
      </div>
      {status === 'ok' ? (
        <CheckCircle2 className="text-status-ok w-5 h-5" />
      ) : (
        <div className="w-4 h-4 border-2 border-white/10 border-t-accent-primary rounded-full animate-spin" />
      )}
    </div>
  );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
