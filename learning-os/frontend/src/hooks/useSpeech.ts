import { useState, useCallback, useRef, useEffect } from 'react';

interface SpeechHook {
    isListening: boolean;
    transcript: string;
    startListening: () => void;
    stopListening: () => void;
    isSpeaking: boolean;
    speak: (text: string) => void;
    stopSpeaking: () => void;
    volume: number; // 0 to 100
    error: string | null;
}

export function useSpeech(): SpeechHook {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);

    // Initial STT setup
    useEffect(() => {
        if (typeof window !== 'undefined' && ('WebkitSpeechRecognition' in window || 'speechRecognition' in window)) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                let fullTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    fullTranscript += event.results[i][0].transcript;
                }
                setTranscript(fullTranscript);
            };

            recognitionRef.current.onstart = () => {
                setIsListening(true);
                setError(null);
            };

            recognitionRef.current.onend = () => {
                // Only set listening false if we didn't stop it manually
                // or if it truly should end.
                setIsListening(false);
                stopVolumeMonitoring();
            };

            recognitionRef.current.onerror = (err: any) => {
                console.error('STT Error:', err.error);
                if (err.error === 'not-allowed') {
                    setError('Camera/Mic permission denied.');
                } else if (err.error === 'no-speech') {
                    // Ignore no-speech, just stay listening if continuous
                    return;
                } else {
                    setError(`Speech error: ${err.error}`);
                }
                setIsListening(false);
                stopVolumeMonitoring();
            };
        }

        return () => {
            recognitionRef.current?.stop();
            stopVolumeMonitoring();
            window.speechSynthesis.cancel();
        };
    }, []);

    const startVolumeMonitoring = async () => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;

            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
            source.connect(analyserRef.current);

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            const updateVolume = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                // Higher sensitivity for visualizer
                setVolume(Math.min(100, Math.round((average / 100) * 100)));
                animationFrameRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();
        } catch (err) {
            console.warn('Volume monitoring failed:', err);
            setError('Could not access microphone.');
        }
    };

    const stopVolumeMonitoring = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        streamRef.current?.getTracks().forEach(track => track.stop());
        // Don't close context, just suspend it to reuse
        audioContextRef.current?.suspend();
        setVolume(0);
    };

    const startListening = useCallback(() => {
        setTranscript('');
        setError(null);
        try {
            recognitionRef.current?.start();
            startVolumeMonitoring();
        } catch (e) {
            console.error('Failed to start recognition', e);
            // Already started?
        }
    }, []);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    const speak = useCallback((text: string) => {
        if (!text || typeof window === 'undefined') return;
        
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        utterance.onstart = () => {
            setIsSpeaking(true);
            let ttsPulse = setInterval(() => {
                setVolume(20 + Math.random() * 30);
            }, 80);
            (utterance as any)._interval = ttsPulse;
        };

        utterance.onend = () => {
            setIsSpeaking(false);
            setVolume(0);
            clearInterval((utterance as any)._interval);
        };

        utterance.onerror = () => {
            setIsSpeaking(false);
            setVolume(0);
            clearInterval((utterance as any)._interval);
        };

        window.speechSynthesis.speak(utterance);
    }, []);

    const stopSpeaking = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setVolume(0);
    }, []);

    return {
        isListening,
        transcript,
        startListening,
        stopListening,
        isSpeaking,
        speak,
        stopSpeaking,
        volume,
        error
    };
}
