import React, { useEffect, useMemo } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    type Connection,
    type Edge,
    type Node,
    Panel,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Zap, Shield, Database, Server, Code, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

// Custom Node Component for Premium Feel
const TopicNode = ({ data, selected }: any) => {
    const Icon = data.icon || Server;
    
    return (
        <div className={cn(
            "px-6 py-4 rounded-2xl bg-console-elevated border-2 transition-all duration-300 shadow-premium",
            selected ? "border-accent-primary glow-content" : "border-border-subtle hover:border-accent-primary/50"
        )}>
            <div className="flex items-center gap-4">
                <div className={cn(
                    "p-3 rounded-xl bg-black/20",
                    selected ? "text-accent-primary" : "text-text-secondary"
                )}>
                    <Icon size={24} />
                </div>
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-disabled mb-1">
                        {data.category || 'Backend Node'}
                    </div>
                    <div className="text-lg font-bold text-text-primary tracking-tight">
                        {data.label}
                    </div>
                </div>
            </div>
            
            {/* AI Insight Badge if available */}
            {data.auditScore && (
                <div className="mt-4 pt-4 border-t border-border-subtle/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap size={14} className="text-status-warning" />
                        <span className="text-[10px] font-bold text-text-secondary uppercase">Scale Readiness</span>
                    </div>
                    <div className="text-xs font-black text-accent-primary">
                        {data.auditScore}%
                    </div>
                </div>
            )}
            
            {/* Ports / Handles are managed by ReactFlow but styled via CSS if needed */}
        </div>
    );
};

const nodeTypes = {
    topic: TopicNode,
};

interface SystemDesignCanvasProps {
    topics: any[];
    onNodeClick?: (topicId: string) => void;
}

export function SystemDesignCanvas({ topics, onNodeClick }: SystemDesignCanvasProps) {
    const initialNodes: Node[] = useMemo(() => {
        return topics.map((topic, index) => ({
            id: topic._id,
            type: 'topic',
            position: { x: (index % 3) * 350, y: Math.floor(index / 3) * 200 },
            data: {
                label: topic.topicName,
                category: topic.category,
                auditScore: topic.auditScore ?? 0,
                icon: getCategoryIcon(topic.category),
            },
        }));
    }, [topics]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        setNodes(initialNodes);
    }, [initialNodes, setNodes]);

    const onConnect = (params: Connection) => setEdges((eds) => addEdge(params, eds));

    return (
        <div className="w-full h-[600px] bg-console-darker rounded-3xl border border-border-subtle overflow-hidden relative shadow-inner">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                onNodeClick={(_e, node) => onNodeClick?.(node.id)}
                fitView
                className="bg-dot-pattern"
            >
                <Background 
                    variant={BackgroundVariant.Dots} 
                    gap={20} 
                    size={1} 
                    color="rgba(var(--accent-primary-rgb), 0.1)" 
                />
                <Controls className="bg-console-surface border-border-subtle fill-text-primary" />
                <MiniMap 
                    nodeColor="#2563eb"
                    maskColor="rgba(0, 0, 0, 0.5)"
                    className="bg-console-surface border-border-subtle rounded-xl"
                />
                
                <Panel position="top-right">
                    <div className="flex items-center gap-2 bg-console-elevated border border-border-subtle px-4 py-2 rounded-xl backdrop-blur-md shadow-strong">
                        <LayoutGrid size={16} className="text-accent-primary" />
                        <span className="text-xs font-bold text-text-primary uppercase tracking-tight">Architectural Mode</span>
                    </div>
                </Panel>
                
                <Panel position="bottom-center">
                    <AnimatePresence>
                        <motion.div 
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="bg-accent-primary/10 border border-accent-primary/20 px-6 py-2 rounded-full backdrop-blur-xl"
                        >
                            <span className="text-[11px] font-bold text-accent-primary uppercase tracking-widest flex items-center gap-2">
                                <Zap size={14} className="animate-pulse" />
                                Connect nodes to define service dependencies
                            </span>
                        </motion.div>
                    </AnimatePresence>
                </Panel>
            </ReactFlow>
            
            {/* Visual Glass Overlay for Premium feel */}
            <div className="absolute inset-0 pointer-events-none border-[12px] border-console-darker/50 rounded-3xl" />
        </div>
    );
}

function getCategoryIcon(category: string) {
    switch (category) {
        case 'database': return Database;
        case 'auth': return Shield;
        case 'api': return Zap;
        case 'node': return Code;
        case 'system-design': return Settings;
        default: return Server;
    }
}
