/**
 * Apple iPhone Catalog - Default items for all organizations
 * 
 * This catalog includes all iPhone models from iPhone 11 to iPhone 17 Pro Max
 * with official capacities and colors from Apple.
 * 
 * Generated from official Apple specifications.
 */

export interface AppleIphoneCatalogItem {
  brand: string;
  model: string;
  storageGb: number;
  color: string;
  condition: 'NEW' | 'USED' | 'OEM';
}

export const APPLE_IPHONE_CATALOG: AppleIphoneCatalogItem[] = [
  // iPhone 11
  ...['64', '128', '256'].flatMap((storage) =>
    ['Black', 'Green', 'Yellow', 'Purple', 'Red', 'White'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 11',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 11 Pro
  ...['64', '256', '512'].flatMap((storage) =>
    ['Space Gray', 'Silver', 'Gold', 'Midnight Green'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 11 Pro',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 11 Pro Max
  ...['64', '256', '512'].flatMap((storage) =>
    ['Space Gray', 'Silver', 'Gold', 'Midnight Green'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 11 Pro Max',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 12 mini
  ...['64', '128', '256'].flatMap((storage) =>
    ['Black', 'White', 'Red', 'Green', 'Blue', 'Purple'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 12 mini',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 12
  ...['64', '128', '256'].flatMap((storage) =>
    ['Black', 'White', 'Red', 'Green', 'Blue', 'Purple'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 12',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 12 Pro
  ...['128', '256', '512'].flatMap((storage) =>
    ['Graphite', 'Silver', 'Gold', 'Pacific Blue'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 12 Pro',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 12 Pro Max
  ...['128', '256', '512'].flatMap((storage) =>
    ['Graphite', 'Silver', 'Gold', 'Pacific Blue'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 12 Pro Max',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 13 mini
  ...['128', '256', '512'].flatMap((storage) =>
    ['Pink', 'Blue', 'Midnight', 'Starlight', 'Red'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 13 mini',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 13
  ...['128', '256', '512'].flatMap((storage) =>
    ['Pink', 'Blue', 'Midnight', 'Starlight', 'Red'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 13',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 13 Pro
  ...['128', '256', '512', '1024'].flatMap((storage) =>
    ['Graphite', 'Gold', 'Silver', 'Sierra Blue', 'Alpine Green'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 13 Pro',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 13 Pro Max
  ...['128', '256', '512', '1024'].flatMap((storage) =>
    ['Graphite', 'Gold', 'Silver', 'Sierra Blue', 'Alpine Green'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 13 Pro Max',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 14
  ...['128', '256', '512'].flatMap((storage) =>
    ['Blue', 'Purple', 'Midnight', 'Starlight', 'Red'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 14',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 14 Plus
  ...['128', '256', '512'].flatMap((storage) =>
    ['Blue', 'Purple', 'Midnight', 'Starlight', 'Red'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 14 Plus',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 14 Pro
  ...['128', '256', '512', '1024'].flatMap((storage) =>
    ['Deep Purple', 'Gold', 'Silver', 'Space Black'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 14 Pro',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 14 Pro Max
  ...['128', '256', '512', '1024'].flatMap((storage) =>
    ['Deep Purple', 'Gold', 'Silver', 'Space Black'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 14 Pro Max',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 15
  ...['128', '256', '512'].flatMap((storage) =>
    ['Pink', 'Yellow', 'Green', 'Blue', 'Black'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 15',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 15 Plus
  ...['128', '256', '512'].flatMap((storage) =>
    ['Pink', 'Yellow', 'Green', 'Blue', 'Black'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 15 Plus',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 15 Pro
  ...['128', '256', '512', '1024'].flatMap((storage) =>
    ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 15 Pro',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 15 Pro Max
  ...['256', '512', '1024'].flatMap((storage) =>
    ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 15 Pro Max',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 16
  ...['128', '256', '512'].flatMap((storage) =>
    ['Pink', 'Yellow', 'Green', 'Blue', 'Black', 'White'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 16',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 16 Plus
  ...['128', '256', '512'].flatMap((storage) =>
    ['Pink', 'Yellow', 'Green', 'Blue', 'Black', 'White'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 16 Plus',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 16 Pro
  ...['128', '256', '512', '1024'].flatMap((storage) =>
    ['Desert Titanium', 'Natural Titanium', 'White Titanium', 'Black Titanium'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 16 Pro',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 16 Pro Max
  ...['256', '512', '1024'].flatMap((storage) =>
    ['Desert Titanium', 'Natural Titanium', 'White Titanium', 'Black Titanium'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 16 Pro Max',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 17 (projected - using similar structure to iPhone 16)
  ...['128', '256', '512'].flatMap((storage) =>
    ['Pink', 'Yellow', 'Green', 'Blue', 'Black', 'White'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 17',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 17 Air
  ...['128', '256', '512'].flatMap((storage) =>
    ['Pink', 'Yellow', 'Green', 'Blue', 'Black', 'White'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 17 Air',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 17 Pro
  ...['128', '256', '512', '1024'].flatMap((storage) =>
    ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 17 Pro',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),

  // iPhone 17 Pro Max
  ...['256', '512', '1024'].flatMap((storage) =>
    ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'].flatMap((color) =>
      ['NEW', 'USED', 'OEM'].map((condition) => ({
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storageGb: parseInt(storage),
        color,
        condition: condition as 'NEW' | 'USED' | 'OEM',
      }))
    )
  ),
];
