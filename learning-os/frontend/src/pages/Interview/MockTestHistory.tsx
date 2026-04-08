import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  History, 
  Trash2, 
  ExternalLink, 
  Calendar, 
  Clock, 
  Award, 
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Shield,
  Search,
  AlertCircle
} from 'lucide-react';
import { interviewApi } from '../../services/interview.api';
import type { InterviewSession } from '../../services/types';
import { useDialog } from '../../hooks/useDialog';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';

interface GroupedSessions {
  [key: string]: InterviewSession[];
}

export function MockTestHistory() {
  const navigate = useNavigate();
  const { dialog, showAlert, closeDialog } = useDialog();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['today']));
  const [filterStatus, setFilterStatus] = useState<'all' | 'start' | 'submitted'>('all');
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    type: 'single' | 'all';
    sessionId?: string;
    sessionName?: string;
  }>({ isOpen: false, type: 'single' });

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await interviewApi.getInterviewHistory();
      if (data && Array.isArray(data)) {
        setSessions(data);
      }
    } catch (error) {
      showAlert('Error', 'Failed to load test history');
    } finally {
      setIsLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const groupSessionsByDate = (sessions: InterviewSession[]): GroupedSessions => {
    const groups: GroupedSessions = {
      today: [],
      yesterday: [],
      thisWeek: [],
      lastWeek: [],
      thisMonth: [],
      older: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setDate(1);

    sessions.forEach(session => {
      const sessionDate = new Date(session.startedAt);
      
      if (sessionDate >= today) {
        groups.today.push(session);
      } else if (sessionDate >= yesterday) {
        groups.yesterday.push(session);
      } else if (sessionDate >= lastWeek) {
        groups.thisWeek.push(session);
      } else if (sessionDate >= thisMonth) {
        groups.lastWeek.push(session);
      } else if (sessionDate.getMonth() === now.getMonth() && sessionDate.getFullYear() === now.getFullYear()) {
        groups.thisMonth.push(session);
      } else {
        groups.older.push(session);
      }
    });

    return groups;
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const handleDeleteSession = (session: InterviewSession) => {
    setDeleteDialog({
      isOpen: true,
      type: 'single',
      sessionId: session._id,
      sessionName: `${session.config.difficulty} Test - ${new Date(session.startedAt).toLocaleDateString()}`
    });
  };

  const handleClearAllHistory = () => {
    setDeleteDialog({
      isOpen: true,
      type: 'all'
    });
  };

  const confirmDelete = async () => {
    try {
      if (deleteDialog.type === 'single' && deleteDialog.sessionId) {
        await interviewApi.deleteInterviewSession(deleteDialog.sessionId);
        setSessions(prev => prev.filter(s => s._id !== deleteDialog.sessionId));
        showAlert('Success', 'Test session deleted successfully');
      } else {
        const result = await interviewApi.clearInterviewHistory();
        setSessions([]);
        const deletedCount = typeof result?.deletedCount === 'number' ? result.deletedCount : 0;
        showAlert('Success', `Cleared ${deletedCount} test session(s)`);
      }
    } catch (error) {
      showAlert('Error', 'Failed to delete test session(s)');
    } finally {
      setDeleteDialog({ isOpen: false, type: 'single' });
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'start': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted': return <Award className="w-4 h-4" />;
      case 'start': return <Clock className="w-4 h-4" />;
      default: return null;
    }
  };

  const filteredSessions = sessions.filter(session => {
    if (filterStatus === 'all') return true;
    return session.status === filterStatus;
  });

  const groupedSessions = groupSessionsByDate(filteredSessions);

  const groupLabels: { [key: string]: string } = {
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    lastWeek: 'Last Week',
    thisMonth: 'This Month',
    older: 'Older'
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-console-bg flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-accent-primary/20 border-t-accent-primary rounded-full animate-spin" />
        </div>
        <div className="text-text-muted font-black uppercase tracking-[0.3em] text-xs animate-pulse">Retrieving Simulation Data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-console-bg">
      {/* Header */}
      <div className="bg-console-surface/40 backdrop-blur-3xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-accent-primary/10 rounded-2xl flex items-center justify-center border border-accent-primary/20">
                <History className="w-7 h-7 text-accent-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-text-primary tracking-tighter uppercase">Simulation <span className="text-accent-primary">Logs</span></h1>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-1">Global History & System Telemetry</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                onClick={() => navigate('/interview')}
                className="h-11 px-6 bg-white/5 border-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl"
              >
                <X className="w-4 h-4 mr-2" />
                Exit Archive
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-6 p-6 rounded-3xl bg-console-surface/20 border border-white/5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                <Filter className="w-3.5 h-3.5 text-accent-primary" />
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Spectral Filter</span>
            </div>
            <div className="h-8 w-px bg-white/5 mx-2" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-transparent border-none text-text-primary text-xs font-black uppercase tracking-widest focus:ring-0 cursor-pointer hover:text-accent-primary transition-colors pr-8"
            >
              <option value="all" className="bg-console-surface">All Protocols</option>
              <option value="start" className="bg-console-surface">Active Units</option>
              <option value="submitted" className="bg-console-surface">Finalized Units</option>
            </select>
          </div>
          
          {sessions.length > 0 && (
            <Button
              variant="danger"
              onClick={handleClearAllHistory}
              className="h-11 px-6 bg-status-error/10 border-status-error/20 text-status-error hover:bg-status-error/20 text-[10px] font-black uppercase tracking-widest rounded-xl"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Purge Archives
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 pb-20">
        {sessions.length === 0 ? (
          <div className="py-32 rounded-[4rem] bg-console-surface/10 border-4 border-dashed border-white/5 text-center space-y-8">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-white/[0.02] flex items-center justify-center">
                <History className="w-12 h-12 text-text-muted opacity-20" />
            </div>
            <div className="space-y-3">
                <h3 className="text-3xl font-black text-text-primary tracking-tighter uppercase">No Telemetry Found</h3>
                <p className="text-text-muted font-medium max-w-sm mx-auto leading-relaxed">System archives are empty. Initialize your first simulation sequence to generate performance logs.</p>
            </div>
            <Button
              onClick={() => navigate('/interview/setup')}
              className="h-14 px-10 bg-accent-primary text-white shadow-2xl shadow-accent-primary/30 text-xs font-black uppercase tracking-widest rounded-2xl"
            >
              Launch Protocol Alpha
            </Button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-24 rounded-[3rem] bg-console-surface/10 border border-white/5 text-center space-y-6">
            <Filter className="w-16 h-16 text-text-muted opacity-20 mx-auto" />
            <div className="space-y-2">
                <h3 className="text-xl font-black text-text-primary uppercase tracking-widest">Null Reference</h3>
                <p className="text-text-muted text-sm font-medium">No logs match the current spectral filter configuration.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedSessions).map(([key, groupSessions]) => {
              if (groupSessions.length === 0) return null;
              
              const isExpanded = expandedGroups.has(key);
              
              return (
                <div key={key} className="space-y-4">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center justify-between px-8 py-5 bg-console-surface/30 hover:bg-console-surface/50 border border-white/5 rounded-3xl transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-accent-primary shadow-[0_0_10px_rgba(var(--accent-primary-rgb),0.5)]" />
                      <span className="text-xs font-black text-text-primary uppercase tracking-[0.3em]">{groupLabels[key]}</span>
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-widest px-3 py-1 bg-white/5 rounded-lg border border-white/5">{groupSessions.length} Units</span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-accent-primary group-hover:text-white transition-all">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>
                  
                  {/* Group Content */}
                  {isExpanded && (
                    <div className="grid gap-4 pl-4 border-l-2 border-white/5 ml-4">
                      {groupSessions.map((session) => (
                        <div
                          key={session._id}
                          className="px-8 py-6 rounded-3xl bg-console-surface/40 border border-white/5 hover:border-accent-primary/20 hover:bg-console-surface/60 transition-all group/card overflow-hidden relative"
                        >
                          <div className="absolute top-0 right-0 p-6 opacity-0 group-hover/card:opacity-10 transition-opacity">
                             <Shield size={64} className="text-accent-primary" />
                          </div>
                          
                          <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-8">
                              {/* Status Badge */}
                              <Badge 
                                className={cn(
                                    "h-10 px-5 font-black uppercase tracking-widest text-[9px] rounded-xl border",
                                    session.status === 'submitted' ? 'bg-status-ok/10 text-status-ok border-status-ok/20' : 'bg-accent-primary/10 text-accent-primary border-accent-primary/20'
                                )}
                              >
                                {session.status === 'submitted' ? <Award className="w-3.5 h-3.5 mr-2" /> : <Clock className="w-3.5 h-3.5 mr-2" />}
                                {session.status}
                              </Badge>
                              
                              {/* Test Info */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <h4 className="text-sm font-black text-text-primary uppercase tracking-widest">
                                    {session.config.difficulty} Assessment Unit
                                    </h4>
                                    {session.totalScore !== undefined && (
                                    <Badge variant="secondary" className="bg-accent-primary/10 text-accent-primary border-accent-primary/20 font-black text-[9px]">
                                        EFX {session.totalScore}%
                                    </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-6 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                  <span className="flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-accent-primary/40" />
                                    {new Date(session.startedAt).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-accent-primary/40" />
                                    {formatDuration(session.config.duration)}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5 text-accent-primary/40" />
                                    {session.config.sectionCount} Nodes
                                  </span>
                                  {session.proctoring && session.proctoring.tabSwitchCount > 0 && (
                                    <span className="flex items-center gap-2 text-status-error/60">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      {session.proctoring.tabSwitchCount} INTEGRITY ALERTS
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => navigate(`/interview/${session._id}/results`)}
                                className="w-11 h-11 bg-white/5 hover:bg-accent-primary hover:text-white rounded-xl flex items-center justify-center border border-white/5 transition-all text-text-muted"
                                title="Synthesize Results"
                              >
                                <ExternalLink size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteSession(session)}
                                className="w-11 h-11 bg-white/5 hover:bg-status-error hover:text-white rounded-xl flex items-center justify-center border border-white/5 transition-all text-text-muted"
                                title="Purge Session"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, type: 'single' })}
        onConfirm={confirmDelete}
        title={deleteDialog.type === 'single' ? 'Permanently Delete Test Session' : 'Permanently Delete Interview History'}
        description={
          deleteDialog.type === 'single'
            ? `Are you sure you want to permanently delete "${deleteDialog.sessionName}"? This action cannot be undone and all associated interview records will be erased.`
            : 'This will permanently remove ALL interview history from your account and cannot be undone.'
        }
        confirmLabel={deleteDialog.type === 'single' ? 'Delete Permanently' : 'Delete All Permanently'}
        cancelLabel="Cancel"
        variant="danger"
        verificationText={deleteDialog.type === 'all' ? 'DELETE ALL' : undefined}
        verificationLabel={deleteDialog.type === 'all' ? 'For safety, type the phrase below to confirm permanent deletion.' : undefined}
        verificationPlaceholder={deleteDialog.type === 'all' ? 'Type DELETE ALL' : undefined}
      />

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={dialog.isOpen}
        onClose={closeDialog}
        title={dialog.title}
        description={dialog.description}
        buttonLabel="OK"
      />
    </div>
  );
}
