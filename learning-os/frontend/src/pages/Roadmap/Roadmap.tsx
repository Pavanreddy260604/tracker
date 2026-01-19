import { useState, useCallback, useEffect, memo, useRef } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Handle,
    Position,
    type Connection,
    type Edge,
    type Node,
    type NodeProps,
    BackgroundVariant,
    Panel,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../../services/api';
import {
    Plus, Save, CheckCircle2, Clock, Circle, Trash2, X,
    Code2, Server, Database, Globe, Lightbulb,
    Layers, Cpu, Shield, Zap, FileCode, Terminal, Wrench,
    Pencil, Search, Link, Timer, Flag, Download, Upload,
    ChevronDown, ExternalLink
} from 'lucide-react';

// Professional category icons
const CATEGORY_ICONS = {
    general: { icon: Lightbulb, label: 'General', color: 'text-gray-400' },
    dsa: { icon: Code2, label: 'DSA', color: 'text-blue-400' },
    backend: { icon: Server, label: 'Backend', color: 'text-purple-400' },
    database: { icon: Database, label: 'Database', color: 'text-green-400' },
    frontend: { icon: Globe, label: 'Frontend', color: 'text-cyan-400' },
    devops: { icon: Layers, label: 'DevOps', color: 'text-orange-400' },
    system: { icon: Cpu, label: 'System Design', color: 'text-pink-400' },
    security: { icon: Shield, label: 'Security', color: 'text-red-400' },
    api: { icon: Zap, label: 'API', color: 'text-yellow-400' },
    language: { icon: FileCode, label: 'Language', color: 'text-indigo-400' },
    tools: { icon: Wrench, label: 'Tools', color: 'text-teal-400' },
    terminal: { icon: Terminal, label: 'CLI', color: 'text-lime-400' },
};

const PRIORITY_CONFIG = {
    low: { label: 'Low', color: 'text-gray-400', bg: 'bg-gray-500/20' },
    medium: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    high: { label: 'High', color: 'text-red-400', bg: 'bg-red-500/20' },
};

type CategoryType = keyof typeof CATEGORY_ICONS;
type PriorityType = keyof typeof PRIORITY_CONFIG;

interface RoadmapNodeData extends Record<string, unknown> {
    label: string;
    status: 'todo' | 'in-progress' | 'done';
    category: CategoryType;
    description?: string;
    priority?: PriorityType;
    estimatedHours?: number;
    resourceUrl?: string;
}

// Professional Node Component
const RoadmapNode = memo(({ data, selected }: NodeProps<Node<RoadmapNodeData>>) => {
    const nodeData = data as RoadmapNodeData;
    const category = CATEGORY_ICONS[nodeData.category] || CATEGORY_ICONS.general;
    const CategoryIcon = category.icon;
    const priority = nodeData.priority ? PRIORITY_CONFIG[nodeData.priority] : null;

    const statusStyles = {
        'todo': 'border-gray-300 dark:border-white/10',
        'in-progress': 'border-blue-400 dark:border-blue-500/50',
        'done': 'border-green-400 dark:border-green-500/50'
    };

    return (
        <div className={`
            bg-white dark:bg-[#1c2128] rounded-xl border-2 ${statusStyles[nodeData.status]}
            shadow-sm hover:shadow-md transition-all min-w-[180px] max-w-[240px]
            ${selected ? 'ring-2 ring-blue-500/50 shadow-lg' : ''}
        `}>
            <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400 dark:!bg-gray-500 !border-0 !-top-1" />
            <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400 dark:!bg-gray-500 !border-0 !-bottom-1" />

            <div className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                    <div className={`mt-0.5 ${category.color}`}>
                        <CategoryIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{nodeData.label}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-gray-500 capitalize">{nodeData.status.replace('-', ' ')}</span>
                            {nodeData.estimatedHours && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                    <Timer size={8} /> {nodeData.estimatedHours}h
                                </span>
                            )}
                            {priority && (
                                <span className={`text-[9px] px-1 py-0.5 rounded ${priority.bg} ${priority.color}`}>
                                    {priority.label}
                                </span>
                            )}
                            {nodeData.resourceUrl && (
                                <Link size={10} className="text-blue-400" />
                            )}
                        </div>
                    </div>
                </div>
                {nodeData.description && (
                    <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2 pl-6">{nodeData.description}</p>
                )}
            </div>
        </div>
    );
});

RoadmapNode.displayName = 'RoadmapNode';
const nodeTypes = { roadmap: RoadmapNode };

