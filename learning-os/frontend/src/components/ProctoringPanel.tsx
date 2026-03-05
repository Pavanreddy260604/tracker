import { Shield } from 'lucide-react';

interface Violation {
    type: 'tab_switch' | 'focus_loss' | 'copy_attempt' | 'paste_attempt' | 'fullscreen_exit';
    timestamp: number;
    message: string;
}

interface ProctoringPanelProps {
    violations: Violation[];
    violationCount: number;
    maxViolations: number;
    isFullscreen: boolean;
    isProctoringActive: boolean;
    onRequestFullscreen: () => void;
}

export function ProctoringPanel({ 
    violations, 
    violationCount, 
    maxViolations, 
    isFullscreen, 
    isProctoringActive,
    onRequestFullscreen 
}: ProctoringPanelProps) {
    const getViolationIcon = (type: Violation['type']) => {
        switch (type) {
            case 'tab_switch': return '🔄';
            case 'focus_loss': return '👁️';
            case 'copy_attempt': return '📋';
            case 'paste_attempt': return '📄';
            case 'fullscreen_exit': return '🖥️';
            default: return '⚠️';
        }
    };

    const getViolationColor = (count: number) => {
        if (count >= maxViolations - 1) return 'text-red-500';
        if (count >= maxViolations / 2) return 'text-yellow-500';
        return 'text-green-500';
    };

    if (!isProctoringActive) return null;

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
            {/* Proctoring Status */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-white">Proctoring Active</span>
                    </div>
                    <div className={`text-sm font-medium ${getViolationColor(violationCount)}`}>
                        {violationCount}/{maxViolations}
                    </div>
                </div>
                
                {!isFullscreen && (
                    <button
                        onClick={onRequestFullscreen}
                        className="w-full bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded transition-colors"
                    >
                        Enter Fullscreen
                    </button>
                )}
            </div>

            {/* Recent Violations */}
            {violations.slice(-3).map((violation) => (
                <div
                    key={violation.timestamp}
                    className="bg-red-900/90 border border-red-700 rounded-lg p-3 shadow-lg animate-pulse"
                >
                    <div className="flex items-start gap-2">
                        <span className="text-lg">{getViolationIcon(violation.type)}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-red-200 font-medium">
                                {violation.message}
                            </p>
                            <p className="text-xs text-red-400 mt-1">
                                {new Date(violation.timestamp).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
