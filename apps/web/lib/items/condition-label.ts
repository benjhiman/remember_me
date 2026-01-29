/**
 * Condition label helper for UI display
 * NEW => "NEW"
 * USED => "Usado"
 * OEM => "OEM"
 */

export function conditionLabel(condition: string | null | undefined): string {
  if (!condition) return '-';
  
  switch (condition) {
    case 'NEW':
      return 'NEW';
    case 'USED':
      return 'Usado';
    case 'OEM':
      return 'OEM';
    default:
      return condition.toString();
  }
}
