import { useState, useCallback, useEffect, memo, useRef, useMemo } from 'react';
import dagre from 'dagre';
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
    useReactFlow,
    ReactFlowProvider,
    SelectionMode,
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
import { toast } from '../../stores/toastStore';
import { useMobile } from '../../hooks/useMobile';
import { useThemeStore } from '../../stores/themeStore';
import {
    Plus, Save, CheckCircle2, Trash2, X, Circle, Clock,
    Filter, Code2, Server, Database, Globe, Lightbulb,
    Layers, Cpu, Shield, Zap, FileCode, Terminal, Wrench,
    Pencil, Search, Link, Timer, Flag, Download, Upload,
    ExternalLink, Wand2, MousePointer2, Hand
} from 'lucide-react';

// Professional category icons
const CATEGORY_ICONS = {
    general: { icon: Lightbulb, label: 'General', color: 'text-text-disabled' },
    dsa: { icon: Code2, label: 'DSA', color: 'text-accent-primary' },
    backend: { icon: Server, label: 'Backend', color: 'text-accent-secondary' },
    database: { icon: Database, label: 'Database', color: 'text-status-ok' },
    frontend: { icon: Globe, label: 'Frontend', color: 'text-accent-primary' },
    devops: { icon: Layers, label: 'DevOps', color: 'text-status-warning' },
    system: { icon: Cpu, label: 'System Design', color: 'text-accent-primary' },
    security: { icon: Shield, label: 'Security', color: 'text-status-error' },
    api: { icon: Zap, label: 'API', color: 'text-status-warning' },
    language: { icon: FileCode, label: 'Language', color: 'text-accent-primary' },
    tools: { icon: Wrench, label: 'Tools', color: 'text-status-ok' },
    terminal: { icon: Terminal, label: 'CLI', color: 'text-status-ok' },
};

const PRIORITY_CONFIG = {
    low: { label: 'Low', color: 'text-text-disabled', bg: 'bg-console-surface-2' },
    medium: { label: 'Medium', color: 'text-status-warning', bg: 'bg-status-warning/10' },
    high: { label: 'High', color: 'text-status-error', bg: 'bg-status-error/10' },
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
        'todo': 'border-border-subtle',
        'in-progress': 'border-accent-primary/50',
        'done': 'border-status-ok/50'
    };

    return (
        <div className={`
            rounded-xl border-2 ${statusStyles[nodeData.status]}
            bg-console-surface/60 backdrop-blur-xl shadow-premium transition-all min-w-[180px] max-w-[240px]
            relative overflow-visible hover:border-accent-primary/50
            ${selected ? 'ring-2 ring-accent-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]' : ''}
        `}>
            {/* Optimized handles for visibility and connection */}
            <Handle
                type="target"
                position={Position.Top}
                className="!w-3 !h-3 !bg-accent-primary !border-2 !border-white dark:!border-console-surface !-top-1.5 hover:!scale-125 transition-transform"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-3 !h-3 !bg-accent-primary !border-2 !border-white dark:!border-console-surface !-bottom-1.5 hover:!scale-125 transition-transform"
            />

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
                    <p className="text-[11px] text-text-secondary mt-1.5 line-clamp-2 pl-6">{nodeData.description}</p>
                )}
            </div>
        </div>
    );
});

RoadmapNode.displayName = 'RoadmapNode';
const nodeTypes = { roadmap: RoadmapNode };

