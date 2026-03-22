import React, { useMemo, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
    Panel,
    BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
    Shield, 
    Database, 
    Cpu, 
    ExternalLink, 
    Maximize2, 
    Server, 
    Zap, 
    Globe, 
    Layers,
    Lock,
    Webhook
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Elite category-to-icon mapping
const getCategoryIcon = (category?: string, type?: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('auth') || cat.includes('security')) return Lock;
    if (cat.includes('api') || cat.includes('gateway') || cat.includes('webhook')) return Webhook;
    if (cat.includes('db') || cat.includes('sql') || cat.includes('store') || type === 'table') return Database;
    if (cat.includes('cache') || cat.includes('redis')) return Zap;
    if (cat.includes('ui') || cat.includes('web')) return Globe;
    if (cat.includes('infra') || cat.includes('cloud')) return Layers;
    return type === 'component' ? Server : type === 'external' ? ExternalLink : Cpu;
};

interface ArchitectureMapProps {
    data: {
        nodes: { id: string; label: string; type: 'component' | 'table' | 'external'; category?: string }[];
        edges: { from: string; to: string; label: string }[];
    };
    className?: string;
}

export const ArchitectureMap: React.FC<ArchitectureMapProps> = ({ data, className }) => {
    const getNodeOffset = (seed: string, axis: 'x' | 'y') => {
        const source = `${seed}:${axis}`;
        const hash = source.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return hash % 20;
    };

    const initialNodes = useMemo(() => {
        return data.nodes.map((node, index) => {
            const Icon = getCategoryIcon(node.category, node.type);
            
            return {
                id: node.id,
                type: 'default',
                data: { 
                    label: (
                        <div className="flex flex-col items-center gap-2 p-1">
                            <div className={cn(
                                "p-2.5 rounded-xl border-2 transition-all duration-500",
                                node.type === 'component' ? "bg-accent-primary/10 border-accent-primary/30 text-accent-primary glow-content" :
                                node.type === 'table' ? "bg-status-warning/10 border-status-warning/30 text-status-warning" :
                                "bg-text-secondary/10 border-text-secondary/30 text-text-secondary"
                            )}>
                                <Icon size={18} />
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="text-[11px] font-black uppercase tracking-tighter text-center leading-tight max-w-[120px] break-words text-text-primary">
                                    {node.label}
                                </div>
                                {node.category && (
                                    <div className="text-[8px] font-bold opacity-60 uppercase tracking-[0.15em] mt-1 text-accent-primary">
                                        {node.category}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                },
                // Intelligent Grid Layout
                position: { 
                    x: (index % 4) * 220 + getNodeOffset(node.id || `${index}`, 'x'),
                    y: Math.floor(index / 4) * 180 + getNodeOffset(node.id || `${index}`, 'y')
                },
                style: {
                    background: 'rgba(10, 10, 15, 0.9)',
                    backdropFilter: 'blur(10px)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '16px',
                    width: 150,
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                }
            };
        });
    }, [data.nodes]);

    const initialEdges = useMemo(() => {
        return data.edges.map((edge, index) => ({
            id: `e-${index}`,
            source: edge.from,
            target: edge.to,
            label: edge.label,
            labelStyle: { fill: '#94a3b8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 6,
            labelBgStyle: { fill: 'rgba(15, 15, 25, 0.95)', fillOpacity: 0.9, stroke: 'rgba(255, 255, 255, 0.05)' },
            animated: true,
            style: { stroke: 'rgba(139, 92, 246, 0.5)', strokeWidth: 2.5, strokeDasharray: '5, 5' },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: 'rgba(139, 92, 246, 0.7)',
                width: 20,
                height: 20,
            },
        }));
    }, [data.edges]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    return (
        <div className={cn("relative w-full h-[600px] bg-console-darker border-2 border-border-subtle rounded-2xl overflow-hidden group shadow-premium", className)}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                className="bg-dot-pattern"
            >
                <Background 
                    variant={BackgroundVariant.Dots} 
                    gap={25} 
                    size={1} 
                    color="rgba(139, 92, 246, 0.1)" 
                />
                <Controls showInteractive={false} className="fill-accent-primary bg-console-elevated border-border-subtle" />
                <MiniMap 
                    style={{ background: '#0f0f14', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }} 
                    nodeColor={(n: any) => {
                        const styleStr = JSON.stringify(n.style || {});
                        if (styleStr.includes('status-warning')) return 'rgba(245, 158, 11, 0.5)';
                        if (styleStr.includes('accent-primary')) return 'rgba(139, 92, 246, 0.5)';
                        return 'rgba(156, 163, 175, 0.5)';
                    }}
                    maskColor="rgba(0, 0, 0, 0.7)"
                />
                
                <Panel position="top-right" className="p-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-xl rounded-xl border border-white/5 shadow-strong">
                            <Shield size={14} className="text-accent-primary animate-pulse" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Architectural Oracle v2</span>
                        </div>
                    </div>
                </Panel>
                
                <Panel position="bottom-right" className="p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2.5 bg-accent-primary/20 hover:bg-accent-primary/40 rounded-xl text-accent-primary border border-accent-primary/30 shadow-premium transition-all">
                        <Maximize2 size={18} />
                    </button>
                </Panel>
            </ReactFlow>
            
            {/* Visual Glass Overlay */}
            <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 rounded-2xl" />
        </div>
    );
};
