/**
 * Parser for bulk paste input
 * Parses lines like: "IPH13128NEWWHITE 20" or "iPhone 15 Pro 128GB 10"
 * Supports multiple formats:
 * - "MODELO 20"
 * - "MODELO x20" / "MODELO X 20"
 * - "20 MODELO"
 */

export interface ParsedLine {
  raw: string;
  query: string;
  queryClean: string; // Normalized query for matching
  quantity: number;
}

export interface ParseError {
  raw: string;
  reason: string;
}

export interface ParseResult {
  ok: ParsedLine[];
  error: ParseError[];
}

/**
 * Clean query by removing noise tokens and normalizing
 */
function cleanQuery(query: string): string {
  // Remove parentheses and their content
  let cleaned = query.replace(/\([^)]*\)/g, ' ');
  
  // Remove common noise tokens (case insensitive)
  const noiseTokens = [
    'SELLADO', 'ACTIVADO', 'SIN', 'CAJA', 'GARANTIA', 'C/', 'CON',
    'USADO', 'USED', 'NEW', 'SEAL', 'OPEN', 'SIN CAJA', 'CON CAJA',
  ];
  
  for (const token of noiseTokens) {
    const regex = new RegExp(`\\b${token}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  
  // Normalize: uppercase, multiple spaces to single, trim
  cleaned = cleaned
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned;
}

/**
 * Parse bulk paste text into lines with query and quantity
 */
export function parseBulkPaste(text: string): ParseResult {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const ok: ParsedLine[] = [];
  const error: ParseError[] = [];

  for (const line of lines) {
    let quantity: number | null = null;
    let query = '';

    // Try format 1: "MODELO x20" or "MODELO X 20"
    const xFormatMatch = line.match(/(.+?)\s*x\s*(\d+)\s*$/i);
    if (xFormatMatch) {
      query = xFormatMatch[1].trim();
      quantity = parseInt(xFormatMatch[2], 10);
    } else {
      // Try format 2: "20 MODELO" (quantity at start)
      const startQtyMatch = line.match(/^\s*(\d+)\s+(.+)$/);
      if (startQtyMatch) {
        quantity = parseInt(startQtyMatch[1], 10);
        query = startQtyMatch[2].trim();
      } else {
        // Try format 3: "MODELO 20" (quantity at end) - original format
        const endQtyMatch = line.match(/(.+?)\s+(\d+)\s*$/);
        if (endQtyMatch) {
          query = endQtyMatch[1].trim();
          // Remove trailing comma/period from quantity string
          const qtyStr = endQtyMatch[2].replace(/[,.]$/, '');
          quantity = parseInt(qtyStr, 10);
        }
      }
    }

    if (quantity === null || isNaN(quantity) || quantity < 1) {
      error.push({
        raw: line,
        reason: 'Falta cantidad o cantidad inválida',
      });
      continue;
    }

    // Clean quantity string (remove trailing separators)
    const qtyStr = quantity.toString().replace(/[,.]$/, '');
    quantity = parseInt(qtyStr, 10);
    
    if (isNaN(quantity) || quantity < 1) {
      error.push({
        raw: line,
        reason: 'Cantidad debe ser >= 1',
      });
      continue;
    }

    if (!query || query.length === 0) {
      error.push({
        raw: line,
        reason: 'Falta descripción del modelo',
      });
      continue;
    }

    // Clean query for matching
    const queryClean = cleanQuery(query);
    
    if (!queryClean || queryClean.length === 0) {
      error.push({
        raw: line,
        reason: 'Query vacío después de limpiar',
      });
      continue;
    }

    ok.push({
      raw: line,
      query: query.toUpperCase().replace(/\s+/g, ' ').trim(), // Original normalized
      queryClean, // Cleaned for matching
      quantity,
    });
  }

  return { ok, error };
}
