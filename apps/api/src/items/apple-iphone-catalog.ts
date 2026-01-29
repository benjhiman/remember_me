/**
 * Apple iPhone Catalog - Default items for all organizations
 * 
 * This catalog includes all iPhone models from iPhone 11 to iPhone 17 Pro Max
 * with official capacities and colors from Apple.
 * 
 * Colors and capacities verified from:
 * - Apple Tech Specs (support.apple.com) for iPhone 11-16
 * - Apple Store (apple.com/shop/buy-iphone) for iPhone 17
 */

export interface AppleIphoneCatalogItem {
  brand: string;
  model: string;
  storageGb: number;
  color: string;
  condition: 'NEW' | 'USED' | 'OEM';
}

// Source of truth: official Apple specifications per model
const APPLE_IPHONE_MODELS: Array<{
  model: string;
  capacities: number[];
  colors: string[];
}> = [
  // iPhone 11
  {
    model: 'iPhone 11',
    capacities: [64, 128, 256],
    colors: ['Black', 'Green', 'Yellow', 'Purple', 'Red', 'White'],
  },
  // iPhone 11 Pro
  {
    model: 'iPhone 11 Pro',
    capacities: [64, 256, 512],
    colors: ['Space Gray', 'Silver', 'Gold', 'Midnight Green'],
  },
  // iPhone 11 Pro Max
  {
    model: 'iPhone 11 Pro Max',
    capacities: [64, 256, 512],
    colors: ['Space Gray', 'Silver', 'Gold', 'Midnight Green'],
  },
  // iPhone 12 mini
  {
    model: 'iPhone 12 mini',
    capacities: [64, 128, 256],
    colors: ['Black', 'White', 'Red', 'Green', 'Blue', 'Purple'],
  },
  // iPhone 12
  {
    model: 'iPhone 12',
    capacities: [64, 128, 256],
    colors: ['Black', 'White', 'Red', 'Green', 'Blue', 'Purple'],
  },
  // iPhone 12 Pro
  {
    model: 'iPhone 12 Pro',
    capacities: [128, 256, 512],
    colors: ['Graphite', 'Silver', 'Gold', 'Pacific Blue'],
  },
  // iPhone 12 Pro Max
  {
    model: 'iPhone 12 Pro Max',
    capacities: [128, 256, 512],
    colors: ['Graphite', 'Silver', 'Gold', 'Pacific Blue'],
  },
  // iPhone 13 mini
  {
    model: 'iPhone 13 mini',
    capacities: [128, 256, 512],
    colors: ['Pink', 'Blue', 'Midnight', 'Starlight', 'Red'],
  },
  // iPhone 13
  {
    model: 'iPhone 13',
    capacities: [128, 256, 512],
    colors: ['Pink', 'Blue', 'Midnight', 'Starlight', 'Red'],
  },
  // iPhone 13 Pro
  {
    model: 'iPhone 13 Pro',
    capacities: [128, 256, 512, 1024],
    colors: ['Graphite', 'Gold', 'Silver', 'Sierra Blue', 'Alpine Green'],
  },
  // iPhone 13 Pro Max
  {
    model: 'iPhone 13 Pro Max',
    capacities: [128, 256, 512, 1024],
    colors: ['Graphite', 'Gold', 'Silver', 'Sierra Blue', 'Alpine Green'],
  },
  // iPhone 14
  {
    model: 'iPhone 14',
    capacities: [128, 256, 512],
    colors: ['Blue', 'Purple', 'Midnight', 'Starlight', 'Red'],
  },
  // iPhone 14 Plus
  {
    model: 'iPhone 14 Plus',
    capacities: [128, 256, 512],
    colors: ['Blue', 'Purple', 'Midnight', 'Starlight', 'Red'],
  },
  // iPhone 14 Pro
  {
    model: 'iPhone 14 Pro',
    capacities: [128, 256, 512, 1024],
    colors: ['Deep Purple', 'Gold', 'Silver', 'Space Black'],
  },
  // iPhone 14 Pro Max
  {
    model: 'iPhone 14 Pro Max',
    capacities: [128, 256, 512, 1024],
    colors: ['Deep Purple', 'Gold', 'Silver', 'Space Black'],
  },
  // iPhone 15
  {
    model: 'iPhone 15',
    capacities: [128, 256, 512],
    colors: ['Pink', 'Yellow', 'Green', 'Blue', 'Black'],
  },
  // iPhone 15 Plus
  {
    model: 'iPhone 15 Plus',
    capacities: [128, 256, 512],
    colors: ['Pink', 'Yellow', 'Green', 'Blue', 'Black'],
  },
  // iPhone 15 Pro
  {
    model: 'iPhone 15 Pro',
    capacities: [128, 256, 512, 1024],
    colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'],
  },
  // iPhone 15 Pro Max
  {
    model: 'iPhone 15 Pro Max',
    capacities: [256, 512, 1024],
    colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'],
  },
  // iPhone 16
  {
    model: 'iPhone 16',
    capacities: [128, 256, 512],
    colors: ['Pink', 'Yellow', 'Green', 'Blue', 'Black', 'White'],
  },
  // iPhone 16 Plus
  {
    model: 'iPhone 16 Plus',
    capacities: [128, 256, 512],
    colors: ['Pink', 'Yellow', 'Green', 'Blue', 'Black', 'White'],
  },
  // iPhone 16 Pro
  {
    model: 'iPhone 16 Pro',
    capacities: [128, 256, 512, 1024],
    colors: ['Desert Titanium', 'Natural Titanium', 'White Titanium', 'Black Titanium'],
  },
  // iPhone 16 Pro Max
  {
    model: 'iPhone 16 Pro Max',
    capacities: [256, 512, 1024],
    colors: ['Desert Titanium', 'Natural Titanium', 'White Titanium', 'Black Titanium'],
  },
  // iPhone 17
  {
    model: 'iPhone 17',
    capacities: [256, 512],
    colors: ['Lavender', 'Sage', 'Mist Blue', 'White', 'Black'],
  },
  // iPhone 17 Air
  {
    model: 'iPhone 17 Air',
    capacities: [256, 512, 1024],
    colors: ['Sky Blue', 'Light Gold', 'Cloud White', 'Space Black'],
  },
  // iPhone 17 Pro
  {
    model: 'iPhone 17 Pro',
    capacities: [128, 256, 512, 1024],
    colors: ['Cosmic Orange', 'Deep Blue', 'Silver'],
  },
  // iPhone 17 Pro Max
  {
    model: 'iPhone 17 Pro Max',
    capacities: [256, 512, 1024, 2048],
    colors: ['Cosmic Orange', 'Deep Blue', 'Silver'],
  },
];

// Generate catalog from source of truth
export const APPLE_IPHONE_CATALOG: AppleIphoneCatalogItem[] = APPLE_IPHONE_MODELS.flatMap((model) =>
  model.capacities.flatMap((capacity) =>
    model.colors.flatMap((color) =>
      (['NEW', 'USED', 'OEM'] as const).map((condition) => ({
        brand: 'Apple', // Will be normalized to "APPLE" in seeder
        model: model.model,
        storageGb: capacity,
        color,
        condition,
      }))
    )
  )
);
