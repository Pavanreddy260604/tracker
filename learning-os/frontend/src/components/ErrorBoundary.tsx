import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        // You can also log the error to an error reporting service here
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div
                    className="min-h-screen flex items-center justify-center p-6"
                    style={{ background: '#1a1a2e' }}
                >
                    <div
                        className="max-w-md w-full text-center p-8 rounded-2xl"
                        style={{
                            background: '#16213e',
                            border: '1px solid rgba(255,255,255,0.08)'
                        }}
                    >
                        <div
                            className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(234, 67, 53, 0.15)' }}
                        >
                            <svg
                                width="32"
                                height="32"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#ea4335"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-sm mb-6" style={{ color: '#9aa0a6' }}>
                            An unexpected error occurred. Please try refreshing the page.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 rounded-xl font-medium transition-all"
                            style={{ background: '#4285f4', color: 'white' }}
                        >
                            Refresh Page
                        </button>
                        {import.meta.env.DEV && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary
                                    className="cursor-pointer text-sm mb-2"
                                    style={{ color: '#6b7280' }}
                                >
                                    Error Details
                                </summary>
                                <pre
                                    className="text-xs p-3 rounded-lg overflow-auto"
                                    style={{
                                        background: 'rgba(0,0,0,0.3)',
                                        color: '#ea4335'
                                    }}
                                >
                                    {this.state.error.message}
                                    {'\n\n'}
                                    {this.state.error.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
