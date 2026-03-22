import React from "react"
import { cn } from "../../lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hover?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, hover = false, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "gcp-card md:backdrop-blur-sm transition-all duration-200 contain-content gpu-accelerated",
            hover && "gcp-card-hover",
            className
        )}
        {...props}
    />
))
Card.displayName = "Card"

export { Card }
