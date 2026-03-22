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
            <div className="h-full w-full overflow-hidden flex flex-col bg-console-bg text-text-primary absolute inset-0">
                {/* Main Content - Editor (always visible) */}
                <div className="flex-1 h-full relative overflow-hidden bg-console-bg z-10 flex flex-col">
                    {children}
                </div>

                {/* Left Panel - Overlay on mobile */}
                {leftPanelOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40" />
                        <div className="fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] bg-console-bg border-r border-border-subtle z-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-left duration-300">
                            {leftPanel}
                        </div>
                    </>
                )}

                {/* Right Panel - Overlay on mobile */}
                {rightPanelOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40" />
                        <div className="fixed top-0 right-0 bottom-0 w-[340px] max-w-[88vw] bg-console-bg border-l border-border-subtle z-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-right duration-300">
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
        <div className="h-full w-full overflow-hidden flex flex-row bg-console-bg text-text-primary absolute inset-0">
            {/* Left Panel - Structure */}
            <div
                className={`
                    border-r border-border-subtle/30 bg-console-surface-2/40 backdrop-blur-md transition-all duration-500 ease-in-out flex-shrink-0 relative z-20
                    ${leftPanelOpen ? leftWidth : collapsedWidth}
                `}
            >
                <div className={`h-full ${leftInnerWidth} overflow-y-auto custom-scrollbar shadow-elevation-3`}>
                    {leftPanel}
                </div>
            </div>

            {/* Main Content - Editor */}
            <div className="flex-1 h-full relative overflow-hidden bg-console-bg z-10 flex flex-col">
                {children}
            </div>

            {/* Right Panel - Context */}
            <div
                className={`
                    border-l border-border-subtle/30 bg-console-surface-2/40 backdrop-blur-md transition-all duration-500 ease-in-out flex-shrink-0 relative z-20
                    ${rightPanelOpen ? rightWidth : collapsedWidth}
                `}
            >
                <div className={`h-full ${rightInnerWidth} overflow-y-auto custom-scrollbar shadow-elevation-3`}>
                    {rightPanel}
                </div>
            </div>
        </div>
    );
}
