import { useEffect, useState } from 'react';
import type { Bible } from '../../services/project.api';
import type { ScriptHistoryItem, ScriptTemplates, IScriptDetail, ScriptRequest } from '../../services/scriptWriter.api';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import { getErrorMessage } from './utils';

interface UseScriptWriterGeneratorProps {
    activeProject: Bible | null;
    activeProjectId: string | null;
    editorContext?: string;
    setError: (message: string | null) => void;
}

export function useScriptWriterGenerator({
    activeProject,
    activeProjectId,
    editorContext,
    setError
}: UseScriptWriterGeneratorProps) {
    const [scriptTemplates, setScriptTemplates] = useState<ScriptTemplates | null>(null);
    const [scriptIdea, setScriptIdea] = useState('');
    const [scriptFormat, setScriptFormat] = useState('');
    const [scriptStyle, setScriptStyle] = useState('');
    const [scriptOutput, setScriptOutput] = useState('');
    const [scriptLanguage, setScriptLanguage] = useState('English');
    const [scriptHistory, setScriptHistory] = useState<ScriptHistoryItem[]>([]);
    const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
    const [isScriptGenerating, setIsScriptGenerating] = useState(false);
    const [selectedScriptCharacterIds, setSelectedScriptCharacterIds] = useState<string[]>([]);

    useEffect(() => {
        loadTemplates();
        loadScriptHistory();
    }, []);

    useEffect(() => {
        if (activeProject?.logline && !scriptIdea) {
            setScriptIdea(activeProject.logline);
        }
        // Default to project language if available
        if (activeProject && (activeProject as any).language) {
            setScriptLanguage((activeProject as any).language);
        }
    }, [activeProject]);

    useEffect(() => {
        setSelectedScriptCharacterIds([]);
        if (!activeProjectId) {
            setScriptIdea('');
        }
    }, [activeProjectId]);

    const loadTemplates = async () => {
        try {
            const templates = await scriptWriterApi.getTemplates();
            setScriptTemplates(templates);
            if (templates.formats.length > 0) setScriptFormat(templates.formats[0].id);
            if (templates.styles.length > 0) setScriptStyle(templates.styles[0].id);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load templates'));
        }
    };

    const loadScriptHistory = async () => {
        try {
            const history = await scriptWriterApi.getHistory();
            setScriptHistory(history);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load script history'));
        }
    };

    const handleScriptGenerate = async () => {
        if (!scriptIdea.trim() || !scriptFormat || !scriptStyle) return;
        setIsScriptGenerating(true);
        setScriptOutput('');
        setActiveHistoryId(null);
        setError(null);
        try {
            const request: ScriptRequest = {
                idea: scriptIdea,
                format: scriptFormat,
                style: scriptStyle,
                genre: activeProject?.genre,
                tone: activeProject?.tone,
                language: scriptLanguage, // Pass the selected language
                bibleId: activeProjectId || undefined,
                characterIds: selectedScriptCharacterIds,
                currentContent: editorContext,
            };

            await scriptWriterApi.generateScriptStream(request, (chunk) => {
                setScriptOutput((prev) => prev + chunk);
            });

            await loadScriptHistory();
        } catch (err) {
            setError(getErrorMessage(err, 'Script generation failed'));
        } finally {
            setIsScriptGenerating(false);
        }
    };

    const handleScriptHistorySelect = async (scriptId: string) => {
        setActiveHistoryId(scriptId);
        try {
            const detail: IScriptDetail = await scriptWriterApi.getScript(scriptId);
            setScriptOutput(detail.content || '');
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load script'));
        }
    };

    const toggleScriptCharacter = (characterId: string) => {
        setSelectedScriptCharacterIds((prev) =>
            prev.includes(characterId) ? prev.filter((id) => id !== characterId) : [...prev, characterId]
        );
    };

    return {
        scriptTemplates,
        scriptIdea,
        scriptFormat,
        scriptStyle,
        scriptOutput,
        scriptHistory,
        activeHistoryId,
        isScriptGenerating,
        selectedScriptCharacterIds,
        scriptLanguage,
        setScriptIdea,
        setScriptFormat,
        setScriptStyle,
        setScriptLanguage,
        handleScriptGenerate,
        handleScriptHistorySelect,
        toggleScriptCharacter
    };
}
