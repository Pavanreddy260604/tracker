/**
 * Haptic feedback utility using the Web Vibration API.
 * Gracefully degrades to no-op on unsupported browsers (desktop).
 */
type HapticType = 'success' | 'warning' | 'impact' | 'light';

const patterns: Record<HapticType, number[]> = {
  success: [10, 50, 10],      // short-pause-short (double tap)
  warning: [100],              // single long vibration
  impact: [30],                // short strong tap
  light: [5],                  // ultralight tap
};

export function vibrate(type: HapticType = 'light'): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(patterns[type]);
  }
}
