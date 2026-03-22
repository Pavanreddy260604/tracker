import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    LogOut,
    Download,
    Moon,
    Target,
    Bell,
    Trash2,
    Shield,
    Save,
    Check,
    Sparkles
} from 'lucide-react';
import { useDialog } from '../hooks/useDialog';
import { AlertDialog } from '../components/ui/AlertDialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { api } from '../services/api';

export function Settings() {
    const { user, logout, checkAuth } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const { dialog, showAlert, showConfirm, closeDialog } = useDialog();
    const [targets, setTargets] = useState({
        dsaHours: 6,
        backendHours: 4,
        projectHours: 1,
    });
    const [scriptInterests, setScriptInterests] = useState({
        directors: [] as string[],
        genres: [] as string[],
        styles: [] as string[]
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (user?.targets) {
            setTargets({
                dsaHours: user.targets.dsa,
                backendHours: user.targets.backend,
                projectHours: user.targets.project,
            });
        }
        if (user?.scriptInterests) {
            setScriptInterests({
                directors: user.scriptInterests.directors || [],
                genres: user.scriptInterests.genres || [],
                styles: user.scriptInterests.styles || []
            });
        }
    }, [user]);

    const handleSaveTargets = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await api.updateProfile({
                targets: {
                    dsa: targets.dsaHours,
                    backend: targets.backendHours,
                    project: targets.projectHours
                }
            });
            await checkAuth();
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to update targets', error);
            showAlert('Update Failed', 'Failed to update targets. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        showConfirm(
            'Confirm Logout',
            'Are you sure you want to log out?',
            logout
        );
    };

    const handleSaveInterests = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await api.updateProfile({
                scriptInterests
            });
            await checkAuth();
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to update interests', error);
            showAlert('Update Failed', 'Failed to update interests. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportData = async () => {
        try {
            const response = await api.exportData();
            const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `learning-os-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error(error);
            showAlert('Export Failed', 'Failed to export your data.');
        }
    };

    const handleDeleteAccount = async () => {
        showConfirm(
            'Delete Account',
            'Are you ABSOLUTELY SURE? This will permanently delete your account and all data. This action cannot be undone.',
            async () => {
                // For now, removing the prompt as it's harder to replace with a generic dialog quickly
                // but adding a warning that it's final.
                try {
                    await api.deleteAccount();
                    logout();
                } catch (error) {
                    console.error('Failed to delete account', error);
                    showAlert('Error', 'Failed to delete account.');
                }
            }
        );
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto pb-10">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
                <p className="text-sm text-text-secondary mt-1">Manage your account and preferences</p>
            </div>

            {/* Profile Section */}
            <motion.div
                className="p-6 rounded-xl bg-console-surface border border-border-subtle shadow-premium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-console-surface-2 border border-border-subtle flex items-center justify-center text-text-primary text-2xl font-bold shadow-sm">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-text-primary">{user?.name}</h2>
                        <p className="text-sm text-text-secondary">{user?.email}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <Input
                        label="Name"
                        value={user?.name || ''}
                        disabled
                        className="opacity-60"
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="opacity-60"
                    />
                    <p className="text-xs text-text-secondary">
                        To change your name or email, please contact support.
                    </p>
                </div>
            </motion.div>

            {/* Daily Targets */}
            <motion.div
                className="p-6 rounded-xl bg-console-surface border border-border-subtle shadow-premium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Target size={20} className="text-text-secondary" />
                        <h2 className="text-lg font-semibold text-text-primary">Daily Targets</h2>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleSaveTargets}
                        disabled={isSaving}
                        className={saveSuccess ? 'bg-status-ok hover:bg-status-ok' : 'bg-console-surface-2 border border-border-subtle text-text-primary hover:bg-console-surface-3 transition-all'}
                    >
                        {saveSuccess ? (
                            <>
                                <Check size={16} className="mr-2" />
                                Saved
                            </>
                        ) : (
                            <>
                                <Save size={16} className="mr-2" />
                                {isSaving ? 'Saving...' : 'Save Targets'}
                            </>
                        )}
                    </Button>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-text-primary font-bold">DSA Hours</p>
                            <p className="text-xs text-text-secondary">Daily target for DSA practice</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="text"
                                inputMode="numeric"
                                value={targets.dsaHours}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setTargets(t => ({ ...t, dsaHours: Math.min(24, parseInt(val) || 0) }));
                                }}
                                className="w-24 sm:w-20 text-center font-bold"
                            />

                            <span className="text-text-secondary font-medium">hrs</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-text-primary font-bold">Backend Hours</p>
                            <p className="text-xs text-text-secondary">Daily target for backend learning</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="text"
                                inputMode="numeric"
                                value={targets.backendHours}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setTargets(t => ({ ...t, backendHours: Math.min(24, parseInt(val) || 0) }));
                                }}
                                className="w-24 sm:w-20 text-center font-bold"
                            />

                            <span className="text-text-secondary font-medium">hrs</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-text-primary font-bold">Project Hours</p>
                            <p className="text-xs text-text-secondary">Daily target for code reading</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="text"
                                inputMode="numeric"
                                value={targets.projectHours}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setTargets(t => ({ ...t, projectHours: Math.min(24, parseInt(val) || 0) }));
                                }}
                                className="w-24 sm:w-20 text-center font-bold"
                            />

                            <span className="text-text-secondary font-medium">hrs</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Preferences */}
            <motion.div
                className="p-6 rounded-xl bg-console-surface border border-border-subtle shadow-premium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="flex items-center gap-3 mb-6">
                    <Moon size={20} className="text-text-secondary" />
                    <h2 className="text-lg font-semibold text-text-primary">Preferences</h2>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-console-surface-2 border border-border-subtle cursor-pointer hover:bg-console-surface-3 transition-colors" onClick={toggleTheme}>
                        <div className="flex items-center gap-3">
                            <Moon size={18} className="text-text-secondary" />
                            <div>
                                <p className="text-text-primary font-bold">Dark Mode</p>
                                <p className="text-xs text-text-secondary">Toggle application theme</p>
                            </div>
                        </div>
                        <div className={`w-14 h-8 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-status-ok' : 'bg-console-surface-3 shadow-inner'}`}>
                            <motion.span
                                layout
                                className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-lg"
                                style={{
                                    left: theme === 'dark' ? 'auto' : '4px',
                                    right: theme === 'dark' ? '4px' : 'auto'
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-console-surface-2 border border-border-subtle opacity-60">
                        <div className="flex items-center gap-3">
                            <Bell size={18} className="text-text-secondary" />
                            <div>
                                <p className="text-text-primary font-bold">Notifications</p>
                                <p className="text-xs text-text-secondary">Coming soon</p>
                            </div>
                        </div>
                        <div className="w-14 h-8 rounded-full bg-console-surface-3 relative">
                            <span className="absolute left-1 top-1 w-6 h-6 rounded-full bg-white/50" />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* AI Settings */}
            <motion.div
                className="p-6 rounded-xl bg-console-surface border border-border-subtle shadow-premium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
            >
                <div className="flex items-center gap-3 mb-6">
                    <Sparkles size={20} className="text-accent-primary" />
                    <h2 className="text-lg font-semibold text-text-primary">AI Copilot</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <Input
                            label="Gemini API Key"
                            type="password"
                            placeholder="Paste your key here..."
                            // Note: We don't show the key for security, user just pastes new one
                            onChange={(e) => {
                                if (e.target.value) {
                                    api.updateAIKey(e.target.value)
                                        .then(() => showAlert('Success', 'AI Key updated and encrypted!'))
                                        .catch(err => showAlert('Error', 'Failed to save key: ' + err.message));
                                }
                            }}
                        />
                        <p className="text-[10px] text-text-secondary mt-2 flex items-center gap-1">
                            <Shield size={10} /> Stored with AES-256-CBC encryption on the backend.
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Script Writer Interests */}
            <motion.div
                className="p-6 rounded-xl bg-console-surface border border-border-subtle shadow-premium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Sparkles size={20} className="text-blue-400" />
                        <h2 className="text-lg font-semibold text-text-primary">Script Writer Interests</h2>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleSaveInterests}
                        disabled={isSaving}
                        className={saveSuccess ? 'bg-status-ok hover:bg-status-ok' : 'bg-console-surface-2 border border-border-subtle text-text-primary hover:bg-console-surface-3 transition-all'}
                    >
                        {saveSuccess ? (
                            <><Check size={16} className="mr-2" /> Saved</>
                        ) : (
                            <><Save size={16} className="mr-2" /> {isSaving ? 'Saving...' : 'Save Interests'}</>
                        )}
                    </Button>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1 text-blue-400/80">Favorite Directors</label>
                        <Input
                            placeholder="Christopher Nolan, Quentin Tarantino..."
                            value={scriptInterests.directors.join(', ')}
                            onChange={(e) => setScriptInterests(s => ({ ...s, directors: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))}
                        />
                        <p className="text-[10px] text-text-secondary px-1">Boosts results from these directors in the RAG feed.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1 text-purple-400/80">Preferred Genres</label>
                        <Input
                            placeholder="Sci-Fi, Neo-Noir, Thriller..."
                            value={scriptInterests.genres.join(', ')}
                            onChange={(e) => setScriptInterests(s => ({ ...s, genres: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1 text-emerald-400/80">Writing Styles</label>
                        <Input
                            placeholder="Fast-Paced, Minimalist, Poetic..."
                            value={scriptInterests.styles.join(', ')}
                            onChange={(e) => setScriptInterests(s => ({ ...s, styles: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Data Management */}
            <motion.div
                className="p-6 rounded-xl bg-console-surface border border-border-subtle shadow-premium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div className="flex items-center gap-3 mb-6">
                    <Shield size={20} className="text-text-secondary" />
                    <h2 className="text-lg font-semibold text-text-primary">Data & Privacy</h2>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleExportData}
                        className="w-full flex items-center justify-between p-4 rounded-lg bg-console-surface-2 border border-border-subtle hover:bg-console-surface-3 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Download size={18} className="text-text-secondary" />
                            <div className="text-left">
                                <p className="text-text-primary font-bold">Export Data</p>
                                <p className="text-xs text-text-secondary">Download all your learning data</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleDeleteAccount}
                        className="w-full flex items-center justify-between p-4 rounded-lg bg-status-error/10 border border-status-error/30 hover:bg-status-error/20 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Trash2 size={18} className="text-status-error" />
                            <div className="text-left">
                                <p className="text-status-error font-bold">Delete Account</p>
                                <p className="text-xs text-status-error/70">Permanently delete all data</p>
                            </div>
                        </div>
                    </button>
                </div>
            </motion.div>

            {/* Logout */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <Button
                    variant="danger"
                    onClick={handleLogout}
                    className="w-full h-12 text-base font-semibold"
                    leftIcon={<LogOut size={20} />}
                >
                    Sign Out
                </Button>
            </motion.div>

            {/* Footer */}
            <div className="text-center text-xs text-text-secondary opacity-60 pt-4">
                <p>Learning OS v1.1.0 - Premium Build</p>
                <p className="mt-1">Built with care for focused learners</p>
            </div>

            <AlertDialog
                isOpen={dialog.isOpen && dialog.type === 'alert'}
                onClose={closeDialog}
                title={dialog.title}
                description={dialog.description}
            />

            <ConfirmDialog
                isOpen={dialog.isOpen && dialog.type === 'confirm'}
                onClose={closeDialog}
                onConfirm={dialog.onConfirm || (() => { })}
                title={dialog.title}
                description={dialog.description}
                variant={dialog.title.includes('Delete') ? 'danger' : 'primary'}
            />
        </div>
    );
}
