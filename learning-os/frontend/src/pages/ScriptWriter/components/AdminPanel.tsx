import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Database,
    Plus,
    RefreshCcw,
    CheckCircle2,
    Clock,
    AlertCircle,
    Tag,
    User,
    FileText,
    Search,
    Trash2,
    Eye
} from 'lucide-react';
import { scriptWriterApi } from '../../../services/scriptWriter.api';
import type { IMasterScript } from '../../../services/scriptWriter.api';

export function AdminPanel() {
    const navigate = useNavigate();
    const [scripts, setScripts] = useState<IMasterScript[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        director: '',
        language: 'English',
        tags: '',
        rawContent: '',
        file: null as File | null
    });

    const fetchScripts = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await scriptWriterApi.getMasterScripts();
            setScripts(data);
        } catch (err) {
            console.error('Failed to fetch master scripts:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchScripts();
    }, []);

    // Auto-poll if any script is still processing
    useEffect(() => {
        const hasProcessingScripts = scripts.some(s => s.status === 'processing' || s.status === 'validating');
        if (!hasProcessingScripts) return;

        const interval = setInterval(() => {
            fetchScripts(true); // silent fetch
        }, 1000);

        return () => clearInterval(interval);
    }, [scripts]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newScript = await scriptWriterApi.createMasterScript({
                ...formData,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                file: formData.file || undefined
            });
            setIsAdding(false);
            setFormData({ title: '', director: '', language: 'English', tags: '', rawContent: '', file: null });

            // Automatically trigger processing
            if (newScript._id) {
                await scriptWriterApi.processMasterScript(newScript._id);
            }

            fetchScripts();
        } catch {
            alert('Failed to create script');
        }
    };

    const handleProcess = async (id: string) => {
        try {
            await scriptWriterApi.processMasterScript(id);
            fetchScripts();
        } catch {
            alert('Processing failed');
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`Are you sure you want to delete "${title}"? This will remove all associated AI training data permanently.`)) return;

        try {
            setIsDeleting(id);
            await scriptWriterApi.deleteMasterScript(id);
            await fetchScripts();
        } catch {
            alert('Failed to delete script');
        } finally {
            setIsDeleting(null);
        }
    };

    const filteredScripts = scripts.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.director.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.language?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'indexed': return <CheckCircle2 size={14} className="text-emerald-500" />;
            case 'processing': return <RefreshCcw size={14} className="text-blue-500 animate-spin" />;
            case 'validating': return <RefreshCcw size={14} className="text-amber-400 animate-spin" />;
            case 'failed': return <AlertCircle size={14} className="text-red-500" />;
            default: return <Clock size={14} className="text-zinc-500" />;
        }
    };

    const openReader = (script: IMasterScript) => {
        const params = new URLSearchParams();
        const preferredVersion = script.processingScriptVersion || script.activeScriptVersion;
        if (preferredVersion) {
            params.set('version', preferredVersion);
        }
        params.set('title', script.title);
        navigate(`/script-writer/master-script/${script._id}?${params.toString()}`);
    };

    const getGateTone = (status?: IMasterScript['gateStatus']) => {
        switch (status) {
            case 'passed':
                return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
            case 'failed':
                return 'bg-red-500/10 border-red-500/20 text-red-400';
            default:
                return 'bg-amber-500/10 border-amber-500/20 text-amber-300';
        }
    };

    return (
        <div className="admin-panel animate-in fade-in duration-500 text-zinc-300">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                        <Database className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Master Feed</h2>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Global RAG Authority</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-indigo-900/20 active:scale-95"
                >
                    {isAdding ? 'Cancel' : (
                        <><Plus size={16} /> Add Script</>
                    )}
                </button>
            </div>

            {isAdding ? (
                <div className="bg-[#0a0a0a] border border-zinc-800/60 p-5 rounded-2xl shadow-sm animate-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Script Title</label>
                                <input
                                    className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-zinc-600"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. Inception"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Director / Style</label>
                                <input
                                    className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-zinc-600"
                                    value={formData.director}
                                    onChange={e => setFormData({ ...formData, director: e.target.value })}
                                    placeholder="e.g. Christopher Nolan"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Language</label>
                                <input
                                    className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-zinc-600"
                                    value={formData.language}
                                    onChange={e => setFormData({ ...formData, language: e.target.value })}
                                    placeholder="e.g. Telugu, English, Hindi"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tags (Comma separated)</label>
                                <input
                                    className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-zinc-600"
                                    value={formData.tags}
                                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                    placeholder="Sci-Fi, Mind-Bending, Noir"
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Upload Script Document (PDF, DOCX, TXT, FOUNTAIN, SCRIPT)</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        id="script-file"
                                        className="hidden"
                                        accept=".pdf,.docx,.txt,.md,.fountain,.script"
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) setFormData({ ...formData, file, rawContent: '' });
                                        }}
                                    />
                                    <label
                                        htmlFor="script-file"
                                        className={`w-full flex items-center justify-between border ${formData.file ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-800/50'} rounded-xl px-4 py-3 cursor-pointer transition-all border-dashed`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <FileText size={18} className={formData.file ? 'text-indigo-400' : 'text-zinc-500'} />
                                            <span className={`text-sm font-medium ${formData.file ? 'text-indigo-200' : 'text-zinc-400'}`}>
                                                {formData.file ? formData.file.name : 'Choose a file or drag it here...'}
                                            </span>
                                        </div>
                                        {formData.file && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setFormData({ ...formData, file: null });
                                                }}
                                                className="p-1 rounded-md hover:bg-indigo-500/20 text-indigo-400 transition-colors"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </label>
                                </div>
                            </div>

                            {!formData.file && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-4 py-1">
                                        <div className="h-px bg-zinc-800 flex-1"></div>
                                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">OR PASTE TEXT</span>
                                        <div className="h-px bg-zinc-800 flex-1"></div>
                                    </div>
                                    <textarea
                                        className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-500/50 focus:ring-1 focus:ring-zinc-500/20 transition-all font-mono custom-scrollbar placeholder-zinc-600"
                                        rows={6}
                                        value={formData.rawContent}
                                        onChange={e => setFormData({ ...formData, rawContent: e.target.value })}
                                        placeholder="Paste script content here..."
                                        required={!formData.file}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-indigo-900/20 active:scale-[0.99] flex items-center justify-center gap-2">
                                <Database size={16} /> Ingest & Index Script
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                        <input
                            type="text"
                            placeholder="Search master scripts..."
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3.5 text-zinc-200 focus:border-blue-500 outline-none transition-all"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <RefreshCcw className="animate-spin text-blue-500" size={32} />
                            <span className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Syncing authority feed...</span>
                        </div>
                    ) : filteredScripts.length === 0 ? (
                        <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
                            <FileText size={48} className="mx-auto text-zinc-800 mb-4" />
                            <p className="text-zinc-500 font-bold">No master scripts found.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredScripts.map(script => (
                                <div key={script._id} className="group bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 p-5 rounded-2xl transition-all hover:bg-zinc-900/60 flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 group-hover:border-zinc-600 transition-colors">
                                            <FileText size={20} className="text-zinc-500 group-hover:text-blue-400 transitions-colors" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-white text-lg">{script.title}</h3>
                                                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-[10px] font-black uppercase text-zinc-500">
                                                    {getStatusIcon(script.status)}
                                                    {script.status}
                                                </span>
                                                {script.gateStatus && (
                                                    <span className={`px-2 py-0.5 border rounded text-[10px] font-black uppercase ${getGateTone(script.gateStatus)}`}>
                                                        Gate {script.gateStatus}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
                                                <span className="flex items-center gap-1"><User size={12} className="text-blue-500/50" /> {script.director}</span>
                                                <span className="flex items-center gap-1 text-blue-400 font-bold">{script.language || 'English'}</span>
                                                <span className="flex items-center gap-1"><Tag size={12} className="text-purple-500/50" /> {Array.isArray(script.tags) ? script.tags.join(', ') : ''}</span>
                                                <span className="flex items-center gap-1"><Clock size={12} className="text-zinc-700" /> {new Date(script.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                                {(script.processingScriptVersion || script.activeScriptVersion) && (
                                                    <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1">
                                                        Version {script.processingScriptVersion || script.activeScriptVersion}
                                                    </span>
                                                )}
                                                {script.parserVersion && (
                                                    <span className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-blue-300">
                                                        Parser {script.parserVersion}
                                                    </span>
                                                )}
                                                {script.processedChunks > 0 && (
                                                    <span className="flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-purple-300 group/tooltip relative">
                                                        <Database size={10} />
                                                        {script.processedChunks} Structured Elements
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] text-zinc-400 font-medium normal-case tracking-normal leading-tight shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-10">
                                                            High-granularity elements (dialogue, action, scenes) for precision RAG.
                                                        </div>
                                                    </span>
                                                )}
                                                {script.readerReady && (
                                                    <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                                                        Reader Ready
                                                    </span>
                                                )}
                                                {typeof script.ragReady === 'boolean' && (
                                                    <span className={`rounded-lg border px-2 py-1 ${script.ragReady
                                                        ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                                                        : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                                        }`}>
                                                        {script.ragReady ? 'RAG Ready' : 'RAG Pending'}
                                                    </span>
                                                )}
                                            </div>
                                            {script.lastValidationSummary && (
                                                <p className="mt-2 max-w-2xl text-xs text-zinc-400">
                                                    {script.lastValidationSummary}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {script.status !== 'processing' && script.status !== 'validating' && (
                                            <button
                                                onClick={() => handleProcess(script._id)}
                                                className="px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold transition-all"
                                            >
                                                {script.activeScriptVersion ? 'Reprocess' : 'Start Processing'}
                                            </button>
                                        )}
                                        {(script.status === 'processing' || script.status === 'validating') && (
                                            <div className="flex flex-col items-end gap-1.5 w-48">
                                                <div className={`flex items-center justify-between w-full text-[10px] font-black tracking-widest ${script.status === 'validating' ? 'text-amber-300' : 'text-blue-400'}`}>
                                                    <span>{script.status === 'validating' ? 'VALIDATING' : 'PROCESSING'}</span>
                                                    <span>{script.progress || 0}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                                                    <div
                                                        className={`h-full transition-all duration-500 ease-out ${script.status === 'validating' ? 'bg-amber-400' : 'bg-blue-500'}`}
                                                        style={{ width: `${script.progress || 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {script.readerReady && (
                                            <button
                                                onClick={() => openReader(script)}
                                                className="group/btn flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-xl text-xs font-black tracking-widest transition-all"
                                            >
                                                <Eye size={14} />
                                                OPEN READER
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(script._id, script.title)}
                                            disabled={isDeleting === script._id}
                                            className={`p-2 transition-colors ${isDeleting === script._id
                                                ? 'text-red-500/50 cursor-not-allowed'
                                                : 'text-zinc-600 hover:text-red-400'
                                                }`}
                                            title="Delete Script & Vector Data"
                                        >
                                            <Trash2 size={20} className={isDeleting === script._id ? 'animate-pulse' : ''} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
