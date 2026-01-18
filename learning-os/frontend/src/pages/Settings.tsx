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
    Check
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { api } from '../services/api';

export function Settings() {
    const { user, logout, checkAuth } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const [targets, setTargets] = useState({
        dsaHours: 6,
        backendHours: 4,
        projectHours: 1,
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
            alert('Failed to update targets');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        if (confirm('Are you sure you want to log out?')) {
            logout();
        }
    };

    const handleExportData = async () => {
        try {
            const response = await api.exportData();
            // response.data contains the export object
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
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
            alert('Failed to export data');
        }
    };

    const handleDeleteAccount = async () => {
        if (confirm('Are you ABSOLUTELY SURE? This will permanently delete your account and all data. This action cannot be undone.')) {
            const confirmName = prompt(`Please type "delete/${user?.name}" to confirm.`);
            if (confirmName === `delete/${user?.name}`) {
                try {
                    await api.deleteAccount();
                    logout();
                } catch (error) {
                    console.error('Failed to delete account', error);
                    alert('Failed to delete account');
                }
            }
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account and preferences</p>
            </div>

            {/* Profile Section */}
            <motion.div
                className="p-6 rounded-xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-white text-2xl font-bold">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{user?.name}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
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
                    <p className="text-xs text-gray-500">
                        To change your name or email, please contact support.
                    </p>
                </div>
            </motion.div>

            {/* Daily Targets */}
            <motion.div
                className="p-6 rounded-xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Target size={20} className="text-gray-500 dark:text-gray-300" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Targets</h2>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleSaveTargets}
                        disabled={isSaving}
                        className={saveSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-800 hover:bg-gray-900'}
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
                            <p className="text-gray-900 dark:text-white font-medium">DSA Hours</p>
                            <p className="text-xs text-gray-500">Daily target for DSA practice</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={targets.dsaHours}
                                onChange={(e) => setTargets(t => ({ ...t, dsaHours: Math.max(0, parseInt(e.target.value) || 0) }))}
                                className="w-20 text-center"
                                min={0}
                                max={24}
                            />
                            <span className="text-gray-400">hrs</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-900 dark:text-white font-medium">Backend Hours</p>
                            <p className="text-xs text-gray-500">Daily target for backend learning</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={targets.backendHours}
                                onChange={(e) => setTargets(t => ({ ...t, backendHours: Math.max(0, parseInt(e.target.value) || 0) }))}
                                className="w-20 text-center"
                                min={0}
                                max={24}
                            />
                            <span className="text-gray-400">hrs</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-900 dark:text-white font-medium">Project Hours</p>
                            <p className="text-xs text-gray-500">Daily target for code reading</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={targets.projectHours}
                                onChange={(e) => setTargets(t => ({ ...t, projectHours: Math.max(0, parseInt(e.target.value) || 0) }))}
                                className="w-20 text-center"
                                min={0}
                                max={24}
                            />
                            <span className="text-gray-400">hrs</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Preferences */}
            <motion.div
                className="p-6 rounded-xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="flex items-center gap-3 mb-6">
                    <Moon size={20} className="text-gray-500 dark:text-gray-300" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preferences</h2>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gray-100 dark:bg-white/5 cursor-pointer" onClick={toggleTheme}>
                        <div className="flex items-center gap-3">
                            <Moon size={18} className="text-gray-500 dark:text-gray-400" />
                            <div>
                                <p className="text-gray-900 dark:text-white font-medium">Dark Mode</p>
                                <p className="text-xs text-gray-500">Toggle application theme</p>
                            </div>
                        </div>
                        <div className={`w-14 h-8 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-green-500' : 'bg-gray-300'}`}>
                            <motion.span
                                layout
                                className="absolute top-1 w-6 h-6 rounded-full bg-white shadow"
                                style={{
                                    left: theme === 'dark' ? 'auto' : '4px',
                                    right: theme === 'dark' ? '4px' : 'auto'
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-gray-100 dark:bg-white/5 opacity-60">
                        <div className="flex items-center gap-3">
                            <Bell size={18} className="text-gray-500 dark:text-gray-400" />
                            <div>
                                <p className="text-gray-900 dark:text-white font-medium">Notifications</p>
                                <p className="text-xs text-gray-500">Coming soon</p>
                            </div>
                        </div>
                        <div className="w-14 h-8 rounded-full bg-gray-700 relative">
                            <span className="absolute left-1 top-1 w-6 h-6 rounded-full bg-white shadow" />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Data Management */}
            <motion.div
                className="p-6 rounded-xl bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div className="flex items-center gap-3 mb-6">
                    <Shield size={20} className="text-gray-500 dark:text-gray-300" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data & Privacy</h2>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleExportData}
                        className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Download size={18} className="text-gray-500 dark:text-gray-300" />
                            <div className="text-left">
                                <p className="text-gray-900 dark:text-white font-medium">Export Data</p>
                                <p className="text-xs text-gray-500">Download all your learning data</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleDeleteAccount}
                        className="w-full flex items-center justify-between p-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Trash2 size={18} className="text-red-400" />
                            <div className="text-left">
                                <p className="text-red-400 font-medium">Delete Account</p>
                                <p className="text-xs text-gray-500">Permanently delete all data</p>
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
                    variant="secondary"
                    onClick={handleLogout}
                    className="w-full"
                    leftIcon={<LogOut size={18} />}
                >
                    Sign Out
                </Button>
            </motion.div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-600 pt-4">
                <p>Learning OS v1.0.0</p>
                <p className="mt-1">Built with ❤️ for focused learners</p>
            </div>
        </div>
    );
}
