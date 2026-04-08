import { useState, useEffect } from 'react';
import { Sparkles, Brain, ChevronRight, Settings, Loader2 } from 'lucide-react';
import { useScriptWriter } from '../../../contexts/ScriptWriterContext';
import { useScriptWriterGenerator } from '../useScriptWriterGenerator';
import { useScriptWriterTreatments } from '../useScriptWriterTreatments';
import { AssistantPanel } from './AssistantPanel';
import { DiffReviewModal } from './DiffReviewModal';
import type { Bible, CritiqueResult, IScene as Scene } from '../../../services/project.api';
import { scriptWriterApi } from '../../../services/scriptWriter.api';
import type { Character } from '../../../services/character.api';
import type { EditorSelection, GenerationOptions, PendingFixState, SceneForm } from '../types';
import { shouldOfferTransliteration } from '../utils';

type ContextPanelTab = 'generator' | 'story' | 'settings';

interface ContextPanelProps {
    isGenerating?: boolean;
    isCritiquing?: boolean;
    critique?: CritiqueResult | null;
    onCritique?: () => void;
    onGenerate?: () => void;
    onFix?: () => void;
    sceneForm?: SceneForm;
    onSceneFormChange?: <K extends keyof SceneForm>(field: K, value: SceneForm[K]) => void;
    generationOptions?: GenerationOptions;
    onGenerationOptionChange?: <K extends keyof GenerationOptions>(field: K, value: GenerationOptions[K]) => void;
    handleUpdateProject?: (projectId: string, updates: Partial<Bible>) => void | Promise<unknown>;
    handleDeleteProject?: (projectId: string) => void | Promise<unknown>;
    activeProject?: Bible | null;
    onExport?: (format: 'fountain' | 'txt' | 'json' | 'pdf') => void;
    refreshScenes?: (projectId: string, autoSelect?: boolean) => Promise<void>;
    canRefreshCritique?: boolean;
    pointsToRefresh?: number;
    eliteHighScore?: number;
    pendingFix?: PendingFixState | null;
    activeScene?: Scene | null;
    editorSelection?: EditorSelection | null;
    setPendingFix?: (fix: PendingFixState | null) => void;
    setError: (message: string | null) => void;
    characters?: Character[];
    isCritiqueStale?: boolean;
}

