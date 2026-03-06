import { useState, useEffect } from 'react';
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
    ChevronRight,
    Search
} from 'lucide-react';
import { scriptWriterApi, type IMasterScript } from '../../../services/scriptWriter.api';

export function AdminPanel() {
    const [scripts, setScripts] = useState<IMasterScript[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        director: '',
        language: 'English',
        tags: '',
        rawContent: '',
        file: null as File | null
    });

    const fetchScripts = async () => {
        try {
            setLoading(true);
            const data = await scriptWriterApi.getMasterScripts();
            setScripts(data);
        } catch (err) {
            console.error('Failed to fetch master scripts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScripts();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await scriptWriterApi.createMasterScript({
                ...formData,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                file: formData.file || undefined
            });
            setIsAdding(false);
            setFormData({ title: '', director: '', language: 'English', tags: '', rawContent: '', file: null });
            fetchScripts();
        } catch (err) {
            alert('Failed to create script');
        }
    };

    const handleProcess = async (id: string) => {
        try {
            await scriptWriterApi.processMasterScript(id);
            fetchScripts();
        } catch (err) {
            alert('Processing failed');
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
            case 'failed': return <AlertCircle size={14} className="text-red-500" />;
            default: return <Clock size={14} className="text-zinc-500" />;
        }
    };

    return (
        <div className="admin-panel animate-in fade-in duration-500">
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
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Upload Script Document (PDF, DOCX, TXT)</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        id="script-file"
                                        className="hidden"
                                        accept=".pdf,.docx,.txt,.md"
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
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
                                                <span className="flex items-center gap-1"><User size={12} className="text-blue-500/50" /> {script.director}</span>
                                                <span className="flex items-center gap-1 text-blue-400 font-bold">{script.language || 'English'}</span>
                                                <span className="flex items-center gap-1"><Tag size={12} className="text-purple-500/50" /> {script.tags.join(', ')}</span>
                                                <span className="flex items-center gap-1"><Clock size={12} className="text-zinc-700" /> {new Date(script.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {script.status !== 'indexed' && script.status !== 'processing' && (
                                            <button
                                                onClick={() => handleProcess(script._id)}
                                                className="px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold transition-all"
                                            >
                                                Start Processing
                                            </button>
                                        )}
                                        {script.status === 'indexed' && (
                                            <div className="text-xs font-black text-emerald-500 tracking-widest px-4">
                                                {script.processedChunks} CHUNKS INDEXED
                                            </div>
                                        )}
                                        <button className="p-2 text-zinc-600 hover:text-white transition-colors">
                                            <ChevronRight size={20} />
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
