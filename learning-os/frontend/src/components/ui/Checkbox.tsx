import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    label?: string;
    onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, label, checked, onCheckedChange, ...props }, ref) => {
        return (
            <label className="flex items-center gap-3 cursor-pointer group select-none">
                <div className="relative">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={checked}
                        onChange={(e) => onCheckedChange?.(e.target.checked)}
                        ref={ref}
                        {...props}
                    />
                    <div className={cn(
                        "w-5 h-5 rounded-md border-2 transition-all duration-300 flex items-center justify-center",
                        "border-border-strong bg-console-bg",
                        "peer-checked:bg-accent-primary peer-checked:border-accent-primary",
                        "group-hover:border-accent-primary/50",
                        "shadow-inner",
                        className
                    )}>
                        <Check 
                            size={12} 
                            className={cn(
                                "text-white transition-all transform scale-0",
                                checked && "scale-100"
                            )} 
                            strokeWidth={4}
                        />
                    </div>
                </div>
                {label && (
                    <span className={cn(
                        "text-sm font-bold transition-colors",
                        checked ? "text-text-primary" : "text-text-muted group-hover:text-text-secondary"
                    )}>
                        {label}
                    </span>
                )}
            </label>
        );
    }
);

Checkbox.displayName = 'Checkbox';
