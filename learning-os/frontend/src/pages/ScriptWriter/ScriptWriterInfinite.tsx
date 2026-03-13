import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ScriptWriterProvider, useScriptWriter } from '../../contexts/ScriptWriterContext';
import { InfiniteLayout } from './components/InfiniteLayout';
import { StudioEditor } from './StudioEditor';
import { StudioStatusbar } from './StudioStatusbar';
import { useScriptWriterProjects } from './useScriptWriterProjects';
import { useScriptWriterSceneEditor } from './useScriptWriterSceneEditor';
import { useScriptWriterCharacters } from './useScriptWriterCharacters';
import { StructurePanel } from './components/StructurePanel';
import { ContextPanel } from './components/ContextPanel';
import { InfiniteTopbar } from './components/InfiniteTopbar';
import { BiblePortal } from './components/BiblePortal';
import { FixAuditorOverlay } from './components/FixAuditorOverlay';
import { projectApi } from '../../services/project.api';

// Inner component that has access to the Context
function ScriptWriterInfiniteContent() {
    const { projectId, sceneId: urlSceneId } = useParams<{ projectId: string, sceneId: string }>();
    const navigate = useNavigate();

    const {
        uiState,
        setActiveProject,
        setActiveScene,
        setEditorContent,
        activeProject: contextActiveProject,
        activeScene: contextActiveScene
    } = useScriptWriter();

    const [error, setError] = useState<string | null>(null);

    // --- DATA HOOKS ---
    const {
        projects,
        loadingProjects,
        projectScenes,
        handleUpdateProject,
        handleDeleteProject,
        handleNewScene,
        handleUpdateScene,
        handleDeleteScene,
        loadScenes,
        updateSceneInState,
    } = useScriptWriterProjects({
        activeProjectId: projectId || null,
        setActiveProjectId: (id) => {
            // Logic to update context if valid
            if (id && projects.length > 0) {
                const project = projects.find(p => p._id === id) || null;
                if (project) setActiveProject(project);
            }
        },
        activeSceneId: urlSceneId || null,
        setActiveSceneId: (id) => {
            if (!id) {
                setActiveScene(null);
                if (projectId) navigate(`/script-writer/${projectId}`);
                return;
            }
            if (projectId) {
                const scene = projectScenes[projectId]?.find(s => s._id === id) || null;
                setActiveScene(scene);
                // Update URL when scene is selected
                if (urlSceneId !== id) {
                    navigate(`/script-writer/${projectId}/${id}`);
                }
            }
        },
        setError
    });

    // Effect to sync URL projectId with Context
    useEffect(() => {
        if (!loadingProjects && projects.length > 0 && projectId) {
            const project = projects.find(p => p._id === projectId);
            if (project) {
                setActiveProject(project);
            } else {
                // Project not found, redirect to dashboard
                navigate('/script-writer');
            }
        }
    }, [projectId, projects, loadingProjects, setActiveProject, navigate]);

    const activeProjectId = projectId || null;
    const activeProject = contextActiveProject;
    const activeScene = contextActiveScene;

    // Effect to sync contextActiveScene with data from projectScenes (if list refreshes)
    useEffect(() => {
        if (activeProjectId && contextActiveScene?._id) {
            const freshScene = projectScenes[activeProjectId]?.find(s => s._id === contextActiveScene._id);
            if (freshScene && freshScene !== contextActiveScene) {
                // Check for deep equality or just specific fields if needed
                // For persistence, we just want to ensure we have the latest from DB
                setActiveScene(freshScene);
            }
        }
    }, [projectScenes, activeProjectId, contextActiveScene, contextActiveScene?._id, setActiveScene]);

    // --- EDITOR HOOK ---
    const {
        editorContent,
        editorSelection,
        saveState,
        wordCount,
        isGenerating,
        generationProgress,
        isCritiquing,
        critique,
        sceneForm,
        generationOptions,
        handleContentChange,
        handleSelectionChange,
        handleCritiqueScene,
        handleGenerateScene,
        handleFixScene,
        handleAcceptFix,
        handleDiscardFix,
        handleSceneFormChange,
        handleGenerationOptionChange,
        canRefreshCritique,
        pointsToRefresh,
        eliteHighScore,
        pendingFix,
        setPendingFix
    } = useScriptWriterSceneEditor({
        activeScene,
        activeProjectId,
        updateSceneInState,
        setError
    });

    useEffect(() => {
        setEditorContent(editorContent);
    }, [editorContent, setEditorContent]);

    const {
        characters,
        characterForm,
        isSavingCharacter,
        handleCreateCharacter,
        handleUpdateCharacter,
        handleDeleteCharacter,
        handleCharacterSelect,
        activeCharacterId,
        handleCharacterFormChange,
        ingestingCharacterIds,
        voiceStatus,
        handleVoiceIngest
    } = useScriptWriterCharacters({ activeProjectId, setError });

    const sceneCount = activeProjectId ? (projectScenes[activeProjectId] || []).length : 0;



    // Loading state or redirecting...
    if (loadingProjects) {
        return <div className="flex items-center justify-center h-full bg-zinc-950 text-zinc-500">Loading Studio...</div>;
    }

    if (!activeProjectId || !activeProject) {
        return <div className="flex items-center justify-center h-full bg-zinc-950 text-zinc-500">Initializing Project...</div>;
    }
    return (
        <InfiniteLayout
            leftPanelOpen={uiState.leftPanelOpen}
            rightPanelOpen={uiState.rightPanelOpen}
            leftPanel={
                <StructurePanel
                    scenes={activeProjectId ? (projectScenes[activeProjectId] || []) : []}
                    onNewScene={handleNewScene}
                    onDeleteScene={handleDeleteScene}
                    onUpdateScene={async (sceneId, updates) => {
                        if (activeProjectId) {
                            await handleUpdateScene(activeProjectId, sceneId, updates);
                        }
                    }}
                />
            }
            rightPanel={
                <ContextPanel
                    isGenerating={isGenerating}
                    isCritiquing={isCritiquing}
                    critique={critique}
                    onCritique={handleCritiqueScene}
                    onGenerate={handleGenerateScene}
                    onFix={handleFixScene}
                    sceneForm={sceneForm}
                    onSceneFormChange={handleSceneFormChange}
                    generationOptions={generationOptions}
                    onGenerationOptionChange={handleGenerationOptionChange}
                    handleUpdateProject={handleUpdateProject}
                    handleDeleteProject={handleDeleteProject}
                    activeProject={activeProject}
                    onExport={(format: 'fountain' | 'txt' | 'json' | 'pdf') => projectApi.exportProject(activeProjectId!, format)}
                    canRefreshCritique={canRefreshCritique}
                    pointsToRefresh={pointsToRefresh}
                    eliteHighScore={eliteHighScore}
                    refreshScenes={loadScenes}
                    activeScene={activeScene}
                    editorSelection={editorSelection}
                    pendingFix={pendingFix}
                    setPendingFix={setPendingFix}
                    setError={setError}
                />
            }
        >
            <div className="flex-1 flex flex-col h-full relative">
                <InfiniteTopbar />

                <div
                    className="flex-1 overflow-hidden relative flex flex-col"
                    style={{ isolation: 'isolate' }}
                >
                    {uiState.viewMode === 'editor' ? (
                        <StudioEditor
                            activeProject={activeProject}
                            activeScene={activeScene}
                            editorContent={editorContent}
                            editorSelection={editorSelection}
                            onContentChange={handleContentChange}
                            onSelectionChange={handleSelectionChange}
                            saveState={saveState}
                            wordCount={wordCount}
                            sceneCount={sceneCount}
                            characterCount={characters.length}
                            isGenerating={isGenerating}
                            generationProgress={generationProgress}
                        />
                    ) : (
                        <BiblePortal
                            activeProject={activeProject}
                            characters={characters}
                            onUpdateProject={handleUpdateProject}
                            onDeleteProject={handleDeleteProject}
                            // Character Handlers
                            // Character Handlers
                            characterForm={characterForm}
                            isSavingCharacter={isSavingCharacter}
                            onCreateCharacter={handleCreateCharacter}
                            onUpdateCharacter={handleUpdateCharacter}
                            onDeleteCharacter={handleDeleteCharacter}
                            onCharacterSelect={handleCharacterSelect}
                            activeCharacterId={activeCharacterId}
                            onCharacterFormChange={handleCharacterFormChange}
                            // RAG Handlers
                            ingestingCharacterIds={ingestingCharacterIds}
                            voiceStatus={voiceStatus}
                            onVoiceIngest={handleVoiceIngest}
                        />
                    )}

                    {/* Quality Guard Auditor Overlay */}
                    {pendingFix && (
                        <FixAuditorOverlay
                            originalContent={editorContent}
                            pendingFix={pendingFix}
                            onAccept={handleAcceptFix}
                            onDiscard={handleDiscardFix}
                        />
                    )}
                </div>

                <StudioStatusbar
                    projectCount={projects.length}
                    activeProject={activeProject}
                    activeScene={activeScene}
                    error={error}
                />
            </div>
        </InfiniteLayout>
    );
}

// Resulting Export
export function ScriptWriterInfinite() {
    return (
        <ScriptWriterProvider>
            <ScriptWriterInfiniteContent />
        </ScriptWriterProvider>
    );
}
