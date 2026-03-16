import { useState, useEffect } from 'react';
import { Sparkles, Brain, ChevronRight, Settings, Loader2 } from 'lucide-react';
import { useScriptWriter } from '../../../contexts/ScriptWriterContext';
import { useScriptWriterGenerator } from '../useScriptWriterGenerator';
import { useScriptWriterTreatments } from '../useScriptWriterTreatments';
import { AssistantPanel } from './AssistantPanel';
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
    characters = []
}: ContextPanelProps) {
    const { uiState, setRightPanelTool, toggleRightPanel, activeProject: contextActiveProject, editorContent, setEditorContent } = useScriptWriter();
    const activeProject = propActiveProject || contextActiveProject;
    const { activeTool, rightPanelOpen } = uiState;

    const [projectTitleDrafts, setProjectTitleDrafts] = useState<Record<string, string>>({});
    const [aiProvider, setAiProvider] = useState<string>('ollama');
    const [isSwitchingProvider, setIsSwitchingProvider] = useState(false);
    const projectTitle = activeProject ? projectTitleDrafts[activeProject._id] ?? activeProject.title ?? '' : '';

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
            <div className="flex flex-col h-full bg-zinc-950 items-center py-2 border-l border-zinc-800 w-12">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setRightPanelTool(tab.id)}
                        className={`
                            mb-2 rounded-lg p-1.5 transition-colors hover:bg-zinc-900
                            ${activeTool === tab.id ? 'text-zinc-200' : 'text-zinc-500'}
                        `}
                        title={tab.label}
                    >
                        <tab.icon size={18} />
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-zinc-300">
            {/* Tab Header - Context Switcher */}
            <div className="h-9 border-b border-zinc-800 flex items-center bg-zinc-950 sticky top-0 z-10 overflow-hidden">
                <div className="flex-1 flex items-center overflow-x-auto no-scrollbar h-full">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setRightPanelTool(tab.id)}
                            className={`
                                flex-none flex items-center justify-center h-full px-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] border-b transition-all
                                ${activeTool === tab.id
                                    ? 'border-zinc-600 text-zinc-100 bg-zinc-900/70'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}
                            `}
                            title={tab.label}
                        >
                            <tab.icon size={11} className="mr-1.5" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex-none px-2 flex items-center border-l border-zinc-900 bg-zinc-950 h-full">
                    <button
                        onClick={toggleRightPanel}
                        className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
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
                            onSendMessage={(request) => handleAssistantSendMessage(request, activeScene?._id || null, (updatedContent, finished, activeRequest, proposalMessageId) => {
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
                                                await handleApplyProposal(proposalMessageId, activeScene?._id || null);
                                            }
                                            : undefined,
                                        discardProposal: proposalMessageId
                                            ? async () => {
                                                await handleDiscardProposal(proposalMessageId, activeScene?._id || null);
                                            }
                                            : undefined
                                    });
                                }
                            })}
                            onApplyProposal={(id: string) => {
                                handleApplyProposal(id, activeScene?._id || null);
                                if (pendingFix?.proposalMessageId === id && setPendingFix) {
                                    setPendingFix(null);
                                }
                            }}
                            onDiscardProposal={(id: string) => {
                                handleDiscardProposal(id, activeScene?._id || null);
                                if (pendingFix?.proposalMessageId === id && setPendingFix) {
                                    setPendingFix(null);
                                }
                            }}
                            onDeleteMessage={(id: string) => handleDeleteAssistantMessage(id, activeScene?._id || null)}
                            onUpdateMessage={(id: string, content: string) => handleUpdateAssistantMessage(id, content, activeScene?._id || null)}
                            onClearChat={() => {
                                handleClearChat(activeScene?._id || null);
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
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Narrative Intelligence</h3>
                                {isCritiquing && <Loader2 size={12} className="animate-spin text-blue-400" />}
                            </div>

                            {/* Scene Foundation Section */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Scene Title</label>
                                    <input
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100 font-bold focus:border-blue-500 outline-none"
                                        value={sceneForm?.title}
                                        onChange={(e) => onSceneFormChange?.('title', e.target.value)}
                                        placeholder="The Betrayal"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Scene Slugline</label>
                                    <input
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100 focus:border-blue-500 outline-none"
                                        value={sceneForm?.slugline}
                                        onChange={(e) => onSceneFormChange?.('slugline', e.target.value)}
                                        placeholder="EXT. HOUSE - DAY"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Dramatic Goal</label>
                                    <textarea
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 outline-none resize-none"
                                        rows={2}
                                        value={sceneForm?.goal}
                                        onChange={(e) => onSceneFormChange?.('goal', e.target.value)}
                                        placeholder="What must happen in this scene?"
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-zinc-800/20" />

                            {!critique ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl">
                                    <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800">
                                        <Brain size={32} className="text-zinc-700" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-zinc-400">No Analysis Found</p>
                                        <p className="text-xs text-zinc-600 max-w-[180px] mx-auto">Analyze your scene to detect dialogue issues, pacing flaws, and formatting errors.</p>
                                    </div>
                                    <button
                                        onClick={onCritique ?? (() => { })}
                                        disabled={isCritiquing}
                                        title="Performs a deep structural Executive Audit of your scene."
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white text-xs font-black rounded-lg transition-all uppercase tracking-tighter"
                                    >
                                        {isCritiquing ? 'Analyzing...' : 'Run Analysis'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    {/* Scoreboard */}
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between shadow-2xl shadow-black/50 overflow-hidden relative">
                                        {(eliteHighScore || 0) > 0 && (
                                            <div className="absolute top-0 right-0 bg-blue-600/10 border-l border-b border-blue-500/20 px-2 py-0.5 rounded-bl-lg">
                                                <span className="text-[8px] font-black uppercase text-blue-400 tracking-tighter">Personal Best: {eliteHighScore}</span>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-black text-zinc-500 uppercase">Overall Quality</div>
                                            <div className="text-3xl font-black text-white">{critique.score}<span className="text-zinc-500 text-sm">/100</span></div>
                                        </div>
                                        <div className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-lg shadow-blue-900/20">
                                            {critique.grade}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Summary Critique</h4>
                                        <p className="text-xs text-zinc-300 leading-relaxed font-serif italic p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                                            "{critique.summary}"
                                        </p>
                                    </div>

                                    {/* Categorical Issues */}
                                    {[
                                        { label: 'Dialogue', items: critique.dialogueIssues, color: 'text-amber-400' },
                                        { label: 'Pacing', items: critique.pacingIssues, color: 'text-blue-400' },
                                        { label: 'Formatting', items: critique.formattingIssues, color: 'text-zinc-400' },
                                        { label: 'Suggestions', items: critique.suggestions, color: 'text-emerald-400' }
                                    ].map(cat => cat.items.length > 0 && (
                                        <div key={cat.label} className="space-y-2">
                                            <h4 className={`text-[10px] font-bold uppercase tracking-widest px-1 ${cat.color}`}>{cat.label}</h4>
                                            <div className="space-y-1.5">
                                                {cat.items.map((issue, i) => (
                                                    <div key={i} className="flex gap-2 text-[11px] text-zinc-400 pl-2 border-l border-zinc-800">
                                                        <span className="shrink-0 text-zinc-600">•</span>
                                                        <span>{issue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={onCritique}
                                            disabled={isCritiquing || isGenerating}
                                            title="Runs the Executive Audit again with your new changes."
                                            className={`flex-1 py-2 border rounded-lg text-[10px] font-bold transition-all uppercase tracking-widest
                                                ${(critique && canRefreshCritique === false)
                                                    ? 'border-amber-900/30 hover:bg-amber-900/10 text-zinc-400'
                                                    : 'border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-300'
                                                }
                                            `}
                                        >
                                            {isCritiquing ? 'Re-analyzing...' : 'Refresh Analysis'}
                                        </button>
                                        <button
                                            onClick={onFix}
                                            disabled={isGenerating || isCritiquing || !!pendingFix}
                                            title="Auto-applies Hollywood-level corrections to your scene."
                                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white text-[10px] font-black rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                                        >
                                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            {pendingFix ? 'In Review' : 'Apply Fixes'}
                                        </button>
                                    </div>
                                    {critique && canRefreshCritique === false && (
                                        <div className="text-[10px] text-amber-500/70 text-center mt-2 px-2 py-1 bg-amber-950/10 rounded border border-amber-900/20">
                                            Edit {Math.max(0, 3 - (pointsToRefresh || 0))} more lines to refresh critique.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-zinc-800/50" />

                        {/* Section: Scene Tools */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Scene Intelligence</h3>
                                {isGenerating && <Loader2 size={12} className="animate-spin text-blue-400" />}
                            </div>

                            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 space-y-4">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Style Reference</label>
                                        <select
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 outline-none"
                                            value={generationOptions?.style}
                                            onChange={(e) => onGenerationOptionChange?.('style', e.target.value)}
                                        >
                                            <option value="classic">Classic Hollywood</option>
                                            <option value="modern">Modern Cinematic</option>
                                            <option value="indie">Indie/Naturalistic</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Scene Length</label>
                                        <select
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 outline-none"
                                            value={generationOptions?.sceneLength}
                                            onChange={(e) => onGenerationOptionChange?.('sceneLength', e.target.value as GenerationOptions['sceneLength'])}
                                        >
                                            <option value="short">Short (1-2 pages)</option>
                                            <option value="medium">Medium (3-5 pages)</option>
                                            <option value="long">Long (6-10 pages)</option>
                                        </select>
                                    </div>
                                    
                                    <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-md border border-blue-500/20">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1 rounded ${generationOptions?.speedMode ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                                <Sparkles size={10} className={generationOptions?.speedMode ? 'animate-pulse' : ''} />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-tight">Lightning Speed</div>
                                                <div className="text-[8px] text-zinc-500">Bypass RAG & Optimize AI</div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => onGenerationOptionChange?.('speedMode', !generationOptions?.speedMode)}
                                            className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${generationOptions?.speedMode ? 'bg-blue-600' : 'bg-zinc-800'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${generationOptions?.speedMode ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Language</label>
                                        <select
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-blue-300 font-bold outline-none"
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
                                        <div className="flex items-center justify-between p-2 bg-blue-900/10 border border-blue-900/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="space-y-0.5">
                                                <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Phonetic Soul</div>
                                                <div className="text-[10px] text-zinc-500 font-medium">Use English script</div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={generationOptions?.transliteration}
                                                    onChange={(e) => onGenerationOptionChange?.('transliteration', e.target.checked)}
                                                />
                                                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={onGenerate}
                                    disabled={isGenerating}
                                    className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-black rounded-xl transition-all uppercase tracking-tighter flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    {isGenerating ? 'Generating Scene...' : 'Draft Full Scene'}
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-zinc-800/50" />

                        {/* Section 2: Structural Planning (The Treatment) */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Story Architect</h3>
                                {treatmentLoading && <Loader2 size={12} className="animate-spin text-blue-400" />}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Logline / Foundation</label>
                                    <textarea
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-700 focus:border-blue-500 outline-none resize-none font-serif italic"
                                        rows={4}
                                        placeholder="In a world where..."
                                        value={treatmentLogline}
                                        onChange={(e) => setTreatmentLogline(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Target Scenes</label>
                                    <input
                                        type="number"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 outline-none"
                                        value={treatmentSceneCount}
                                        onChange={(e) => setTreatmentSceneCount(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-400 outline-none"
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
                                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white text-[11px] font-bold rounded-lg transition-all"
                                    >
                                        Gen Outline
                                    </button>
                                </div>
                            </div>

                            {treatmentPreview && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="p-3 bg-blue-950/10 border border-blue-900/30 rounded-xl space-y-4">
                                        {treatmentPreview.map((act, i) => (
                                            <div key={i} className="space-y-1">
                                                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{act.name}</h4>
                                                <div className="space-y-1">
                                                    {act.beats.map((beat, bi) => (
                                                        <p key={bi} className="text-[11px] text-zinc-300 leading-relaxed font-serif">
                                                            <span className="text-blue-500/50 font-sans font-bold mr-1">•</span>
                                                            {beat.description}
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        <button
                                            onClick={handleTreatmentSave}
                                            className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-black rounded-lg transition-all uppercase tracking-tighter"
                                        >
                                            Save Treatment
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">Saved Outlines</h4>
                                {treatments.length === 0 ? (
                                    <p className="text-[10px] text-zinc-700 italic px-1">No structural outlines saved.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {treatments.map(t => (
                                            <div key={t._id} className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-xl hover:border-zinc-700 transition-all group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] text-blue-500 font-bold">{t.style}</span>
                                                </div>
                                                <p className="text-[11px] text-zinc-400 line-clamp-2 italic font-serif mb-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    "{t.logline}"
                                                </p>
                                                <button
                                                    onClick={() => handleTreatmentConvert(t._id)}
                                                    className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest"
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
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Project Settings</h3>
                            <p className="text-[10px] text-zinc-600 uppercase">Configuration & Export</p>
                        </div>

                        <div className="space-y-4">
                            {/* AI Provider Settings */}
                            <div className="space-y-2 pt-2 border-b border-zinc-800/50 pb-4">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">AI Intelligence Provider</label>
                                <div className="grid grid-cols-2 gap-2 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50">
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
                                                ? 'bg-zinc-800 text-white shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
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
                                                ? 'bg-orange-600 text-white shadow-sm shadow-orange-900/20'
                                                : 'text-zinc-500 hover:text-orange-400 hover:bg-orange-900/10'}
                                        `}
                                    >
                                        {aiProvider === 'groq' && isSwitchingProvider ? <Loader2 size={12} className="animate-spin" /> : null}
                                        Groq (Cloud)
                                    </button>
                                </div>
                            </div>

                            {/* AI Model Selection */}
                            <div className="space-y-1.5 pt-2 border-b border-zinc-800/50 pb-4">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Specific AI Model</label>
                                {aiProvider === 'groq' ? (
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-orange-200 focus:border-orange-500 outline-none"
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
                                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-blue-500 outline-none"
                                            value={aiModel}
                                            onChange={(e) => setAiModel(e.target.value)}
                                            placeholder="e.g. llama3, mistral, deepseek-r1:7b"
                                        />
                                        <select
                                            className="bg-zinc-900 border border-zinc-800 rounded px-1 text-[10px] text-zinc-500 outline-none"
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
                                <p className="text-[9px] text-zinc-600 px-1 italic">
                                    {aiProvider === 'groq' 
                                        ? 'Cloud models provide high-speed creative output.' 
                                        : 'Local models require Ollama to be running on your machine.'}
                                </p>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Export Project</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => onExport?.('fountain')}
                                        className="py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs hover:bg-zinc-800 transition-colors"
                                    >
                                        Fountain (.fountain)
                                    </button>
                                    <button
                                        onClick={() => onExport?.('txt')}
                                        className="py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs hover:bg-zinc-800 transition-colors"
                                    >
                                        Text (.txt)
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Project Name</label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 outline-none"
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
                                        className="px-3 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium text-zinc-300 transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-4">
                                <label className="text-[10px] font-bold text-red-500/70 uppercase px-1">Danger Zone</label>
                                <div className="border border-red-900/20 bg-red-900/5 rounded p-3">
                                    <p className="text-[11px] text-zinc-500 mb-3">Deleting a project is permanent and cannot be undone.</p>
                                    <button
                                        className="w-full bg-red-950/30 hover:bg-red-900/40 border border-red-900/30 text-red-400 py-1.5 rounded text-xs font-medium transition-colors"
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
        </div>
    );
}
