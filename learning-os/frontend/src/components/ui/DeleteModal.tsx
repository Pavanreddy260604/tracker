import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface DeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    isDeleting?: boolean;
}

export function DeleteModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    isDeleting = false
}: DeleteModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-red-200">
                        {description}
                    </p>
                </div>

                <div className="flex items-center justify-end gap-3 mt-4">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={onConfirm}
                        isLoading={isDeleting}
                    >
                        Delete
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
