import { motion } from 'framer-motion';

interface VoiceVisualizerProps {
    volume: number; // 0 to 100
    isSpeaking: boolean;
    isListening: boolean;
}

export function VoiceVisualizer({ volume, isSpeaking, isListening }: VoiceVisualizerProps) {
    // Generate bars based on volume
    const bars = [1, 2, 3, 4, 5, 4, 3, 2, 1];
    const isActive = isSpeaking || isListening;

    return (
        <div className="flex items-center justify-center gap-1.5 h-24">
            {bars.map((baseHeight, i) => (
                <motion.div
                    key={i}
                    animate={{
                        height: isActive 
                            ? [
                                `${baseHeight * 8}px`, 
                                `${baseHeight * (8 + (volume / 4))}px`, 
                                `${baseHeight * 8}px`
                              ]
                            : "4px",
                        opacity: isActive ? 1 : 0.3,
                        backgroundColor: isSpeaking ? "#6366f1" : "#10b981" // Indigo for AI, Emerald for User
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 0.5 + (i * 0.1),
                        ease: "easeInOut"
                    }}
                    className="w-1.5 rounded-full shadow-lg"
                />
            ))}
        </div>
    );
}