export function Roadmap() {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<RoadmapNodeData>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node } | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<CategoryType | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'todo' | 'in-progress' | 'done'>('all');

    // Load roadmap
    useEffect(() => {
        const loadRoadmap = async () => {
            try {
                const data = await api.getRoadmap();
                if (data.nodes?.length > 0) {
                    setNodes(data.nodes.map((n: any) => ({
                        id: n.nodeId, type: 'roadmap', position: n.position,
                        data: {
                            label: n.data.label || 'Unnamed',
                            status: n.data.status || 'todo',
                            category: n.data.category || 'general',
                            description: n.data.description || '',
                            priority: n.data.priority || 'medium',
                            estimatedHours: n.data.estimatedHours || 0,
                            resourceUrl: n.data.resourceUrl || '',
                        },
                    })));
                    setEdges(data.edges.map((e: any) => ({
                        id: e.edgeId, source: e.source, target: e.target,
                        type: 'smoothstep', style: { stroke: '#6b7280', strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
                    })));
                }
            } catch (error) { console.error('Failed to load roadmap', error); }
        };
        loadRoadmap();
    }, [setNodes, setEdges]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                onSave();
            }
            // Escape to close modal
            if (e.key === 'Escape') {
                setShowModal(false);
                setContextMenu(null);
            }
            // Delete to remove selected node
            if (e.key === 'Delete' && selectedNode && !showModal) {
                deleteNode(selectedNode.id);
            }
            // Ctrl+F to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('roadmap-search')?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNode, showModal]);

    // Auto-save with debounce
    useEffect(() => {
        if (hasUnsavedChanges && nodes.length > 0) {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = setTimeout(async () => {
                try {
                    await api.syncRoadmap(nodes.map(n => ({ ...n, nodeId: n.id })), edges);
                    setHasUnsavedChanges(false);
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 1500);
                } catch (e) { console.error('Auto-save failed', e); }
            }, 2000);
        }
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    }, [nodes, edges, hasUnsavedChanges]);

    // Filter nodes based on search and filters
    const filteredNodes = nodes.map(node => {
        const data = node.data as RoadmapNodeData;
        const matchesSearch = !searchQuery ||
            data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (data.description?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = filterCategory === 'all' || data.category === filterCategory;
        const matchesStatus = filterStatus === 'all' || data.status === filterStatus;

        return {
            ...node,
            hidden: !(matchesSearch && matchesCategory && matchesStatus)
        };
    });

    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge({
            ...params, type: 'smoothstep', style: { stroke: '#6b7280', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
        }, eds));
        setHasUnsavedChanges(true);
    }, [setEdges]);

    const handleNodesChange = useCallback((changes: any) => {
        onNodesChange(changes);
        if (changes.some((c: any) => c.type === 'position' && c.dragging === false)) {
            setHasUnsavedChanges(true);
        }
    }, [onNodesChange]);

    const onSave = async () => {
        setIsSaving(true);
        try {
            await api.syncRoadmap(nodes.map(n => ({ ...n, nodeId: n.id })), edges);
            setSaveSuccess(true);
            setHasUnsavedChanges(false);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) { console.error('Failed to save roadmap', error); }
        finally { setIsSaving(false); }
    };

    const addNode = (category: CategoryType = 'general') => {
        setNodes((nds) => nds.concat({
            id: `node_${Date.now()}`, type: 'roadmap',
            position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
            data: { label: 'New Topic', status: 'todo', category, description: '', priority: 'medium', estimatedHours: 0, resourceUrl: '' },
        }));
        setHasUnsavedChanges(true);
    };

    const onNodeClick = (_: any, node: Node) => { setSelectedNode(node); setShowModal(true); };

    const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, node });
    }, []);

    const updateNodeData = (updates: Partial<RoadmapNodeData>) => {
        if (!selectedNode) return;
        setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, ...updates } as RoadmapNodeData } : n));
        setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ...updates } });
        setHasUnsavedChanges(true);
    };

    const cycleStatus = (node: Node) => {
        const statuses: Array<'todo' | 'in-progress' | 'done'> = ['todo', 'in-progress', 'done'];
        const currentData = node.data as RoadmapNodeData;
        const nextIndex = (statuses.indexOf(currentData.status) + 1) % statuses.length;
        setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, status: statuses[nextIndex] } } : n));
        setHasUnsavedChanges(true);
    };

    const deleteNode = (nodeId?: string) => {
        const id = nodeId || selectedNode?.id;
        if (!id) return;
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        setShowModal(false); setSelectedNode(null); setContextMenu(null);
        setHasUnsavedChanges(true);
    };

    // Export roadmap as JSON
    const exportRoadmap = () => {
        const data = { nodes: nodes.map(n => ({ ...n, nodeId: n.id })), edges };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'roadmap.json'; a.click();
        URL.revokeObjectURL(url);
    };

    // Import roadmap from JSON
    const importRoadmap = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data.nodes) {
                    setNodes(data.nodes.map((n: any) => ({
                        id: n.nodeId || n.id, type: 'roadmap', position: n.position,
                        data: { ...n.data, category: n.data.category || 'general' },
                    })));
                }
                if (data.edges) {
                    setEdges(data.edges.map((e: any) => ({
                        ...e, type: 'smoothstep', style: { stroke: '#6b7280', strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
                    })));
                }
                setHasUnsavedChanges(true);
            } catch (err) { console.error('Failed to import', err); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Calculate progress stats
    const stats = {
        total: nodes.length,
        done: nodes.filter(n => (n.data as RoadmapNodeData).status === 'done').length,
        inProgress: nodes.filter(n => (n.data as RoadmapNodeData).status === 'in-progress').length,
        totalHours: nodes.reduce((sum, n) => sum + ((n.data as RoadmapNodeData).estimatedHours || 0), 0),
        completedHours: nodes.filter(n => (n.data as RoadmapNodeData).status === 'done').reduce((sum, n) => sum + ((n.data as RoadmapNodeData).estimatedHours || 0), 0),
    };
    const progressPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

    return (
        <div className="h-[calc(100vh-80px)] w-full rounded-2xl overflow-hidden bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10" onClick={() => setContextMenu(null)}>
            <ReactFlow
                nodes={filteredNodes} edges={edges} onNodesChange={handleNodesChange} onEdgesChange={onEdgesChange}
                onConnect={onConnect} onNodeClick={onNodeClick} onNodeContextMenu={onNodeContextMenu}
                nodeTypes={nodeTypes} fitView snapToGrid snapGrid={[15, 15]}
                defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#6b7280', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' } }}
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-gray-50 dark:!bg-[#0d1117]" color="#d1d5db" />
                <Controls className="!bg-white dark:!bg-[#1c2128] !border-gray-200 dark:!border-white/10 !rounded-xl [&>button]:!bg-white dark:[&>button]:!bg-[#1c2128] [&>button]:!border-gray-200 dark:[&>button]:!border-white/10" />
                <MiniMap
                    nodeColor={(n) => {
                        const data = n.data as RoadmapNodeData;
                        if (data.status === 'done') return '#22c55e';
                        if (data.status === 'in-progress') return '#3b82f6';
                        return '#6b7280';
                    }}
                    maskColor="rgba(0,0,0,0.6)"
                    className="!bg-white dark:!bg-[#1c2128] !border-gray-200 dark:!border-white/10 !rounded-xl"
                />

                {/* Top Bar - Single row without overlap */}
                <Panel position="top-center">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
                        {/* Search */}
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                id="roadmap-search"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-32 pl-8 pr-2 py-1.5 text-xs bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-blue-500"
                            />
                        </div>

                        {/* Inline Filters */}
                        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)}
                            className="text-xs bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 outline-none">
                            <option value="all">All Categories</option>
                            {Object.entries(CATEGORY_ICONS).map(([key, { label }]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="text-xs bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 outline-none">
                            <option value="all">All Status</option>
                            <option value="todo">Todo</option>
                            <option value="in-progress">In Progress</option>
                            <option value="done">Done</option>
                        </select>

                        <div className="w-px h-4 bg-gray-200 dark:bg-white/10" />

                        {/* Add */}
                        <div className="relative group">
                            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10">
                                <Plus size={12} /> Add <ChevronDown size={10} />
                            </button>
                            <div className="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1 max-h-52 overflow-y-auto">
                                {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, label, color }]) => (
                                    <button key={key} onClick={() => addNode(key as CategoryType)}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
                                        <Icon size={12} className={color} /> {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Import/Export */}
                        <button onClick={exportRoadmap} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Export JSON">
                            <Download size={14} />
                        </button>
                        <label className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer" title="Import JSON">
                            <Upload size={14} />
                            <input type="file" accept=".json" onChange={importRoadmap} className="hidden" />
                        </label>

                        <div className="w-px h-4 bg-gray-200 dark:bg-white/10" />

                        {/* Save */}
                        <button onClick={onSave} disabled={isSaving} className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${saveSuccess ? 'bg-green-500 text-white' : hasUnsavedChanges ? 'bg-blue-600 text-white' : 'bg-gray-900 dark:bg-gray-700 text-white'
                            }`}>
                            {saveSuccess ? <CheckCircle2 size={12} /> : isSaving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
                            {hasUnsavedChanges ? 'Save*' : 'Saved'}
                        </button>
                    </div>
                </Panel>

                {/* Progress Stats - Top Right to avoid overlap */}
                <Panel position="top-right">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-xl">
                        <span className="text-xs text-gray-500">Progress:</span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{progressPercent}%</span>
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 transition-all" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400">{stats.done}/{stats.total}</span>
                        {stats.totalHours > 0 && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <Timer size={9} /> {stats.completedHours}/{stats.totalHours}h
                            </span>
                        )}
                    </div>
                </Panel>

                {/* Legend - Bottom Left */}
                <Panel position="bottom-left">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-xl text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><Circle size={8} className="text-gray-400" /> Todo</span>
                        <span className="flex items-center gap-1"><Clock size={8} className="text-blue-400" /> Progress</span>
                        <span className="flex items-center gap-1"><CheckCircle2 size={8} className="text-green-400" /> Done</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-400">Ctrl+S save • Del remove • Right-click menu</span>
                    </div>
                </Panel>

                {nodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center p-6 bg-white dark:bg-[#1c2128] rounded-2xl border border-dashed border-gray-300 dark:border-white/20 pointer-events-auto">
                            <Plus size={24} className="text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">No topics yet</p>
                            <p className="text-gray-500 text-xs mt-1">Click "Add" to start building your roadmap</p>
                        </div>
                    </div>
                )}
            </ReactFlow>

            {/* Context Menu */}
            {contextMenu && (
                <div className="fixed bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl py-1 z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
                    <button onClick={() => { setSelectedNode(contextMenu.node); setShowModal(true); setContextMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
                        <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => { cycleStatus(contextMenu.node); setContextMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
                        <CheckCircle2 size={12} /> Cycle Status
                    </button>
                    {(contextMenu.node.data as RoadmapNodeData).resourceUrl && (
                        <a href={(contextMenu.node.data as RoadmapNodeData).resourceUrl} target="_blank" rel="noopener noreferrer"
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                            <ExternalLink size={12} /> Open Link
                        </a>
                    )}
                    <button onClick={() => deleteNode(contextMenu.node.id)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                        <Trash2 size={12} /> Delete
                    </button>
                </div>
            )}

            {/* Edit Modal */}
            {showModal && selectedNode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 dark:bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                    <div className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Topic</h2>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X size={18} /></button>
                        </div>

                        <div className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5 block">Topic Name</label>
                                <input type="text" value={(selectedNode.data as RoadmapNodeData).label}
                                    onChange={(e) => updateNodeData({ label: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5 block">Description</label>
                                <textarea value={(selectedNode.data as RoadmapNodeData).description || ''} rows={2}
                                    onChange={(e) => updateNodeData({ description: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none resize-none"
                                    placeholder="Notes about this topic..." />
                            </div>

                            {/* Resource URL */}
                            <div>
                                <label className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5 block flex items-center gap-1">
                                    <Link size={10} /> Resource Link
                                </label>
                                <input type="url" value={(selectedNode.data as RoadmapNodeData).resourceUrl || ''}
                                    onChange={(e) => updateNodeData({ resourceUrl: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none"
                                    placeholder="https://..." />
                            </div>

                            {/* Time & Priority Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5 block flex items-center gap-1">
                                        <Timer size={10} /> Est. Hours
                                    </label>
                                    <input type="number" min="0" step="0.5" value={(selectedNode.data as RoadmapNodeData).estimatedHours || ''}
                                        onChange={(e) => updateNodeData({ estimatedHours: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5 block flex items-center gap-1">
                                        <Flag size={10} /> Priority
                                    </label>
                                    <div className="flex gap-1">
                                        {(['low', 'medium', 'high'] as const).map((p) => (
                                            <button key={p} onClick={() => updateNodeData({ priority: p })}
                                                className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${(selectedNode.data as RoadmapNodeData).priority === p
                                                    ? `${PRIORITY_CONFIG[p].bg} ${PRIORITY_CONFIG[p].color} border-current`
                                                    : 'bg-gray-100 dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'
                                                    }`}>
                                                {p.charAt(0).toUpperCase() + p.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5 block">Category</label>
                                <div className="grid grid-cols-6 gap-1">
                                    {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, label, color }]) => (
                                        <button key={key} onClick={() => updateNodeData({ category: key as CategoryType })}
                                            title={label}
                                            className={`flex items-center justify-center py-2 rounded-lg border transition-colors ${(selectedNode.data as RoadmapNodeData).category === key
                                                ? 'bg-white/10 border-blue-500/50 ring-1 ring-blue-500/30'
                                                : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'
                                                }`}>
                                            <Icon size={14} className={color} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5 block">Status</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['todo', 'in-progress', 'done'] as const).map((s) => (
                                        <button key={s} onClick={() => updateNodeData({ status: s })}
                                            className={`py-2 text-xs font-medium rounded-xl border transition-colors ${(selectedNode.data as RoadmapNodeData).status === s
                                                ? 'bg-gray-900 dark:bg-gray-700 text-white border-transparent'
                                                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10'
                                                }`}>
                                            {s === 'todo' ? 'Todo' : s === 'in-progress' ? 'In Progress' : 'Done'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-200 dark:border-white/10">
                            <button onClick={() => deleteNode()} className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1.5">
                                <Trash2 size={14} /> Delete
                            </button>
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium rounded-xl">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
