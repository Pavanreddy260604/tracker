import { clsx, type ClassValue } from 'clsx';

/**
 * Merge class names with clsx
 */
export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get today's date string in YYYY-MM-DD format
 */
export function getTodayString(): string {
    return formatDate(new Date());
}

/**
 * Format hours for display (e.g., "6.5h")
 */
export function formatHours(hours: number): string {
    return `${hours}h`;
}

/**
 * Format percentage (e.g., "85%")
 */
export function formatPercent(value: number): string {
    return `${Math.round(value)}%`;
}

/**
 * Get day name from date string
 */
export function getDayName(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Get relative date label (Today, Yesterday, or date)
 */
export function getRelativeDate(dateStr: string): string {
    const today = getTodayString();
    const yesterday = formatDate(new Date(Date.now() - 86400000));

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';

    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Delay for animations
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    ms: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), ms);
    };
}
