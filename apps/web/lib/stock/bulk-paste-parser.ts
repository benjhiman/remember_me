/**
 * Parser for bulk paste input
 * Parses lines like: "IPH13128NEWWHITE 20" or "iPhone 15 Pro 128GB 10"
 */

export interface ParsedLine {
  raw: string;
  query: string;
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
    // Extract quantity: last integer in the line
    const quantityMatch = line.match(/(\d+)\s*$/);
    
    if (!quantityMatch) {
      error.push({
        raw: line,
        reason: 'Falta cantidad',
      });
      continue;
    }

    const quantity = parseInt(quantityMatch[1], 10);
    if (isNaN(quantity) || quantity < 1) {
      error.push({
        raw: line,
        reason: 'Cantidad debe ser >= 1',
      });
      continue;
    }

    // Extract query: everything before the last number
    const query = line
      .substring(0, quantityMatch.index)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .trim();

    if (!query || query.length === 0) {
      error.push({
        raw: line,
        reason: 'Falta descripción del modelo',
      });
      continue;
    }

    ok.push({
      raw: line,
      query,
      quantity,
    });
  }

  return { ok, error };
}
