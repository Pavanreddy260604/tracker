import React, { ReactNode } from 'react';

interface InfiniteLayoutProps {
    leftPanel?: ReactNode;
    rightPanel?: ReactNode;
    children: ReactNode; // The Editor
    leftPanelOpen: boolean;
    rightPanelOpen: boolean;
}

export function InfiniteLayout({
    leftPanel,
    rightPanel,
    children,
    leftPanelOpen,
    rightPanelOpen
}: InfiniteLayoutProps) {
    return (
        <div className="h-full w-full overflow-hidden flex flex-row bg-zinc-900 text-zinc-100 absolute inset-0">
            {/* Left Panel - Structure */}
            <div
                className={`
                    border-r border-zinc-800 bg-zinc-950 transition-all duration-300 ease-in-out flex-shrink-0 relative z-20
                    ${leftPanelOpen ? 'w-64' : 'w-12'}
                `}
            >
                <div className="h-full w-64 overflow-y-auto custom-scrollbar">
                    {leftPanel}
                </div>
            </div>

            {/* Main Content - Editor */}
            <div className="flex-1 h-full relative overflow-hidden bg-zinc-900 z-10 flex flex-col">
                {children}
            </div>

            {/* Right Panel - Context */}
            <div
                className={`
                    border-l border-zinc-800 bg-zinc-950 transition-all duration-300 ease-in-out flex-shrink-0 relative z-20
                    ${rightPanelOpen ? 'w-80' : 'w-12'}
                `}
            >
                <div className="h-full w-80 overflow-y-auto custom-scrollbar">
                    {rightPanel}
                </div>
            </div>
        </div>
    );
}
