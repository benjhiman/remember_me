/**
 * Request ID utility for frontend observability
 * 
 * Generates and manages request IDs per request lifecycle.
 * Request IDs are used to correlate frontend requests with backend logs.
 */

let currentRequestId: string | null = null;

/**
 * Generate a new UUID v4 request ID
 */
function generateRequestId(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a request ID for the current request lifecycle
 * 
 * The request ID is scoped to the current request (not global).
 * For browser environments, this is typically per page load/refresh.
 * 
 * @returns Request ID string (UUID v4)
 */
export function getOrCreateRequestId(): string {
  if (!currentRequestId) {
    currentRequestId = generateRequestId();
  }
  return currentRequestId;
}

/**
 * Reset the current request ID (useful for testing or new request lifecycle)
 */
export function resetRequestId(): void {
  currentRequestId = null;
}

/**
 * Get the current request ID without creating a new one
 * 
 * @returns Current request ID or null if not set
 */
export function getCurrentRequestId(): string | null {
  return currentRequestId;
}
