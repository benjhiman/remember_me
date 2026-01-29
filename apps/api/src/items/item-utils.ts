/**
 * Item utility functions for SKU generation, sort key, and formatting
 */

import { ItemCondition } from '@remember-me/prisma';

/**
 * Generate model code from iPhone model string
 * Examples:
 * - "iPhone 15 Pro" => "15P"
 * - "iPhone 14 Pro Max" => "14PM"
 * - "iPhone 17 Air" => "17A"
 * - "iPhone 13" => "13"
 */
export function modelCode(model: string): string {
  const normalized = model.trim();
  
  // Extract number (11-17)
  const numberMatch = normalized.match(/(\d+)/);
  if (!numberMatch) {
    // Fallback: if no number, use model name
    if (normalized.includes('Air')) return 'AIR';
    return '';
  }
  
  const number = numberMatch[1];
  
  // Detect variant
  let variant = '';
  if (normalized.includes('Pro Max')) {
    variant = 'PM';
  } else if (normalized.includes('Pro')) {
    variant = 'P';
  } else if (normalized.includes('Plus')) {
    variant = 'PL';
  } else if (normalized.includes('Air')) {
    variant = 'A';
  }
  // base model has no variant (empty string)
  
  return `${number}${variant}`;
}

/**
 * Generate condition code
 */
export function conditionCode(condition: ItemCondition): string {
  switch (condition) {
    case 'NEW':
      return 'NEW';
    case 'USED':
      return 'USED';
    case 'OEM':
      return 'OEM';
    default:
      return condition.toUpperCase();
  }
}

/**
 * Generate color code (uppercase, remove spaces and non-alphanumeric)
 * Examples:
 * - "Alpine Green" => "ALPINEGREEN"
 * - "Natural Titanium" => "NATURALTITANIUM"
 */
export function colorCode(color: string): string {
  return color
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Generate SKU for an item
 * Format: IPH{modelCode}{storageGb}{conditionCode}{colorCode}
 * Examples:
 * - 15 Pro 128 NEW Silver => IPH15P128NEWSILVER
 * - 14 Pro Max 256 NEW Purple => IPH14PM256NEWPURPLE
 * - 13 128 USED Alpine Green => IPH13128USEDALPINEGREEN
 * - 16 Pro Max 512 OEM Desert => IPH16PM512OEMDESERT
 */
export function generateSku(
  model: string,
  storageGb: number,
  condition: ItemCondition,
  color: string
): string {
  const modelCodeStr = modelCode(model);
  const conditionCodeStr = conditionCode(condition);
  const colorCodeStr = colorCode(color);
  
  return `IPH${modelCodeStr}${storageGb}${conditionCodeStr}${colorCodeStr}`;
}

/**
 * Get variant rank for sorting
 * Pro Max = 0, Pro = 1, Air = 2, Plus = 3, base = 4
 */
export function variantRank(model: string): number {
  const normalized = model.toUpperCase();
  if (normalized.includes('PRO MAX')) return 0;
  if (normalized.includes('PRO')) return 1;
  if (normalized.includes('AIR')) return 2;
  if (normalized.includes('PLUS')) return 3;
  return 4; // base model
}

/**
 * Get condition rank for sorting
 * NEW = 0, OEM = 1, USED = 2
 */
export function conditionRank(condition: ItemCondition): number {
  switch (condition) {
    case 'NEW':
      return 0;
    case 'OEM':
      return 1;
    case 'USED':
      return 2;
    default:
      return 3;
  }
}

/**
 * Generate sort key for canonical ordering
 * Format: {modelRank}|{variantRank}|{storageRank}|{conditionRank}|{colorCode}
 * Where:
 * - modelRank: 999 - modelNumber (17 => 982, 11 => 988) - padStart(3)
 * - variantRank: 0-4 (padStart(1))
 * - storageRank: 9999 - storageGb (2048 => 7951, 128 => 9871) - padStart(4)
 * - conditionRank: 0-2 (padStart(1))
 * - colorCode: uppercase, no spaces
 */
export function generateSortKey(
  model: string,
  storageGb: number,
  condition: ItemCondition,
  color: string
): string {
  // Extract model number
  const numberMatch = model.match(/(\d+)/);
  const modelNumber = numberMatch ? parseInt(numberMatch[1], 10) : 0;
  const modelRank = (999 - modelNumber).toString().padStart(3, '0');
  
  const variantRankStr = variantRank(model).toString().padStart(1, '0');
  const storageRank = (9999 - storageGb).toString().padStart(4, '0');
  const conditionRankStr = conditionRank(condition).toString().padStart(1, '0');
  const colorCodeStr = colorCode(color);
  
  return `${modelRank}|${variantRankStr}|${storageRank}|${conditionRankStr}|${colorCodeStr}`;
}

/**
 * Get condition display label
 * NEW => "NEW"
 * USED => "Usado"
 * OEM => "OEM"
 */
export function conditionLabel(condition: ItemCondition | string | null): string {
  if (!condition) return '-';
  
  const cond = typeof condition === 'string' ? condition : condition;
  
  switch (cond) {
    case 'NEW':
      return 'NEW';
    case 'USED':
      return 'Usado';
    case 'OEM':
      return 'OEM';
    default:
      return cond.toString();
  }
}
