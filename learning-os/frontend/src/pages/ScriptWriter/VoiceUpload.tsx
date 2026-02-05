import { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, User } from 'lucide-react';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import { useAuthStore } from '../../stores/authStore';
import { useProjectStore } from '../../stores/projectStore';
import { useCharacterStore } from '../../stores/characterStore';

interface VoiceUploadProps {
    characterId?: string;
}

export function VoiceUpload({ characterId }: VoiceUploadProps) {
    const { user } = useAuthStore();
    const { activeProject } = useProjectStore();
    const { characters, loadCharacters } = useCharacterStore();

    // UI State
    const [selectedCharacterId, setSelectedCharacterId] = useState<string>(characterId || '');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (activeProject) {
            loadCharacters(activeProject._id);
        }
    }, [activeProject, loadCharacters]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (!activeProject) {
            setUploadStatus('error');
            setMessage('No active project selected.');
            return;
        }
        setIsUploading(true);
        setUploadStatus('idle');
        setMessage('');

        try {
            // Pass the characterId (or undefined if empty string)
            const result = await scriptWriterApi.ingestVoiceSample(
                activeProject._id,
                file,
                selectedCharacterId || undefined
            );

            if (result.success) {
                setUploadStatus('success');
                setMessage(`Successfully ingested ${result.count} chunks.`);
            } else {
                throw new Error('Upload failed');
            }
        } catch (error: any) {
            console.error(error);
            setUploadStatus('error');
            setMessage(error.message || 'Failed to upload file.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="sw-dropzone">
            <div className="flex flex-col items-center justify-center text-center p-6">
                <div className="sw-dropzone-icon">
                    {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
                </div>
                <h3 className="sw-section-title text-base">Upload Reference Audio</h3>
                <p className="sw-muted text-xs mt-1 mb-4">MP3, WAV, M4A up to 10MB</p>

                <div className="w-full max-w-xs mb-4">
                    <label className="sw-label text-left">Associate with Character (Optional)</label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 text-[color:var(--text-disabled)]" size={14} />
                        <select
                            value={selectedCharacterId}
                            onChange={(e) => setSelectedCharacterId(e.target.value)}
                            className="sw-select sw-select-icon"
                        >
                            <option value="">-- No Specific Character --</option>
                            {characters.map((char: any) => (
                                <option key={char._id} value={char._id}>
                                    {char.name} ({char.role})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="sw-file-input"
                />
            </div>

            {uploadStatus === 'success' && (
                <div className="sw-alert sw-alert-success mt-4">
                    <CheckCircle size={16} />
                    {message}
                </div>
            )}

            {uploadStatus === 'error' && (
                <div className="sw-alert sw-alert-error mt-4">
                    <AlertCircle size={16} />
                    {message}
                </div>
            )}
        </div>
    );
}
