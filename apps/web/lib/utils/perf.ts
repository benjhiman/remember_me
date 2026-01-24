/**
 * Simple performance measurement utilities
 * Only logs in dev or when NEXT_PUBLIC_PERF_LOG=1
 */

const isPerfLogEnabled = () => {
  if (typeof window === 'undefined') return false;
  return process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_PERF_LOG === '1';
};

/**
 * Mark a performance point
 */
export function perfMark(name: string): void {
  if (!isPerfLogEnabled() || typeof window === 'undefined' || !window.performance) return;
  
  try {
    window.performance.mark(name);
  } catch (error) {
    // Silently fail if marks are not supported
  }
}

/**
 * Measure time between two marks
 */
export function perfMeasure(name: string, startMark: string, endMark: string): void {
  if (!isPerfLogEnabled() || typeof window === 'undefined' || !window.performance) return;
  
  try {
    window.performance.measure(name, startMark, endMark);
    const measures = window.performance.getEntriesByName(name, 'measure');
    if (measures.length > 0) {
      const duration = measures[0].duration;
      console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
    }
  } catch (error) {
    // Silently fail if measures are not supported
  }
}

/**
 * Measure time from a mark to now
 */
export function perfMeasureToNow(name: string, startMark: string): void {
  if (!isPerfLogEnabled() || typeof window === 'undefined' || !window.performance) return;
  
  try {
    const endMark = `${name}-end`;
    window.performance.mark(endMark);
    perfMeasure(name, startMark, endMark);
    window.performance.clearMarks(endMark);
  } catch (error) {
    // Silently fail
  }
}
