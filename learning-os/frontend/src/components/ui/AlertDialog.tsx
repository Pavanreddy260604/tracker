import { Modal } from './Modal';
import { Button } from './Button';
import { Info } from 'lucide-react';

interface AlertDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    buttonLabel?: string;
}

export function AlertDialog({
    isOpen,
    onClose,
    title,
    description,
    buttonLabel = 'OK'
}: AlertDialogProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4 p-4 bg-zinc-500/10 border border-zinc-500/20 rounded-lg">
                    <Info className="text-zinc-400 shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-zinc-300">
                        {description}
                    </p>
                </div>

                <div className="flex items-center justify-end mt-4">
                    <Button
                        variant="primary"
                        onClick={onClose}
                    >
                        {buttonLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
