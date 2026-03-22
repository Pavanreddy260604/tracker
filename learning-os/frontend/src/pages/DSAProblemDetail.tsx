import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle, LayoutGrid, BrainCircuit, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { api, type DSAProblem } from '../services/api';
import { useAIContextTracker } from '../contexts/AIContext';
import { DSAProblemForm } from '../components/forms/DSAProblemForm';
import { toast } from '../stores/toastStore';
import { useRoutedEntity } from '../hooks/useRoutedEntity';

export function DSAProblemDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const fetchProblem = useCallback(async (entityId: string) => {
        const response = await api.getDSAProblem(entityId);
        return response.problem;
    }, []);

    const { entity: problem, isLoading, error, isTransitioning } = useRoutedEntity<DSAProblem>(
        id,
        fetchProblem,
        'Algorithm not found in the learning grid'
    );

    // Sync context with AI Assistant using the new robust hook
    useAIContextTracker('DSA Problem', problem);

    if (isLoading || isTransitioning) {
        return (
            <div className="max-w-5xl mx-auto space-y-12 animate-pulse py-4">
                <div className="flex items-center gap-8 border-b border-border-subtle pb-10">
                    <div className="h-20 w-20 rounded-3xl bg-console-surface-2 border border-border-subtle shadow-inner" />
                    <div className="space-y-4 flex-1">
                        <div className="h-4 w-32 bg-console-surface-3 rounded-full opacity-40" />
                        <div className="h-10 w-2/3 bg-console-surface-2 rounded-2xl" />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-2 space-y-8">
                       <div className="h-[600px] w-full bg-console-surface/50 rounded-[2.5rem] border border-border-subtle" />
                   </div>
                   <div className="space-y-8">
                       <div className="h-[200px] w-full bg-console-surface/50 rounded-3xl border border-border-subtle" />
                       <div className="h-[300px] w-full bg-console-surface/50 rounded-3xl border border-border-subtle" />
                   </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 p-12 text-center animate-in zoom-in duration-500">
                <div className="p-8 bg-status-error/10 rounded-[2rem] border border-status-error/20 shadow-2xl shadow-status-error/5">
                    <AlertCircle size={64} className="text-status-error" />
                </div>
                <div className="space-y-3">
                    <h2 className="text-4xl font-black text-text-primary tracking-tight italic">Context Lost</h2>
                    <p className="text-text-secondary max-w-md mx-auto font-medium text-lg leading-relaxed">
                        This algorithmic specification could not be retrieved. The data stream may have been interrupted.
                    </p>
                </div>
                <Button 
                    variant="primary" 
                    size="lg"
                    onClick={() => navigate('/dsa')} 
                    leftIcon={<ArrowLeft size={20} />}
                    className="mt-4 px-10 py-7 rounded-2xl shadow-xl shadow-accent-primary/20"
                >
                    Return to Grid
                </Button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-6xl mx-auto space-y-8 pb-32"
        >
            {/* Immersive Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-border-subtle pb-12 pt-4 relative">
                <div className="flex items-start gap-6">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-br from-accent-primary to-purple-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                        <div className="relative p-5 bg-console-surface rounded-3xl border border-border-strong shadow-strong transition-transform duration-500 group-hover:scale-105">
                            <BrainCircuit size={32} className="text-accent-primary" />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-text-muted">
                                {id === 'new' ? 'New Specification' : `Problem #${id?.slice(-4).toUpperCase()}`}
                            </span>
                            <Badge variant="info" className="bg-accent-soft text-accent-primary border-accent-primary/20 px-3 py-1 text-[10px] font-bold">
                                {problem?.topic || 'Algorithmic'}
                            </Badge>
                            {problem?.difficulty && (
                                <Badge className={`uppercase text-[9px] font-black tracking-widest
                                    ${problem.difficulty === 'easy' ? 'bg-status-ok/10 text-status-ok border-status-ok/20' : 
                                      problem.difficulty === 'medium' ? 'bg-status-warning/10 text-status-warning border-status-warning/20' : 
                                      'bg-status-error/10 text-status-error border-status-error/20'}`}>
                                    {problem.difficulty}
                                </Badge>
                            )}
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight leading-tight">
                            {problem?.problemName || 'New DSA Challenge'}
                        </h1>
                        <div className="flex items-center gap-2 text-text-secondary text-sm font-medium">
                            <Sparkles size={14} className="text-accent-primary animate-pulse" />
                            <span>Assistant context active and synced.</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/dsa')}
                        leftIcon={<ArrowLeft size={18} />}
                        className="text-text-muted hover:text-text-primary font-bold tracking-tight hover:bg-console-surface/20 px-6 py-6 rounded-2xl border border-transparent hover:border-border-subtle"
                    >
                        Return to List
                    </Button>
                </div>
            </header>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-12 relative">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    className="relative"
                >
                    <div className="absolute -inset-4 bg-gradient-to-b from-accent-primary/5 to-transparent rounded-[3rem] blur-3xl opacity-30 pointer-events-none" />
                    
                    {/* The Form is the "Engine" of the page */}
                    <div className="relative bg-console-surface/60 backdrop-blur-2xl border border-border-subtle rounded-[2.5rem] p-8 md:p-12 shadow-elevation-2 overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <LayoutGrid size={120} />
                        </div>
                        
                        <DSAProblemForm
                            initialValues={problem || undefined}
                            onSuccess={(newProblem) => {
                                if (id === 'new' && newProblem?._id) {
                                    toast.success('Core data persistent. Learning grid updated.');
                                    navigate(`/dsa/${newProblem._id}`);
                                } else {
                                    toast.success('Specifications refined successfully.');
                                }
                            }}
                            onCancel={() => navigate('/dsa')}
                        />
                    </div>
                </motion.div>
            </div>
            
            <footer className="pt-12 text-center opacity-30 select-none">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-text-muted">
                    Learning OS // Project CRYSTAL // 2026
                </p>
            </footer>
        </motion.div>
    );
}
