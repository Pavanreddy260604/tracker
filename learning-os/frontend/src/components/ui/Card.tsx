import React from "react"
import { cn } from "../../lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hover?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, hover = false, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "rounded-xl bg-white dark:bg-transparent dark:bg-gradient-to-b dark:from-white/[0.08] dark:to-white/[0.02] border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-xl backdrop-blur-md",
            hover && "hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300 hover:shadow-md dark:hover:shadow-2xl hover:-translate-y-0.5",
            className
        )}
        {...props}
    />
))
Card.displayName = "Card"

export { Card }
