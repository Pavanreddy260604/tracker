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
  X
} from 'lucide-react';
import { interviewApi } from '../../services/interview.api';
import type { InterviewSession } from '../../services/types';
import { useDialog } from '../../hooks/useDialog';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button } from '../../components/ui/Button';

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          Loading test history...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <History className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Mock Test History</h1>
                <p className="text-slate-400">View and manage your past test sessions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => navigate('/interview')}
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Filter:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Sessions</option>
              <option value="start">Start</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>
          
          {sessions.length > 0 && (
            <Button
              variant="danger"
              onClick={handleClearAllHistory}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Permanently Delete History
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <History className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Test History</h3>
            <p className="text-slate-400 mb-6">You haven't taken any mock tests yet.</p>
            <Button
              variant="primary"
              onClick={() => navigate('/interview/setup')}
            >
              Start Your First Test
            </Button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-16">
            <Filter className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Results</h3>
            <p className="text-slate-400">No sessions match the selected filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSessions).map(([key, groupSessions]) => {
              if (groupSessions.length === 0) return null;
              
              const isExpanded = expandedGroups.has(key);
              
              return (
                <div key={key} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center justify-between px-6 py-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-white">{groupLabels[key]}</span>
                      <span className="text-sm text-slate-400">({groupSessions.length} sessions)</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  
                  {/* Group Content */}
                  {isExpanded && (
                    <div className="divide-y divide-slate-800">
                      {groupSessions.map((session) => (
                        <div
                          key={session._id}
                          className="px-6 py-4 hover:bg-slate-800/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {/* Status Badge */}
                              <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(session.status)}`}>
                                {getStatusIcon(session.status)}
                                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                              </div>
                              
                              {/* Test Info */}
                              <div>
                                <h4 className="font-medium text-white">
                                  {session.config.difficulty.charAt(0).toUpperCase() + session.config.difficulty.slice(1)} Test
                                  {session.totalScore !== undefined && (
                                    <span className="ml-2 text-sm text-slate-400">
                                      (Score: {session.totalScore}/100)
                                    </span>
                                  )}
                                </h4>
                                <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {new Date(session.startedAt).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {formatDuration(session.config.duration)}
                                  </span>
                                  <span>{session.config.sectionCount} sections</span>
                                  {session.proctoring && session.proctoring.tabSwitchCount > 0 && (
                                    <span className="text-yellow-400">
                                      {session.proctoring.tabSwitchCount} tab switches
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => navigate(`/interview/${session._id}/results`)}
                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                title="View Results"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSession(session)}
                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Delete Session"
                              >
                                <Trash2 className="w-4 h-4" />
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
