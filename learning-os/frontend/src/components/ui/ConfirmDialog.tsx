import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
    isLoading?: boolean;
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'primary',
    isLoading = false
}: ConfirmDialogProps) {
    const [internalLoading, setInternalLoading] = useState(false);
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <div className="flex flex-col gap-4">
                <div className={`flex items-start gap-4 p-4 rounded-lg border ${variant === 'danger'
                    ? 'bg-red-500/10 border-red-500/20'
                    : 'bg-blue-500/10 border-blue-500/20'
                    }`}>
                    {variant === 'danger' ? (
                        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    ) : (
                        <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
                    )}
                    <p className={`text-sm ${variant === 'danger' ? 'text-red-200' : 'text-blue-100'}`}>
                        {description}
                    </p>
                </div>

                <div className="flex items-center justify-end gap-3 mt-4">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isLoading || internalLoading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        onClick={async () => {
                            setInternalLoading(true);
                            try {
                                await onConfirm();
                                onClose();
                            } catch (error) {
                                console.error('Confirmation action failed:', error);
                            } finally {
                                setInternalLoading(false);
                            }
                        }}
                        isLoading={isLoading || internalLoading}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
