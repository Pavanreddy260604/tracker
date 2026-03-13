import type { ReactNode } from 'react';
import { useMobile } from '../../../hooks/useMobile';

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
    const { isMobile, isTablet } = useMobile();

    // On mobile: panels become overlays
    if (isMobile) {
        return (
            <div className="h-full w-full overflow-hidden flex flex-col bg-zinc-900 text-zinc-100 absolute inset-0">
                {/* Main Content - Editor (always visible) */}
                <div className="flex-1 h-full relative overflow-hidden bg-zinc-900 z-10 flex flex-col">
                    {children}
                </div>

                {/* Left Panel - Overlay on mobile */}
                {leftPanelOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/50 z-40" />
                        <div className="fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] bg-zinc-950 border-r border-zinc-800 z-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-left duration-300">
                            {leftPanel}
                        </div>
                    </>
                )}

                {/* Right Panel - Overlay on mobile */}
                {rightPanelOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/50 z-40" />
                        <div className="fixed top-0 right-0 bottom-0 w-[340px] max-w-[88vw] bg-zinc-950 border-l border-zinc-800 z-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-right duration-300">
                            {rightPanel}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Tablet: narrower panels
    const leftWidth = isTablet ? 'w-52' : 'w-64';
    const rightWidth = isTablet ? 'w-72' : 'w-96';
    const leftInnerWidth = isTablet ? 'w-52' : 'w-64';
    const rightInnerWidth = isTablet ? 'w-72' : 'w-96';
    const collapsedWidth = 'w-12';

    return (
        <div className="h-full w-full overflow-hidden flex flex-row bg-zinc-900 text-zinc-100 absolute inset-0">
            {/* Left Panel - Structure */}
            <div
                className={`
                    border-r border-zinc-800 bg-zinc-950 transition-all duration-300 ease-in-out flex-shrink-0 relative z-20
                    ${leftPanelOpen ? leftWidth : collapsedWidth}
                `}
            >
                <div className={`h-full ${leftInnerWidth} overflow-y-auto custom-scrollbar`}>
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
                    ${rightPanelOpen ? rightWidth : collapsedWidth}
                `}
            >
                <div className={`h-full ${rightInnerWidth} overflow-y-auto custom-scrollbar`}>
                    {rightPanel}
                </div>
            </div>
        </div>
    );
}