function RoadmapContent() {
    const { isMobile } = useMobile();
    const { theme } = useThemeStore();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<RoadmapNodeData>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node } | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<CategoryType | 'all'>('all');
    const [filterStatus] = useState<'all' | 'todo' | 'in-progress' | 'done'>('all');
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'node' | 'edge'; id: string } | null>(null);
    const [roadmapTool, setRoadmapTool] = useState<'pan' | 'select'>('pan');

    const { fitView, screenToFlowPosition } = useReactFlow();

    // Close menus when clicking anywhere on canvas
    const closeMenus = useCallback(() => {
        setShowAddMenu(false);
        setShowFilterMenu(false);
        setContextMenu(null);
    }, []);

    // Load roadmap
    useEffect(() => {
        const loadRoadmap = async () => {
            try {
                const response = await api.getRoadmap();
                const data = response;
                if (data.nodes?.length > 0) {
                    setNodes(data.nodes.map((n: any) => ({
                        id: n.nodeId,
                        type: 'roadmap',
                        position: n.position,
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
                        id: e.edgeId,
                        source: e.source,
                        target: e.target,
                        type: 'smoothstep',
                        style: { stroke: '#6b7280', strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
                    })));
                }
                setTimeout(() => fitView({ duration: 800 }), 100);
            } catch (err) {
                console.error('Failed to load roadmap', err);
                toast.error('Failed to load roadmap. Please refresh.');
            }
        };
        loadRoadmap();
    }, [setNodes, setEdges, fitView]);

    // Refs for stable access in event listeners
    const nodesRef = useRef(nodes);
    const selectedNodeRef = useRef(selectedNode);
    nodesRef.current = nodes;
    selectedNodeRef.current = selectedNode;

    const deleteNode = useCallback((nodeId?: string) => {
        const id = nodeId || selectedNodeRef.current?.id || confirmDelete?.id;
        if (!id) return;
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        setShowModal(false);
        setSelectedNode(null);
        setContextMenu(null);
        setConfirmDelete(null);
        setHasUnsavedChanges(true);
    }, [confirmDelete, setNodes, setEdges]);

    // Keyboard shortcuts - use ref-based listener to avoid re-binding during drags
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
            if (e.key === 'Delete' && selectedNodeRef.current && !showModal) {
                deleteNode(selectedNodeRef.current.id);
            }
            // Ctrl+F to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('roadmap-search')?.focus();
            }
            // Arrow Keys for navigation
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !showModal) {
                e.preventDefault();
                navigateNodes(e.key.replace('Arrow', '').toLowerCase() as any);
            }
            // Enter to edit
            if (e.key === 'Enter' && selectedNodeRef.current && !showModal) {
                setShowModal(true);
            }
            // Tool Shortcuts
            if (!showModal && !e.ctrlKey && !e.metaKey) {
                if (e.key.toLowerCase() === 'v') setRoadmapTool('pan');
                if (e.key.toLowerCase() === 's') setRoadmapTool('select');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal]); // Only re-bind when modal state changes

    // Auto-save with debounce
    useEffect(() => {
        if (hasUnsavedChanges) {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = setTimeout(async () => {
                try {
                    await api.syncRoadmap(nodes.map(n => ({ ...n, nodeId: n.id })), edges);
                    setHasUnsavedChanges(false);
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 1500);
                } catch (e) { 
                    console.error('Auto-save failed', e);
                    toast.error('Auto-save failed');
                }
            }, 2000);
        }
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    }, [nodes, edges, hasUnsavedChanges]);

    // Filter nodes based on search and filters
    const filteredNodes = useMemo(() => {
        return nodes.map(node => {
            const data = node.data as RoadmapNodeData;
            const matchesSearch = !searchQuery ||
                (data.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                ((data.description || '').toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCategory = filterCategory === 'all' || data.category === filterCategory;
            const matchesStatus = filterStatus === 'all' || data.status === filterStatus;

            return {
                ...node,
                hidden: !(matchesSearch && matchesCategory && matchesStatus)
            };
        });
    }, [nodes, searchQuery, filterCategory, filterStatus]);

    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge({
            ...params, type: 'smoothstep', style: { stroke: '#6b7280', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
        }, eds));
        setHasUnsavedChanges(true);
    }, [setEdges]);

    const handleEdgesChange = useCallback((changes: any) => {
        onEdgesChange(changes);
        if (changes.some((c: any) => c.type === 'remove')) {
            setHasUnsavedChanges(true);
        }
    }, [onEdgesChange]);

    const handleNodesChange = useCallback((changes: any) => {
        onNodesChange(changes);
        if (changes.some((c: any) => (c.type === 'position' && c.dragging === false) || c.type === 'remove')) {
            setHasUnsavedChanges(true);
        }
    }, [onNodesChange]);

    const onSave = async () => {
        setIsSaving(true);
        try {
            await api.syncRoadmap(nodes.map(n => ({ ...n, nodeId: n.id })), edges);
            setSaveSuccess(true);
            setHasUnsavedChanges(false);
            toast.success('Roadmap saved successfully');
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) { 
            console.error('Failed to save roadmap', error);
            toast.error('Failed to save roadmap');
        }
        finally { setIsSaving(false); }
    };

    const addNode = useCallback((category: CategoryType = 'general') => {
        let position = { x: 100, y: 100 };

        try {
            if (selectedNodeRef.current) {
                // Place below selected node
                position = {
                    x: selectedNodeRef.current.position.x,
                    y: selectedNodeRef.current.position.y + 160
                };
            } else {
                // Place in center of screen
                const cx = window.innerWidth / 2;
                const cy = window.innerHeight / 2;
                position = screenToFlowPosition({ x: cx, y: cy });
                
                // Adjust for node size (roughly 220x120)
                position.x -= 110;
                position.y -= 60;
            }
        } catch (e) {
            console.warn('Failed to calculate intelligent position, using fallback', e);
        }

        // Add subtle jitter to prevent stacking
        position.x += (Math.random() - 0.5) * 40;
        position.y += (Math.random() - 0.5) * 40;

        const newNode: Node<RoadmapNodeData> = {
            id: `node-${Date.now()}`,
            type: 'roadmap',
            position,
            data: { label: 'New Topic', status: 'todo', category, description: '', priority: 'medium', estimatedHours: 0, resourceUrl: '' },
        };

        setNodes((nds) => [...nds, newNode]);
        setHasUnsavedChanges(true);
        setSearchQuery(''); // CRITICAL: Clear search so the new node is visible
        setFilterCategory('all');
        
        // Ensure the menu closes
        setShowAddMenu(false);
        setShowFilterMenu(false);

        
        // Select the new node for immediate editing
        setSelectedNode(newNode);
        setSelectedNodes([newNode]);
        setShowModal(true);
        
        toast.success(`New ${category} topic added!`);
    }, [setNodes, screenToFlowPosition]);

    const onNodeClick = useCallback((_: any, node: Node) => {
        setSelectedNode(node);
    }, []);

    const navigateNodes = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
        const currentNodes = nodesRef.current;
        if (currentNodes.length === 0) return;
        const current = selectedNodeRef.current || currentNodes[0];
        const currentPos = current.position;

        let bestNode = null;
        let minDistance = Infinity;

        currentNodes.forEach(node => {
            if (node.id === current.id || node.hidden) return;
            const nodePos = node.position;
            const dx = nodePos.x - currentPos.x;
            const dy = nodePos.y - currentPos.y;

            let isMatch = false;
            switch (direction) {
                case 'up': isMatch = dy < -20; break;
                case 'down': isMatch = dy > 20; break;
                case 'left': isMatch = dx < -20; break;
                case 'right': isMatch = dx > 20; break;
            }

            if (isMatch) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestNode = node;
                }
            }
        });

        if (bestNode) {
            setSelectedNode(bestNode);
            setSelectedNodes([bestNode]);
        }
    }, [setSelectedNodes]);

    // Dagre Auto-Layout Logic
    const onLayout = useCallback(() => {
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));

        // Set up the graph layout parameters
        dagreGraph.setGraph({
            rankdir: 'TB', // Top to Bottom
            nodesep: 50,
            ranksep: 100,
            marginx: 50,
            marginy: 50
        });

        nodes.forEach((node) => {
            dagreGraph.setNode(node.id, { width: 220, height: 120 });
        });

        edges.forEach((edge) => {
            dagreGraph.setEdge(edge.source, edge.target);
        });

        dagre.layout(dagreGraph);

        const newNodes = nodes.map((node) => {
            const nodeWithPosition = dagreGraph.node(node.id);
            return {
                ...node,
                position: {
                    x: nodeWithPosition.x - 110,
                    y: nodeWithPosition.y - 60,
                },
            };
        });

        setNodes(newNodes);
        setHasUnsavedChanges(true);
        // Fit view after a small timeout to allow ReactFlow to update
        setTimeout(() => fitView({ duration: 800 }), 100);
    }, [nodes, edges, setNodes, fitView]);

    const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[]; edges: Edge[] }) => {
        setSelectedNodes(selectedNodes);
        if (selectedNodes.length === 1) {
            setSelectedNode(selectedNodes[0]);
        } else if (selectedNodes.length === 0) {
            setSelectedNode(null);
        }
    }, []);

    const bulkUpdateStatus = useCallback((status: 'todo' | 'in-progress' | 'done') => {
        if (selectedNodes.length === 0) return;
        setNodes((nds) => nds.map((n) =>
            selectedNodes.some(sn => sn.id === n.id)
                ? { ...n, data: { ...n.data, status } }
                : n
        ));
        setHasUnsavedChanges(true);
    }, [selectedNodes, setNodes]);

    const bulkDelete = useCallback(() => {
        if (selectedNodes.length === 0) return;
        setConfirmDelete({ type: 'node', id: 'bulk' });
    }, [selectedNodes]);

    const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, node });
    }, []);

    const updateNodeData = useCallback((updates: Partial<RoadmapNodeData>) => {
        if (!selectedNode) return;
        setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, ...updates } as RoadmapNodeData } : n));
        setSelectedNode((prev) => prev ? ({ ...prev, data: { ...prev.data, ...updates } }) : null);
        setHasUnsavedChanges(true);
    }, [selectedNode, setNodes]);

    const cycleStatus = useCallback((node: Node) => {
        const statuses: Array<'todo' | 'in-progress' | 'done'> = ['todo', 'in-progress', 'done'];
        const currentData = node.data as RoadmapNodeData;
        const nextIndex = (statuses.indexOf(currentData.status) + 1) % statuses.length;
        setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, status: statuses[nextIndex] } } : n));
        setHasUnsavedChanges(true);
    }, [setNodes]);

    const deleteEdge = useCallback((edgeId?: string) => {
        const id = edgeId || confirmDelete?.id;
        if (!id) return;
        setEdges((eds) => eds.filter((e) => e.id !== id));
        setConfirmDelete(null);
        setHasUnsavedChanges(true);
    }, [confirmDelete, setEdges]);

    const onEdgeClick = useCallback((_: any, edge: Edge) => {
        setConfirmDelete({ type: 'edge', id: edge.id });
    }, []);

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

    // Calculate progress stats - Memoized for performance
    const stats = useMemo(() => ({
        total: nodes.length,
        done: nodes.filter(n => (n.data as RoadmapNodeData).status === 'done').length,
        inProgress: nodes.filter(n => (n.data as RoadmapNodeData).status === 'in-progress').length,
        totalHours: nodes.reduce((sum, n) => sum + ((n.data as RoadmapNodeData).estimatedHours || 0), 0),
        completedHours: nodes.filter(n => (n.data as RoadmapNodeData).status === 'done').reduce((sum, n) => sum + ((n.data as RoadmapNodeData).estimatedHours || 0), 0),
    }), [nodes]);

    const progressPercent = useMemo(() =>
        stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
        , [stats]);

    return (
        <div
            className="h-[calc(100dvh-140px)] sm:h-[calc(100dvh-100px)] w-full sm:rounded-2xl overflow-hidden bg-console-bg block sm:border border-border-subtle relative"
        >
            <ReactFlow
                nodes={filteredNodes} edges={edges} onNodesChange={handleNodesChange} onEdgesChange={handleEdgesChange}
                onConnect={onConnect} onNodeClick={onNodeClick} onNodeContextMenu={onNodeContextMenu}
                onEdgeClick={onEdgeClick}
                onSelectionChange={onSelectionChange}
                onPaneClick={closeMenus}
                colorMode={theme}
                selectionOnDrag={roadmapTool === 'select'}
                panOnDrag={roadmapTool === 'pan'}
                selectionMode={SelectionMode.Partial}
                selectionKeyCode="Shift"
                multiSelectionKeyCode="Shift"
                className={`transition-all duration-300 ${roadmapTool === 'select' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
                nodeTypes={nodeTypes} fitView snapToGrid snapGrid={[15, 15]}
                proOptions={{ hideAttribution: true }}
                defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#6b7280', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' } }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    className={`!bg-console-bg transition-colors duration-500 ${roadmapTool === 'select' ? '!opacity-80' : ''}`}
                    color={roadmapTool === 'select' ? 'var(--accent-primary)' : 'var(--border-subtle)'}
                />
                {roadmapTool === 'select' && (
                    <div className="absolute inset-0 pointer-events-none bg-accent-primary/[0.02] z-0 animate-in fade-in duration-500" />
                )}
                <Controls
                    className="flex !bg-console-surface/80 !backdrop-blur-xl !border-border-subtle !rounded-lg sm:!rounded-xl overflow-hidden shadow-premium !mb-8 sm:!mb-4 [&>button]:!bg-transparent [&>button]:!border-b [&>button]:!border-border-subtle last:[&>button]:!border-b-0 [&>button]:!w-7 [&>button]:!h-7 [&>button>svg]:!w-3.5 [&>button>svg]:!h-3.5 sm:[&>button]:!w-8 sm:[&>button]:!h-8 sm:[&>button>svg]:!w-4 sm:[&>button>svg]:!h-4 transition-all"
                />
                <MiniMap
                    nodeColor={(n) => {
                        const data = n.data as RoadmapNodeData;
                        if (data.status === 'done') return '#22c55e';
                        if (data.status === 'in-progress') return '#3b82f6';
                        return theme === 'dark' ? '#6b7280' : '#d1d5db';
                    }}
                    maskColor={theme === 'dark' ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)"}
                    maskStrokeColor="transparent"
                    maskStrokeWidth={0}
                    className="!bg-transparent !border-none !shadow-none !mb-8 sm:!m-4 transition-all"
                    style={isMobile ? { height: 7 * 4 * 4, width: 100 } : undefined} // 4 buttons * 7 (28px) = 112px height to match the controls pile perfectly
                />

                {/* Top Controls - Floating Pill on Mobile, Bar on Desktop */}
                <Panel position="top-center" className="w-full sm:max-w-fit px-2 sm:px-0 pointer-events-none mt-2 sm:mt-4">
                    <div className="pointer-events-auto flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-console-surface/40 backdrop-blur-2xl border border-border-subtle rounded-full sm:rounded-xl shadow-premium w-max mx-auto sm:mx-0 transition-all liquid-glass">

                        {/* Mobile: Filter Icon Button */}
                        <div className="relative shrink-0 sm:hidden">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowFilterMenu(!showFilterMenu); setShowAddMenu(false); }}
                                className={`flex items-center justify-center p-2 rounded-full transition-colors ${filterCategory !== 'all' ? 'bg-accent-primary/20 text-accent-primary' : 'bg-console-surface-2 text-text-secondary hover:bg-console-surface-3'}`}
                            >
                                <Filter size={16} />
                            </button>
                            {/* Mobile Filter Menu */}
                            {showFilterMenu && (
                                <div
                                    className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-40 bg-console-surface border border-border-subtle rounded-xl shadow-premium z-[100] py-1 max-h-60 overflow-y-auto pointer-events-auto"
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <button onClick={() => { setFilterCategory('all'); setShowFilterMenu(false); }}
                                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${filterCategory === 'all' ? 'text-accent-primary bg-accent-primary/5' : 'text-text-secondary hover:bg-console-surface-2'}`}>
                                        All Categories
                                    </button>
                                    <div className="h-px bg-border-subtle my-1 w-full" />
                                    {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, label, color }]) => (
                                        <button key={key} onClick={() => { setFilterCategory(key as CategoryType); setShowFilterMenu(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${filterCategory === key ? 'bg-console-surface-2' : 'hover:bg-console-surface-2'}`}>
                                            <Icon size={12} className={color} /> <span className={filterCategory === key ? 'text-text-primary' : 'text-text-secondary'}>{label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Desktop: Search & Inline Filter */}
                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <div className="relative shrink-0">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-disabled" />
                                <input id="roadmap-search" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..."
                                    className="w-40 pl-8 pr-3 h-[32px] text-xs bg-console-surface-2 border border-border-subtle rounded-lg text-text-primary placeholder-text-disabled outline-none focus:border-accent-primary transition-colors" />
                            </div>
                            <div className="w-px h-5 bg-border-subtle mx-1" />
                            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)}
                                className="shrink-0 text-xs bg-console-surface-2 border border-border-subtle rounded-lg px-3 h-[32px] text-text-secondary outline-none transition-colors cursor-pointer">
                                <option value="all">All Categories</option>
                                {Object.entries(CATEGORY_ICONS).map(([key, { label }]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                            <div className="w-px h-5 bg-border-subtle mx-1" />
                        </div>

                        {/* Tool Switcher */}
                        <div className="flex bg-console-surface-2 p-1 rounded-xl border border-border-subtle mr-1.5 shadow-sm">
                            <button
                                onClick={() => setRoadmapTool('pan')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${roadmapTool === 'pan' ? 'bg-console-surface shadow-sm text-accent-primary ring-1 ring-accent-primary/20' : 'text-text-disabled hover:text-text-secondary'}`}
                            >
                                <Hand size={14} className={roadmapTool === 'pan' ? 'animate-pulse' : ''} />
                                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Move</span>
                            </button>
                            <button
                                onClick={() => setRoadmapTool('select')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${roadmapTool === 'select' ? 'bg-console-surface shadow-sm text-accent-primary ring-1 ring-accent-primary/20' : 'text-text-disabled hover:text-text-secondary'}`}
                            >
                                <MousePointer2 size={14} className={roadmapTool === 'select' ? 'animate-pulse' : ''} />
                                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Select</span>
                            </button>
                        </div>

                        {/* Universal: Add Button */}
                        <div className="relative shrink-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowAddMenu(!showAddMenu); setShowFilterMenu(false); }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="flex items-center justify-center p-2 sm:px-3 sm:py-1.5 sm:h-[32px] rounded-full sm:rounded-lg bg-accent-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all"
                            >
                                <Plus size={16} className="sm:mr-1.5" /> <span className="hidden sm:inline text-xs font-semibold">Add Topic</span>
                            </button>
                            {/* Add Menu */}
                            {showAddMenu && (
                                <div
                                    className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-full mt-2 w-44 bg-console-surface border border-border-subtle rounded-xl shadow-premium z-[100] py-1 max-h-60 overflow-y-auto pointer-events-auto"
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-text-disabled tracking-wider">Select Theme</div>
                                    <button onClick={() => addNode('general')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-console-surface-2 transition-colors"><Layers size={14} className="text-text-disabled" /> Generic Topic</button>
                                    <div className="h-px bg-border-subtle my-1 w-full" />
                                    {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, label, color }]) => (
                                        <button key={key} onClick={() => addNode(key as CategoryType)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-console-surface-2 transition-colors">
                                            <Icon size={14} className={color} /> {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Universal: Save Button */}
                        <div className="shrink-0 flex items-center">
                            <div className="w-px h-6 bg-border-subtle mx-1.5 sm:hidden" />
                            <button onClick={onSave} disabled={isSaving} className={`flex items-center justify-center p-2 sm:px-3 sm:py-1.5 sm:h-[32px] rounded-full sm:rounded-lg transition-all ${saveSuccess ? 'bg-status-ok text-white' : hasUnsavedChanges ? 'bg-[#ff9800] text-white shadow-[0_0_10px_rgba(255,152,0,0.3)]' : 'bg-console-surface-2 text-text-secondary hover:text-text-primary hover:bg-console-surface-3'}`}>
                                {saveSuccess ? <CheckCircle2 size={16} className="sm:mr-1.5" /> : isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin sm:mr-1.5" /> : <Save size={16} className="sm:mr-1.5" />}
                                <span className="hidden sm:inline text-xs font-medium">{saveSuccess ? 'Saved' : hasUnsavedChanges ? 'Unsaved' : 'Saved'}</span>
                                {hasUnsavedChanges && !saveSuccess && !isSaving && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-status-error border-2 border-console-surface rounded-full sm:hidden" />}
                            </button>
                        </div>

                        {!isMobile && (
                            <>
                                <button onClick={exportRoadmap} className="p-1 text-text-secondary hover:text-text-primary transition-colors shrink-0" title="Export JSON">
                                    <Download size={14} />
                                </button>
                                <label className="p-1 text-text-secondary hover:text-text-primary cursor-pointer transition-colors shrink-0" title="Import JSON">
                                    <Upload size={14} />
                                    <input type="file" accept=".json" onChange={importRoadmap} className="hidden" />
                                </label>
                            </>
                        )}

                        <div className="w-px h-6 bg-border-subtle mx-1" />

                        <button
                            onClick={onLayout}
                            className="flex items-center justify-center p-2 sm:px-3 sm:py-1.5 sm:h-[32px] rounded-full sm:rounded-lg bg-console-surface-2 text-accent-primary hover:bg-accent-primary/10 transition-all"
                            title="Auto-Layout (Magic Organize)"
                        >
                            <Wand2 size={16} className="sm:mr-1.5" />
                            <span className="hidden sm:inline text-xs font-semibold">Magic Layout</span>
                        </button>
                    </div>
                </Panel>

                {/* Progress Stats - Mobile pushes to bottom-center */}
                < Panel position={isMobile ? 'bottom-center' : 'top-right'} >
                    <div className="flex items-center gap-1 sm:gap-2 px-1.5 py-0.5 sm:px-3 sm:py-1.5 h-[20px] sm:h-auto bg-console-surface border border-border-subtle rounded-lg sm:rounded-xl shadow-premium mb-2 sm:mb-0">
                        <span className="text-[10px] font-bold text-text-primary leading-none">{progressPercent}%</span>
                        <div className="w-10 sm:w-12 h-1 bg-console-surface-2 rounded-full overflow-hidden">
                            <div className="h-full bg-status-ok transition-all" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <span className="text-[9px] text-text-disabled leading-none">{stats.done}/{stats.total}</span>
                    </div>
                </Panel >



                {/* Legend - Desktop only */}
                {
                    !isMobile && (
                        <Panel position="bottom-left">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-console-surface border border-border-subtle rounded-xl text-[10px] text-text-secondary shadow-premium">
                                <span className="flex items-center gap-1"><Circle size={8} className="text-text-disabled" /> Todo</span>
                                <span className="flex items-center gap-1"><Clock size={8} className="text-accent-primary" /> Progress</span>
                                <span className="flex items-center gap-1"><CheckCircle2 size={8} className="text-status-ok" /> Done</span>
                                <span className="text-text-disabled">|</span>
                                <span className="text-text-disabled">Click edge to delete • Del remove • Right-click menu</span>
                            </div>
                        </Panel>
                    )
                }

                {
                    nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center p-6 bg-console-surface rounded-2xl border border-dashed border-border-subtle pointer-events-auto shadow-premium">
                                <Plus size={24} className="text-text-disabled mx-auto mb-3" />
                                <p className="text-text-primary text-sm font-medium">No topics yet</p>
                                <p className="text-text-secondary text-xs mt-1">Click "Add" to start building your roadmap</p>
                            </div>
                        </div>
                    )
                }
            </ReactFlow >

            {/* Context Menu */}
            {
                contextMenu && (
                    <div className="fixed bg-console-surface border border-border-subtle rounded-xl shadow-premium py-1 z-50 transition-all font-sans" style={{ left: contextMenu.x, top: contextMenu.y }}>
                        <button onClick={() => { setSelectedNode(contextMenu.node); setShowModal(true); setContextMenu(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-console-surface-2 transition-colors">
                            <Pencil size={12} /> Edit
                        </button>
                        <button onClick={() => { cycleStatus(contextMenu.node); setContextMenu(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-console-surface-2 transition-colors">
                            <CheckCircle2 size={12} /> Cycle Status
                        </button>
                        {(contextMenu.node.data as RoadmapNodeData).resourceUrl && (
                            <a href={(contextMenu.node.data as RoadmapNodeData).resourceUrl} target="_blank" rel="noopener noreferrer"
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                                <ExternalLink size={12} /> Open Link
                            </a>
                        )}
                        <button onClick={() => deleteNode(contextMenu.node.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-status-error hover:bg-status-error/10 transition-colors">
                            <Trash2 size={12} /> Delete
                        </button>
                    </div>
                )
            }

            {/* Edit Modal (Bottom Sheet on Mobile, Centered on Desktop) */}
            {
                showModal && selectedNode && (
                    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-console-bg/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                        <div className="w-full sm:max-w-lg px-5 py-6 sm:p-6 rounded-t-3xl sm:rounded-2xl bg-console-surface border-t sm:border border-border-subtle shadow-[0_-8px_30px_rgba(0,0,0,0.5)] sm:shadow-premium max-h-[90vh] overflow-y-auto pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="w-10 h-1 bg-border-subtle rounded-full mx-auto mb-5 sm:hidden" /> {/* Mobile Drag Indicator */}
                            <div className="flex items-center justify-between mb-5 sm:mb-6">
                                <h2 className="text-lg font-semibold text-text-primary">Edit Topic</h2>
                                <button onClick={() => setShowModal(false)} className="p-2 -mr-2 rounded-lg hover:bg-console-surface-2 text-text-secondary transition-colors"><X size={18} /></button>
                            </div>

                            <div className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-text-secondary mb-1 block">Topic Name</label>
                                    <input type="text" value={(selectedNode.data as RoadmapNodeData).label}
                                        onChange={(e) => updateNodeData({ label: e.target.value })}
                                        className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2.5 bg-console-surface-2 border border-border-subtle rounded-lg sm:rounded-xl text-text-primary text-[11px] sm:text-sm focus:border-accent-primary outline-none transition-colors" />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-text-secondary mb-1 block">Description</label>
                                    <textarea value={(selectedNode.data as RoadmapNodeData).description || ''} rows={2}
                                        onChange={(e) => updateNodeData({ description: e.target.value })}
                                        className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2.5 bg-console-surface-2 border border-border-subtle rounded-lg sm:rounded-xl text-text-primary text-[11px] sm:text-sm focus:border-accent-primary outline-none resize-none transition-colors"
                                        placeholder="Notes..." />
                                </div>

                                {/* Resource URL */}
                                <div>
                                    <label className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-text-secondary mb-1 flex items-center gap-1">
                                        <Link size={10} /> Resource Link
                                    </label>
                                    <input type="url" value={(selectedNode.data as RoadmapNodeData).resourceUrl || ''}
                                        onChange={(e) => updateNodeData({ resourceUrl: e.target.value })}
                                        className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2.5 bg-console-surface-2 border border-border-subtle rounded-lg sm:rounded-xl text-text-primary text-[11px] sm:text-sm focus:border-accent-primary outline-none transition-colors"
                                        placeholder="https://..." />
                                </div>

                                {/* Time & Priority Row */}
                                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                    <div>
                                        <label className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-text-secondary mb-1 flex items-center gap-1">
                                            <Timer size={10} /> Est. Hours
                                        </label>
                                        <input type="text" inputMode="numeric" value={(selectedNode.data as RoadmapNodeData).estimatedHours || ''}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^\d.]/g, '');
                                                updateNodeData({ estimatedHours: parseFloat(val) || 0 });
                                            }}

                                            className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2.5 bg-console-surface-2 border border-border-subtle rounded-lg sm:rounded-xl text-text-primary text-[11px] sm:text-sm focus:border-accent-primary outline-none transition-colors" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-text-secondary mb-1 flex items-center gap-1">
                                            <Flag size={10} /> Priority
                                        </label>
                                        <div className="flex gap-1">
                                            {(['low', 'medium', 'high'] as const).map((p) => (
                                                <button key={p} onClick={() => updateNodeData({ priority: p })}
                                                    className={`flex-1 py-1.5 sm:py-2 text-[10px] sm:text-xs rounded-lg border transition-colors ${(selectedNode.data as RoadmapNodeData).priority === p
                                                        ? `${PRIORITY_CONFIG[p].bg} ${PRIORITY_CONFIG[p].color} border-current`
                                                        : 'bg-console-surface-2 text-text-secondary border-border-subtle hover:bg-console-surface-3'
                                                        }`}>
                                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-text-secondary mb-1 block">Category</label>
                                    <div className="grid grid-cols-6 gap-1">
                                        {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, label, color }]) => (
                                            <button key={key} onClick={() => updateNodeData({ category: key as CategoryType })}
                                                title={label}
                                                className={`flex items-center justify-center py-1.5 sm:py-2 rounded-lg border transition-colors ${(selectedNode.data as RoadmapNodeData).category === key
                                                    ? 'bg-console-surface-3 border-accent-primary/50 ring-1 ring-accent-primary/30'
                                                    : 'bg-console-surface-2 border-border-subtle hover:bg-console-surface-3'
                                                    }`}>
                                                <Icon size={12} className={color} />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Status */}
                                <div>
                                    <label className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-text-secondary mb-1 block">Status</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['todo', 'in-progress', 'done'] as const).map((s) => (
                                            <button key={s} onClick={() => updateNodeData({ status: s })}
                                                className={`py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium rounded-lg sm:rounded-xl border transition-colors ${(selectedNode.data as RoadmapNodeData).status === s
                                                    ? 'bg-accent-primary text-white border-transparent shadow-premium'
                                                    : 'bg-console-surface-2 text-text-secondary border-border-subtle'
                                                    }`}>
                                                {s === 'todo' ? 'Todo' : s === 'in-progress' ? 'In Progress' : 'Done'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-4 sm:mt-6 pt-3 sm:pt-5 border-t border-border-subtle">
                                <button onClick={() => deleteNode()} className="text-[11px] sm:text-sm text-status-error hover:text-status-error/80 flex items-center gap-1.5 transition-colors">
                                    <Trash2 size={12} /> Delete
                                </button>
                                <button onClick={() => setShowModal(false)} className="px-4 sm:px-5 py-1.5 sm:py-2.5 bg-console-surface-3 text-text-primary text-[11px] sm:text-sm font-medium rounded-lg sm:rounded-xl shadow-premium hover:bg-console-surface-4 transition-colors">
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Bulk Actions Bar */}
            {selectedNodes.length > 1 && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-2 p-2 bg-console-surface/80 backdrop-blur-xl border border-border-subtle rounded-2xl shadow-premium">
                        <div className="px-3 py-1 border-r border-border-subtle mr-1">
                            <span className="text-xs font-bold text-accent-primary">{selectedNodes.length}</span>
                            <span className="text-[10px] text-text-secondary ml-1 font-medium">Selected</span>
                        </div>
                        <div className="flex items-center gap-1 font-sans">
                            {(['todo', 'in-progress', 'done'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => bulkUpdateStatus(s)}
                                    className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-console-surface-2 hover:bg-console-surface-3 text-text-secondary transition-all flex items-center gap-1.5"
                                >
                                    {s === 'todo' ? <Circle size={10} /> : s === 'in-progress' ? <Clock size={10} /> : <CheckCircle2 size={10} />}
                                    {s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
                                </button>
                            ))}
                            <div className="w-px h-6 bg-border-subtle mx-1" />
                            <button
                                onClick={bulkDelete}
                                className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-status-error/10 hover:bg-status-error/20 text-status-error transition-all flex items-center gap-1.5"
                            >
                                <Trash2 size={10} /> Delete
                            </button>
                        </div>
                        <button
                            onClick={() => setSelectedNodes([])}
                            className="p-1.5 ml-1 text-text-disabled hover:text-text-primary transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-console-bg/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
                    <div className="w-full max-w-[320px] bg-console-surface border border-border-subtle rounded-2xl shadow-premium p-5 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-status-error/10 flex items-center justify-center text-status-error mb-4">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-base font-semibold text-text-primary mb-2">
                                Delete {confirmDelete.type === 'node' ? 'Topic' : 'Connection'}?
                            </h3>
                            <p className="text-xs text-text-secondary mb-6">
                                This action cannot be undone. Are you sure you want to proceed?
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="flex-1 px-4 py-2 bg-console-surface-2 text-text-primary text-xs font-medium rounded-xl hover:bg-console-surface-3 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => confirmDelete.type === 'node' ? (confirmDelete.id === 'bulk' ? (setNodes(nds => nds.filter(n => !selectedNodes.some(sn => sn.id === n.id))), setEdges(eds => eds.filter(e => !selectedNodes.some(sn => sn.id === e.source || sn.id === e.target))), setSelectedNodes([]), setConfirmDelete(null), setHasUnsavedChanges(true)) : (deleteNode(confirmDelete.id))) : deleteEdge(confirmDelete.id)}
                                    className="flex-1 px-4 py-2 bg-status-error text-white text-xs font-medium rounded-xl hover:bg-status-error/80 transition-colors shadow-[0_4px_12px_rgba(239,68,68,0.2)]"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

export function Roadmap() {
    return (
        <ReactFlowProvider>
            <RoadmapContent />
        </ReactFlowProvider>
    );
}
