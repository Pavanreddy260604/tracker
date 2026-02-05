import React from "react"
import { cn } from "../../lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hover?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, hover = false, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "surface-card backdrop-blur-sm transition-all duration-300",
            hover && "hover:border-[color:var(--border-strong)] hover:shadow-[var(--elevation-2)] hover:-translate-y-0.5",
            className
        )}
        {...props}
    />
))
Card.displayName = "Card"

export { Card }
