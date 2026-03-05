import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface StrictTimerProps {
    initialTime: number; // in seconds
    onTimeUp: () => void;
    onWarning?: (timeLeft: number) => void;
    warningThreshold?: number; // seconds before time up to show warning
    className?: string;
}

export function StrictTimer({ 
    initialTime, 
    onTimeUp, 
    onWarning, 
    warningThreshold = 300, // 5 minutes default
    className = '' 
}: StrictTimerProps) {
    const [timeLeft, setTimeLeft] = useState(initialTime);

    useEffect(() => {
        setTimeLeft(initialTime);
    }, [initialTime]);

    useEffect(() => {
        if (timeLeft <= 0) {
            onTimeUp();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                const newTime = prev - 1;
                
                // Check warning threshold
                if (newTime === warningThreshold && onWarning) {
                    onWarning(newTime);
                }
                
                // Auto-submit when time is up
                if (newTime <= 0) {
                    onTimeUp();
                }
                
                return newTime;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, onTimeUp, onWarning, warningThreshold]);

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimeColor = () => {
        if (timeLeft <= 60) return 'text-red-500 animate-pulse';
        if (timeLeft <= warningThreshold) return 'text-yellow-500';
        return 'text-green-500';
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <Clock className={`w-4 h-4 ${getTimeColor()}`} />
            <span className={`font-mono font-semibold ${getTimeColor()}`}>
                {formatTime(timeLeft)}
            </span>
            {timeLeft <= warningThreshold && timeLeft > 0 && (
                <AlertTriangle className="w-4 h-4 text-yellow-500 animate-pulse" />
            )}
        </div>
    );
}
