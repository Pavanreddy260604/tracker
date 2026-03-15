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
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (typeof window !== 'undefined' && SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';
            recognitionRef.current.maxAlternatives = 1;

            recognitionRef.current.onresult = (event: any) => {
                let currentTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        currentTranscript += result[0].transcript;
                    } else {
                        currentTranscript += result[0].transcript;
                    }
                }
                setTranscript(currentTranscript);
            };

            recognitionRef.current.onstart = () => {
                setIsListening(true);
                setError(null);
            };

            recognitionRef.current.onend = () => {
                // If isListening is still true but the engine stopped, it was likely a timeout
                // or silent period. Auto-restart if we intended to be listening.
                if (recognitionRef.current && (window as any)._isListeningIntended) {
                    try {
                        recognitionRef.current.start();
                        return;
                    } catch (e) {
                        console.warn('Auto-restart failed:', e);
                    }
                }
                setIsListening(false);
                stopVolumeMonitoring();
            };

            recognitionRef.current.onerror = (err: any) => {
                console.error('STT Error:', err.error);
                if (err.error === 'not-allowed') {
                    setError('Camera/Mic permission denied.');
                    (window as any)._isListeningIntended = false;
                } else if (err.error === 'no-speech') {
                    // This often triggers 'onend', where our auto-restart catches it
                    return;
                } else if (err.error === 'aborted') {
                    // Manual stop, ignore error
                    return;
                } else {
                    setError(`Speech error: ${err.error}`);
                    (window as any)._isListeningIntended = false;
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
            // Already monitoring?
            if (streamRef.current) return;

            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;

            const source = audioContextRef.current.createMediaStreamSource(stream);
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
                setVolume(Math.min(100, Math.round((average / 100) * 100)));
                animationFrameRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();
        } catch (err) {
            console.warn('Volume monitoring failed:', err);
            // Don't set global error if recognition is still possible
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
        if (!recognitionRef.current) {
            setError('Speech recognition not supported in this browser.');
            return;
        }

        try {
            (window as any)._isListeningIntended = true;
            recognitionRef.current.start();
            setIsListening(true);
            startVolumeMonitoring();
        } catch (e: any) {
            console.error('Failed to start recognition', e);
            if (e.name === 'InvalidStateError') {
                // Already started, just ensure state is sync
                setIsListening(true);
            } else {
                setError(`Failed to start: ${e.message}`);
                setIsListening(false);
                (window as any)._isListeningIntended = false;
            }
        }
    }, [startVolumeMonitoring]);

    const stopListening = useCallback(() => {
        (window as any)._isListeningIntended = false;
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
