
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Clock, CheckCircle2, RefreshCw } from 'lucide-react';

interface SRSInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SRSInfoModal({ isOpen, onClose }: SRSInfoModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="How Spaced Repetition Works"
            size="md"
        >
            <div className="space-y-6">
                <p className="text-gray-300">
                    The <strong>1-4-7 Method</strong> helps you move knowledge from short-term to long-term memory by reviewing it at optimal intervals.
                </p>

                <div className="space-y-4">
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="mt-1 bg-blue-500/20 p-1.5 rounded text-blue-400">
                            <Clock size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white">Stage 1: Initial Review</h4>
                                <Badge variant="info">Day 1</Badge>
                            </div>
                            <p className="text-sm text-gray-400">
                                When you first mark an item as "Review," it enters Stage 1.
                                It will disappear from your "Review Due" list and reappear in <strong>3 days</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <div className="mt-1 bg-purple-500/20 p-1.5 rounded text-purple-400">
                            <RefreshCw size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white">Stage 2: Recall</h4>
                                <Badge variant="purple">Day 4</Badge>
                            </div>
                            <p className="text-sm text-gray-400">
                                After 3 days, the item returns for review. If you complete it, it moves to Stage 2 and is rescheduled for <strong>another 3 days</strong> (Day 7).
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="mt-1 bg-green-500/20 p-1.5 rounded text-green-400">
                            <CheckCircle2 size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white">Stage 3: Mastery</h4>
                                <Badge variant="success">Day 7</Badge>
                            </div>
                            <p className="text-sm text-gray-400">
                                Final review! Once completed, the item is marked as <strong>Mastered</strong>.
                                It won't appear in your daily reviews anymore, but you can always revisit it.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 p-4 rounded-lg text-sm text-gray-400 italic">
                    <span className="text-white font-semibold not-italic">Tip: </span>
                    Use the "Review Due" filter to see only items that need your attention today.
                </div>
            </div>
        </Modal>
    );
}
