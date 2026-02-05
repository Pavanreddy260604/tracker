import React from 'react';
import { useProjectStore } from '../../stores/projectStore';
import {
    Sparkles,
    Users,
    ScrollText,
    ChevronRight,
    Info,
    LayoutGrid,
    MessageSquareQuote
} from 'lucide-react';

interface ProjectHubProps {
    onNavigate: (tab: 'home' | 'story' | 'script' | 'cast' | 'settings') => void;
}

export const ProjectHub: React.FC<ProjectHubProps> = ({ onNavigate }) => {
    const { activeProject } = useProjectStore();

    if (!activeProject) return null;

    const stats = [
        { label: 'Beats', value: '15', icon: LayoutGrid, tone: 'accent' },
        { label: 'Characters', value: '4', icon: Users, tone: 'info' },
        { label: 'Dialogues', value: '240', icon: MessageSquareQuote, tone: 'success' },
    ];

    return (
        <div className="sw-page max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HERO SECTION */}
            <div className="sw-card sw-hero">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="sw-hero-icon">
                        <ScrollText size={28} />
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="flex items-center flex-wrap gap-3">
                            <h1 className="sw-hero-title">{activeProject.title}</h1>
                            <span className="sw-tag">{activeProject.genre}</span>
                        </div>

                        <p className="sw-hero-logline">
                            {activeProject.logline || 'A story yet to be defined...'}
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <button
                                onClick={() => onNavigate('script')}
                                className="sw-btn sw-btn-primary"
                            >
                                Start Writing <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => onNavigate('settings')}
                                className="sw-btn sw-btn-secondary"
                            >
                                Edit Bible
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="sw-card sw-card-hover p-6 flex items-center gap-4">
                        <div className={`sw-stat-icon is-${stat.tone}`}>
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <div className="sw-stat-value">{stat.value}</div>
                            <div className="sw-stat-label">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* AI MISSION CONTROL */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div
                    onClick={() => onNavigate('story')}
                    className="sw-card sw-card-hover sw-action-card"
                >
                    <div className="sw-action-header">
                        <div className="sw-action-icon">
                            <Sparkles size={22} />
                        </div>
                        <span className="sw-tag">Ready</span>
                    </div>
                    <h3 className="sw-card-title">Story Engine</h3>
                    <p className="sw-muted">
                        Convert your logline into a full 15-beat Save The Cat treatment with one click.
                    </p>
                    <div className="sw-action-link">
                        Access Engine <ChevronRight size={16} />
                    </div>
                </div>

                <div
                    onClick={() => onNavigate('cast')}
                    className="sw-card sw-card-hover sw-action-card"
                >
                    <div className="sw-action-header">
                        <div className="sw-action-icon is-muted">
                            <Users size={22} />
                        </div>
                    </div>
                    <h3 className="sw-card-title">VoiceLab & Casting</h3>
                    <p className="sw-muted">
                        Manage your characters and their reference scripts to ensure dialogue consistency.
                    </p>
                    <div className="sw-action-link">
                        Visit VoiceLab <ChevronRight size={16} />
                    </div>
                </div>
            </div>

            {/* AI ARCHITECTURE INSIGHT */}
            <div className="sw-callout">
                <div className="sw-callout-icon">
                    <Info size={18} />
                </div>
                <div>
                    <h4 className="sw-callout-title">Intelligent Architecture Enabled</h4>
                    <p className="sw-callout-text">
                        This project is powered by <span className="font-bold">RAG-driven Persona filtering</span> and <span className="font-bold">Continuous Narrative Memory</span>.
                        Every scene you write is aware of the previous scene's context and your characters' unique voices.
                    </p>
                </div>
            </div>
        </div>
    );
};