export function ContextPanel({
    isGenerating,
    isCritiquing,
    critique,
    onCritique,
    onGenerate,
    onFix,
    sceneForm,
    onSceneFormChange,
    generationOptions,
    onGenerationOptionChange,
    handleUpdateProject,
    handleDeleteProject,
    activeProject: propActiveProject,
    onExport,
    refreshScenes,
    canRefreshCritique,
    pointsToRefresh,
    eliteHighScore,
    pendingFix,
    activeScene,
    editorSelection,
    setPendingFix,
    setError,
    characters = [],
    isCritiqueStale
}: ContextPanelProps) {
    const { uiState, setRightPanelTool, toggleRightPanel, activeProject: contextActiveProject, editorContent, setEditorContent } = useScriptWriter();
    const activeProject = propActiveProject || contextActiveProject;
    const { activeTool, rightPanelOpen } = uiState;

    const [projectTitleDrafts, setProjectTitleDrafts] = useState<Record<string, string>>({});
    const [aiProvider, setAiProvider] = useState<string>('ollama');
    const [isSwitchingProvider, setIsSwitchingProvider] = useState(false);
    const projectTitle = activeProject ? projectTitleDrafts[activeProject._id] ?? activeProject.title ?? '' : '';

    // Diff Review State
    const [reviewModal, setReviewModal] = useState<{
        isOpen: boolean;
        originalContent: string;
        newContent: string;
        messageId: string;
    }>({
        isOpen: false,
        originalContent: '',
        newContent: '',
        messageId: ''
    });

    useEffect(() => {
        scriptWriterApi.getAIProvider().then(setAiProvider).catch(console.error);
    }, []);

    const {
        assistantMessages,
        isAssistantThinking,
        handleAssistantSendMessage,
        handleApplyProposal,
        handleDiscardProposal,
        handleDeleteAssistantMessage,
        handleUpdateAssistantMessage,
        handleClearChat,
        handleConfirmEdit,
        assistantProgress,
        aiModel,
        setAiModel
    } = useScriptWriterGenerator({
        activeProject,
        activeProjectId: activeProject?._id || null,
        activeSceneId: activeScene?._id || null,
        activeSceneName: activeScene?.slugline || undefined,
        editorContext: editorContent,
        setEditorContent,
        setError
    });

    const {
        treatments,
        treatmentPreview,
        treatmentLogline,
        treatmentStyle,
        treatmentSceneCount,
        treatmentLoading,
        setTreatmentLogline,
        setTreatmentStyle,
        setTreatmentSceneCount,
        handleTreatmentGenerate,
        handleTreatmentSave,
        handleTreatmentConvert
    } = useScriptWriterTreatments({
        activeProject,
        activeProjectId: activeProject?._id || null,
        setError,
        refreshScenes,
        characters
    });

    const tabs: Array<{ id: ContextPanelTab; icon: typeof Sparkles; label: string }> = [
        { id: 'generator', icon: Sparkles, label: 'Assistant' },
        { id: 'story', icon: Brain, label: 'Analysis' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ];

    // Collapsed State (Rail)
    if (!rightPanelOpen) {
        return (
            <div className="flex flex-col h-full bg-console-surface/30 backdrop-blur-md items-center py-4 border-l border-border-subtle/30 w-12 z-20">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setRightPanelTool(tab.id)}
                        className={`
                            mb-3 rounded-xl p-2.5 transition-all duration-200
                            ${activeTool === tab.id 
                                ? 'text-accent-primary bg-accent-primary/10 shadow-[0_0_15px_rgba(var(--accent-primary-rgb),0.2)]' 
                                : 'text-text-tertiary hover:text-text-secondary hover:bg-console-surface-2/60'}
                        `}
                        title={tab.label}
                    >
                        <tab.icon size={20} strokeWidth={activeTool === tab.id ? 2.5 : 2} />
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-console-surface text-text-secondary">
            {/* Tab Header - Context Switcher */}
            <div className="h-12 border-b border-border-subtle/30 flex items-center bg-console-header/90 backdrop-blur-xl sticky top-0 z-30 overflow-hidden shadow-sm">
                <div className="flex-1 flex items-center overflow-x-auto no-scrollbar h-full px-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setRightPanelTool(tab.id)}
                            className={`
                                flex-none flex items-center justify-center h-full px-4 text-[10px] font-bold uppercase tracking-[0.12em] border-b-2 transition-all
                                ${activeTool === tab.id
                                    ? 'border-accent-primary text-text-primary bg-accent-primary/[0.04]'
                                    : 'border-transparent text-text-tertiary hover:text-text-secondary hover:bg-console-surface-2/40'}
                            `}
                            title={tab.label}
                        >
                            <tab.icon size={12} className={`mr-2 ${activeTool === tab.id ? 'text-accent-primary' : ''}`} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex-none px-2 flex items-center border-l border-border-subtle bg-console-surface h-full">
                    <button
                        onClick={toggleRightPanel}
                        className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-console-surface hover:text-text-secondary"
                        title="Collapse"
                    >
                        <ChevronRight size={13} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                {activeTool === 'generator' && (
                    <div className="h-full -m-3">
                        <AssistantPanel
                            activeProject={activeProject}
                            messages={assistantMessages}
                            isGenerating={isAssistantThinking}
                            progress={assistantProgress}
                            activeSceneName={activeScene?.slugline || undefined}
                            selection={editorSelection || null}
                            onSendMessage={(request) => handleAssistantSendMessage(request, (updatedContent, finished, activeRequest, proposalMessageId) => {
                                if (setPendingFix && activeRequest?.mode !== 'ask' && activeRequest?.scope === 'scene') {
                                    if (!updatedContent?.trim()) {
                                        setPendingFix(null);
                                        return;
                                    }
                                    setPendingFix({
                                        content: updatedContent,
                                        mode: 'proposal',
                                        isStreaming: !finished,
                                        proposalMessageId,
                                        commitProposal: proposalMessageId
                                            ? async () => {
                                                const res = await handleApplyProposal(proposalMessageId);
                                                if (res?.requiresReview) {
                                                    setReviewModal({
                                                        isOpen: true,
                                                        originalContent: res.originalContent || '',
                                                        newContent: res.newContent || '',
                                                        messageId: res.messageId || ''
                                                    });
                                                }
                                            }
                                            : undefined,
                                        discardProposal: proposalMessageId
                                            ? async () => {
                                                await handleDiscardProposal(proposalMessageId);
                                            }
                                            : undefined
                                    });
                                }
                            })}
                            onApplyProposal={async (id: string) => {
                                const res = await handleApplyProposal(id);
                                if (res?.requiresReview) {
                                    setReviewModal({
                                        isOpen: true,
                                        originalContent: res.originalContent || '',
                                        newContent: res.newContent || '',
                                        messageId: res.messageId || ''
                                    });
                                } else if (pendingFix?.proposalMessageId === id && setPendingFix) {
                                    setPendingFix(null);
                                }
                            }}
                            onDiscardProposal={(id: string) => {
                                handleDiscardProposal(id);
                                if (pendingFix?.proposalMessageId === id && setPendingFix) {
                                    setPendingFix(null);
                                }
                            }}
                            onDeleteMessage={(id: string) => handleDeleteAssistantMessage(id)}
                            onUpdateMessage={(id: string, content: string) => handleUpdateAssistantMessage(id, content)}
                            onClearChat={() => {
                                handleClearChat();
                                if (setPendingFix) setPendingFix(null);
                            }}
                            onSavePreferenceCandidate={async (candidate) => {
                                if (!activeProject?._id || !handleUpdateProject) {
                                    return;
                                }

                                const nextPreferences = {
                                    defaultMode: candidate.updates.defaultMode || activeProject.assistantPreferences?.defaultMode || 'ask',
                                    replyLanguage: candidate.updates.replyLanguage ?? activeProject.assistantPreferences?.replyLanguage,
                                    transliteration: candidate.updates.transliteration ?? activeProject.assistantPreferences?.transliteration ?? activeProject.transliteration,
                                    savedDirectives: Array.from(new Set([
                                        ...(activeProject.assistantPreferences?.savedDirectives || []),
                                        candidate.directive
                                    ]))
                                };

                                await handleUpdateProject(activeProject._id, {
                                    assistantPreferences: nextPreferences
                                });
                            }}
                        />
                    </div>
                )}

                {activeTool === 'story' && (
                    <div className="space-y-8 pb-10">
                        {/* Section 1: Qualitiative Analysis (The Critique) */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Narrative Intelligence</h3>
                                {isCritiquing && <Loader2 size={12} className="animate-spin text-accent-primary" />}
                            </div>

                            {/* Scene Foundation Section */}
                            <div className="bg-console-surface border border-border-subtle rounded-2xl p-4 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Scene Title</label>
                                    <input
                                        className="w-full bg-console-surface border border-border-subtle rounded px-2 py-1.5 text-xs text-text-primary font-bold focus:border-accent-primary outline-none"
                                        value={sceneForm?.title}
                                        onChange={(e) => onSceneFormChange?.('title', e.target.value)}
                                        placeholder="The Betrayal"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Scene Slugline</label>
                                    <input
                                        className="w-full bg-console-surface border border-border-subtle rounded px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary outline-none"
                                        value={sceneForm?.slugline}
                                        onChange={(e) => onSceneFormChange?.('slugline', e.target.value)}
                                        placeholder="EXT. HOUSE - DAY"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Dramatic Goal</label>
                                    <textarea
                                        className="w-full bg-console-surface border border-border-subtle rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none resize-none"
                                        rows={2}
                                        value={sceneForm?.goal}
                                        onChange={(e) => onSceneFormChange?.('goal', e.target.value)}
                                        placeholder="What must happen in this scene?"
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-border-subtle/40" />

                            {!critique ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-console-surface-2/30 border border-border-subtle/60 rounded-2xl">
                                    <div className="p-4 bg-console-surface rounded-full border border-border-subtle/60">
                                        <Brain size={32} className="text-text-tertiary" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-text-secondary">No Analysis Found</p>
                                        <p className="text-xs text-text-tertiary max-w-[180px] mx-auto">Analyze your scene to detect dialogue issues, pacing flaws, and formatting errors.</p>
                                    </div>
                                    <button
                                        onClick={onCritique ?? (() => { })}
                                        disabled={isCritiquing}
                                        title="Performs a deep structural Executive Audit of your scene."
                                        className="px-6 py-2 bg-accent-primary hover:bg-accent-primary-dark disabled:bg-console-surface-3 text-console-bg disabled:text-text-tertiary text-xs font-black rounded-lg transition-all uppercase tracking-tighter"
                                    >
                                        {isCritiquing ? 'Analyzing...' : 'Run Analysis'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    {/* Scoreboard */}
                                    <div className="bg-console-surface border border-border-subtle rounded-2xl p-4 flex items-center justify-between shadow-elevation-2 overflow-hidden relative">
                                        {(eliteHighScore || 0) > 0 && (
                                            <div className="absolute top-0 right-0 bg-accent-primary/15 border-l border-b border-accent-primary/30 px-2 py-0.5 rounded-bl-lg">
                                                <span className="text-[8px] font-black uppercase text-accent-primary tracking-tighter">Personal Best: {eliteHighScore}</span>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-black text-text-tertiary uppercase">Overall Quality</div>
                                            <div className="text-3xl font-black text-text-primary">{critique.score}<span className="text-text-tertiary text-sm">/100</span></div>
                                        </div>
                                        <div className="bg-accent-primary text-console-bg w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-lg shadow-accent-primary/20">
                                            {critique.grade}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest px-1">Summary Critique</h4>
                                        <p className="text-xs text-text-secondary leading-relaxed font-serif italic p-3 bg-console-surface-2/50 rounded-xl border border-border-subtle/40">
                                            "{critique.summary}"
                                        </p>
                                    </div>

                                    {/* Categorical Issues */}
                                    {[
                                        { label: 'Dialogue', items: critique.dialogueIssues, color: 'text-status-warning' },
                                        { label: 'Pacing', items: critique.pacingIssues, color: 'text-accent-primary' },
                                        { label: 'Formatting', items: critique.formattingIssues, color: 'text-text-secondary' },
                                        { label: 'Suggestions', items: critique.suggestions, color: 'text-status-ok' }
                                    ].map(cat => cat.items.length > 0 && (
                                        <div key={cat.label} className="space-y-2">
                                            <h4 className={`text-[10px] font-bold uppercase tracking-widest px-1 ${cat.color}`}>{cat.label}</h4>
                                            <div className="space-y-1.5">
                                                {cat.items.map((issue, i) => (
                                                    <div key={i} className="flex gap-2 text-[11px] text-text-tertiary pl-2 border-l border-border-subtle">
                                                        <span className="shrink-0 text-text-tertiary/50">•</span>
                                                        <span>{issue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={onCritique}
                                            disabled={isCritiquing || isGenerating || (!!critique && !isCritiqueStale)}
                                            title={(!isCritiqueStale && !!critique) ? "Content is currently up-to-date. Edit the script to re-analyze." : "Runs the Executive Audit again with your new changes."}
                                            className={`flex-1 py-2 border rounded-lg text-[10px] font-bold transition-all uppercase tracking-widest
                                                ${(!isCritiqueStale && !!critique)
                                                    ? 'border-status-ok/30 bg-status-ok/5 text-text-tertiary opacity-50 cursor-not-allowed'
                                                    : 'border-border-subtle hover:bg-console-surface text-text-tertiary hover:text-text-secondary'
                                                }
                                            `}
                                        >
                                            {isCritiquing ? 'Re-analyzing...' : 'Refresh Analysis'}
                                        </button>
                                        <button
                                            onClick={onFix}
                                            disabled={isGenerating || isCritiquing || !!pendingFix || isCritiqueStale}
                                            title={isCritiqueStale ? "Analysis is stale. Please run analysis again before fixing." : "Auto-applies Hollywood-level corrections to your scene."}
                                            className="flex-1 py-2 bg-accent-primary hover:bg-accent-primary-dark disabled:bg-console-surface-3 text-console-bg disabled:text-text-tertiary text-[10px] font-black rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                                        >
                                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            {pendingFix ? 'In Review' : 'Apply Fixes'}
                                        </button>
                                    </div>
                                    {isCritiqueStale && (
                                        <div className="text-[9px] text-status-warning/80 bg-status-warning/5 border border-status-warning/20 p-2 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                            <Brain size={10} />
                                            <span>Content changed. Re-analyze to enable Fixes.</span>
                                        </div>
                                    )}
                                    {critique && canRefreshCritique === false && (
                                        <div className="text-[10px] text-status-warning/70 text-center mt-2 px-2 py-1 bg-status-warning/10 rounded border border-status-warning/20">
                                            Your next critique refresh will use the latest draft changes.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                            <div className="h-px bg-border-subtle/40" />

                            {/* Section: Scene Tools */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Scene Intelligence</h3>
                                    {isGenerating && <Loader2 size={12} className="animate-spin text-accent-primary" />}
                                </div>

                                <div className="bg-console-surface/50 border border-border-subtle/80 rounded-2xl p-4 space-y-4">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Style Reference</label>
                                        <select
                                            className="w-full bg-console-surface border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-text-secondary outline-none"
                                            value={generationOptions?.style}
                                            onChange={(e) => onGenerationOptionChange?.('style', e.target.value)}
                                        >
                                            <option value="classic">Classic Hollywood</option>
                                            <option value="modern">Modern Cinematic</option>
                                            <option value="indie">Indie/Naturalistic</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Scene Length</label>
                                        <select
                                            className="w-full bg-console-surface border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-text-secondary outline-none"
                                            value={generationOptions?.sceneLength}
                                            onChange={(e) => onGenerationOptionChange?.('sceneLength', e.target.value as GenerationOptions['sceneLength'])}
                                        >
                                            <option value="short">Short (1-2 pages)</option>
                                            <option value="medium">Medium (3-5 pages)</option>
                                            <option value="long">Long (6-10 pages)</option>
                                        </select>
                                    </div>
                                    
                                    <div className="flex items-center justify-between p-2 bg-accent-primary/15 rounded-md border border-accent-primary/30">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1 rounded ${generationOptions?.speedMode ? 'bg-accent-primary text-console-bg' : 'bg-console-surface-2 text-text-tertiary'}`}>
                                                <Sparkles size={10} className={generationOptions?.speedMode ? 'animate-pulse' : ''} />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold text-accent-primary uppercase tracking-tight">Lightning Speed</div>
                                                <div className="text-[8px] text-text-tertiary">Bypass RAG & Optimize AI</div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => onGenerationOptionChange?.('speedMode', !generationOptions?.speedMode)}
                                            className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${generationOptions?.speedMode ? 'bg-accent-primary' : 'bg-console-surface-3'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-[color:var(--text-on-accent)] shadow ring-0 transition duration-200 ease-in-out ${generationOptions?.speedMode ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Language</label>
                                        <select
                                            className="w-full bg-console-surface border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-accent-primary font-bold outline-none"
                                            value={generationOptions?.language || 'English'}
                                            onChange={(e) => onGenerationOptionChange?.('language', e.target.value)}
                                        >
                                            <option value="English">English</option>
                                            <option value="Telugu">Telugu</option>
                                            <option value="Hindi">Hindi</option>
                                            <option value="Tamil">Tamil</option>
                                            <option value="Kannada">Kannada</option>
                                            <option value="Malayalam">Malayalam</option>
                                            <option value="Spanish">Spanish</option>
                                            <option value="French">French</option>
                                            <option value="German">German</option>
                                        </select>
                                    </div>

                                    {shouldOfferTransliteration(generationOptions?.language || 'English') && (
                                        <div className="flex items-center justify-between p-2 bg-accent-primary/[0.08] border border-accent-primary/30 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="space-y-0.5">
                                                <div className="text-[9px] font-black text-accent-primary uppercase tracking-widest">Phonetic Soul</div>
                                                <div className="text-[10px] text-text-tertiary font-medium">Use English script</div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={generationOptions?.transliteration}
                                                    onChange={(e) => onGenerationOptionChange?.('transliteration', e.target.checked)}
                                                />
                                                <div className="w-11 h-6 bg-console-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-tertiary after:border-border-subtle after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary peer-checked:after:bg-[color:var(--text-on-accent)]"></div>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={onGenerate}
                                    disabled={isGenerating}
                                    className="w-full py-2.5 bg-accent-primary hover:bg-accent-primary-dark disabled:bg-console-surface text-console-bg text-xs font-black rounded-xl transition-all uppercase tracking-tighter flex items-center justify-center gap-2 disabled:text-text-tertiary"
                                >
                                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    {isGenerating ? 'Generating Scene...' : 'Draft Full Scene'}
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-border-subtle/50" />

                        {/* Section 2: Structural Planning (The Treatment) */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Story Architect</h3>
                                {treatmentLoading && <Loader2 size={12} className="animate-spin text-accent-primary" />}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Logline / Foundation</label>
                                    <textarea
                                        className="w-full bg-console-surface border border-border-subtle/80 rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary outline-none resize-none font-serif italic"
                                        rows={4}
                                        placeholder="In a world where..."
                                        value={treatmentLogline}
                                        onChange={(e) => setTreatmentLogline(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Target Scenes</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className="w-full bg-console-surface border border-border-subtle/80 rounded-lg px-2 py-1.5 text-xs text-text-secondary outline-none"
                                        value={treatmentSceneCount}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setTreatmentSceneCount(parseInt(val) || 0);
                                        }}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 bg-console-surface border border-border-subtle rounded-lg px-2 py-1.5 text-[11px] text-text-secondary outline-none"
                                        value={treatmentStyle}
                                        onChange={(e) => setTreatmentStyle(e.target.value)}
                                    >
                                        <option value="Save The Cat">Save The Cat</option>
                                        <option value="Hero's Journey">Hero's Journey</option>
                                        <option value="Three Act Structure">Three Act Structure</option>
                                        <option value="Fictional Pulse">Fictional Pulse</option>
                                    </select>
                                    <button
                                        onClick={handleTreatmentGenerate}
                                        disabled={treatmentLoading || !treatmentLogline}
                                        className="px-4 py-1.5 bg-accent-primary hover:bg-accent-primary-dark disabled:bg-console-surface text-console-bg disabled:text-text-tertiary text-[11px] font-bold rounded-lg transition-all"
                                    >
                                        Gen Outline
                                    </button>
                                </div>
                            </div>

                            {treatmentPreview && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="p-3 bg-accent-primary/[0.08] border border-accent-primary/30 rounded-xl space-y-4">
                                        {treatmentPreview.map((act, i) => (
                                            <div key={i} className="space-y-1">
                                                <h4 className="text-[10px] font-black text-accent-primary uppercase tracking-widest">{act.name}</h4>
                                                <div className="space-y-1">
                                                    {act.beats.map((beat, bi) => (
                                                        <p key={bi} className="text-[11px] text-text-secondary leading-relaxed font-serif">
                                                        <span className="text-accent-primary/50 font-sans font-bold mr-1">•</span>
                                                        {beat.description}
                                                    </p>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        <button
                                            onClick={handleTreatmentSave}
                                            className="w-full py-2 bg-accent-primary hover:bg-accent-primary-dark text-console-bg text-xs font-black rounded-lg transition-all uppercase tracking-tighter"
                                        >
                                            Save Treatment
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest px-1">Saved Outlines</h4>
                                {treatments.length === 0 ? (
                                    <p className="text-[10px] text-text-disabled italic px-1">No structural outlines saved.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {treatments.map(t => (
                                            <div key={t._id} className="p-3 bg-console-surface-2/40 border border-border-subtle/60 rounded-xl hover:border-border-strong/50 transition-all group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] text-accent-primary font-bold">{t.style}</span>
                                                </div>
                                                <p className="text-[11px] text-text-tertiary line-clamp-2 italic font-serif mb-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    "{t.logline}"
                                                </p>
                                                <button
                                                    onClick={() => handleTreatmentConvert(t._id)}
                                                    className="w-full py-1.5 bg-console-surface hover:bg-console-surface-2 text-text-secondary text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest"
                                                >
                                                    Convert to Scenes
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTool === 'settings' && (
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Project Settings</h3>
                            <p className="text-[10px] text-text-tertiary uppercase">Configuration & Export</p>
                        </div>

                        <div className="space-y-4">
                            {/* AI Provider Settings */}
                            <div className="space-y-2 pt-2 border-b border-border-subtle/30 pb-4">
                                <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">AI Intelligence Provider</label>
                                <div className="grid grid-cols-2 gap-2 bg-console-surface-2/40 p-1 rounded-lg border border-border-subtle/30">
                                    <button
                                        onClick={() => {
                                            if (aiProvider !== 'ollama') {
                                                setIsSwitchingProvider(true);
                                                scriptWriterApi.setAIProvider('ollama')
                                                    .then((p) => setAiProvider(p))
                                                    .finally(() => setIsSwitchingProvider(false));
                                            }
                                        }}
                                        disabled={isSwitchingProvider}
                                        className={`
                                            py-2 px-3 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                                            ${aiProvider === 'ollama'
                                                ? 'bg-console-surface text-text-primary shadow-sm'
                                                : 'text-text-tertiary hover:text-text-secondary hover:bg-console-surface-2/40'}
                                        `}
                                    >
                                        {aiProvider === 'ollama' && isSwitchingProvider ? <Loader2 size={12} className="animate-spin" /> : null}
                                        Ollama (Local)
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (aiProvider !== 'groq') {
                                                setIsSwitchingProvider(true);
                                                scriptWriterApi.setAIProvider('groq')
                                                    .then((p) => setAiProvider(p))
                                                    .catch((err) => alert(err.message))
                                                    .finally(() => setIsSwitchingProvider(false));
                                            }
                                        }}
                                        disabled={isSwitchingProvider}
                                        className={`
                                            py-2 px-3 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                                            col-span-2
                                            ${aiProvider === 'groq'
                                                ? 'bg-status-warning text-console-bg shadow-sm shadow-status-warning/20'
                                                : 'text-text-tertiary hover:text-status-warning hover:bg-status-warning/15'}
                                        `}
                                    >
                                        {aiProvider === 'groq' && isSwitchingProvider ? <Loader2 size={12} className="animate-spin" /> : null}
                                        Groq (Cloud)
                                    </button>
                                </div>
                            </div>

                            {/* AI Model Selection */}
                            <div className="space-y-1.5 pt-2 border-b border-border-subtle/30 pb-4">
                                <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Specific AI Model</label>
                                {aiProvider === 'groq' ? (
                                    <select
                                        className="w-full bg-console-surface border border-border-subtle rounded px-2 py-1.5 text-xs text-status-warning focus:border-status-warning outline-none"
                                        value={aiModel}
                                        onChange={(e) => setAiModel(e.target.value)}
                                    >
                                        <option value="">Default (Fastest)</option>
                                        <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Smart)</option>
                                        <option value="llama-3.1-8b-instant">Llama 3.1 8B (Instant)</option>
                                        <option value="deepseek-r1-distill-llama-70b">DeepSeek R1 70B (Reasoning)</option>
                                        <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                                    </select>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 bg-console-surface border border-border-subtle rounded px-2 py-1.5 text-xs text-text-secondary focus:border-accent-primary outline-none"
                                            value={aiModel}
                                            onChange={(e) => setAiModel(e.target.value)}
                                            placeholder="e.g. llama3, mistral, deepseek-r1:7b"
                                        />
                                        <select
                                            className="bg-console-surface border border-border-subtle rounded px-1 text-[10px] text-text-tertiary outline-none"
                                            onChange={(e) => setAiModel(e.target.value)}
                                            value=""
                                        >
                                            <option value="" disabled>Presets</option>
                                            <option value="llama3">Llama 3</option>
                                            <option value="mistral">Mistral</option>
                                            <option value="deepseek-r1:7b">DeepSeek R1 7B</option>
                                            <option value="phi3">Phi 3</option>
                                        </select>
                                    </div>
                                )}
                                <p className="text-[9px] text-text-tertiary px-1 italic">
                                    {aiProvider === 'groq' 
                                        ? 'Cloud models provide high-speed creative output.' 
                                        : 'Local models require Ollama to be running on your machine.'}
                                </p>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Export Project</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => onExport?.('fountain')}
                                        className="py-2 bg-console-surface border border-border-subtle rounded-lg text-xs hover:bg-console-surface-2 transition-colors"
                                    >
                                        Fountain (.fountain)
                                    </button>
                                    <button
                                        onClick={() => onExport?.('txt')}
                                        className="py-2 bg-console-surface border border-border-subtle rounded-lg text-xs hover:bg-console-surface-2 transition-colors"
                                    >
                                        Text (.txt)
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-text-tertiary uppercase px-1">Project Name</label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-console-surface border border-border-subtle rounded px-3 py-2 text-sm text-text-primary focus:border-accent-primary outline-none"
                                        value={projectTitle}
                                        onChange={(e) => {
                                            if (!activeProject) {
                                                return;
                                            }
                                            setProjectTitleDrafts((prev) => ({
                                                ...prev,
                                                [activeProject._id]: e.target.value
                                            }));
                                        }}
                                        placeholder="Enter project title"
                                    />
                                    <button
                                        onClick={() => activeProject?._id && handleUpdateProject?.(activeProject._id, { title: projectTitle })}
                                        className="px-3 bg-console-surface hover:bg-console-surface-2 rounded text-xs font-medium text-text-secondary transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-4">
                                <label className="text-[10px] font-bold text-status-error/80 uppercase px-1">Danger Zone</label>
                                <div className="border border-status-error/20 bg-status-error-soft rounded p-3">
                                <p className="text-[11px] text-text-tertiary mb-3">Deleting a project is permanent and cannot be undone.</p>
                                    <button
                                        className="w-full bg-console-surface hover:bg-status-error/12 border border-status-error/30 text-status-error py-1.5 rounded text-xs font-medium transition-colors"
                                        onClick={() => activeProject?._id && handleDeleteProject?.(activeProject._id)}
                                    >
                                        Delete Project
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <DiffReviewModal
                isOpen={reviewModal.isOpen}
                originalContent={reviewModal.originalContent}
                newContent={reviewModal.newContent}
                onDiscard={async () => {
                    await handleDiscardProposal(reviewModal.messageId);
                    setReviewModal(prev => ({ ...prev, isOpen: false }));
                    if (setPendingFix) setPendingFix(null);
                }}
                onApply={async () => {
                    const res = await handleConfirmEdit(reviewModal.messageId, reviewModal.newContent);
                    if (res?.success && setEditorContent) {
                        setEditorContent(reviewModal.newContent);
                    }
                    setReviewModal(prev => ({ ...prev, isOpen: false }));
                    if (setPendingFix) setPendingFix(null);
                }}
            />
        </div>
    );
}
