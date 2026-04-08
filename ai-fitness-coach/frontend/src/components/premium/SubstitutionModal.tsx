import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getSubstitutes } from '@/api/workoutApi';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Info } from 'lucide-react';

interface Substitute {
  _id: string;
  name: string;
  category: string;
}

interface SubstitutionModalProps {
  exerciseId: string;
  exerciseName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (subId: string) => void;
}

export const SubstitutionModal: React.FC<SubstitutionModalProps> = ({
  exerciseId,
  exerciseName,
  isOpen,
  onOpenChange,
  onConfirm,
}) => {
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && exerciseId) {
      const fetchSubs = async () => {
        setLoading(true);
        try {
          const data = await getSubstitutes(exerciseId);
          setSubstitutes(data);
        } catch (error) {
          console.error('Failed to fetch substitutes', error);
        } finally {
          setLoading(false);
        }
      };
      fetchSubs();
    }
  }, [isOpen, exerciseId]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight">Swap Exercise</DialogTitle>
          <DialogDescription>
            Can't do {exerciseName}? Pick an AI-recommended alternative.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : substitutes.length > 0 ? (
            substitutes.map((sub) => (
              <button
                key={sub._id}
                onClick={() => setSelectedId(sub._id)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                  selectedId === sub._id
                    ? 'border-primary bg-primary/5'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-primary/50 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <div>
                  <p className="font-bold text-foreground group-hover:text-primary transition-colors">{sub.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">{sub.category}</p>
                </div>
                {selectedId === sub._id && (
                  <div className="bg-primary text-primary-foreground rounded-full p-1 animate-in zoom-in-50">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center space-y-2">
               <Info className="h-8 w-8 opacity-20" />
               <p className="text-sm">No specific alternatives found for this exercise.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            className="w-full h-12 font-bold"
            disabled={!selectedId}
            onClick={() => selectedId && onConfirm(selectedId)}
          >
            Confirm Swap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
