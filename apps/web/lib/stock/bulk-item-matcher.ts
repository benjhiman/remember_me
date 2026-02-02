/**
 * Intelligent item matcher for bulk paste
 * Uses scoring system to find best match from API results
 */

import { api } from '../api/auth-client';
import type { Item } from '../api/hooks/use-item-search';

export interface MatchResult {
  item: Item | null;
  score: number;
  reason: string;
}

export interface MatchOptions {
  threshold?: number; // Minimum score to consider a match (default: 30)
  ambiguousThreshold?: number; // If best and second-best are within this, mark as ambiguous (default: 10)
}

/**
 * Find best matching item for a query
 */
export async function findBestMatch(
  query: string,
  organizationId?: string,
  options: MatchOptions = {},
): Promise<MatchResult> {
  const { threshold = 30, ambiguousThreshold = 10 } = options;

  if (!query || query.trim().length === 0) {
    return {
      item: null,
      score: 0,
      reason: 'Query vacío',
    };
  }

  try {
    // Call API to search items
    const response = await api.get<{
      data: Item[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(`/items?q=${encodeURIComponent(query)}&page=1&limit=20`);

    const items = response.data || [];

    if (items.length === 0) {
      return {
        item: null,
        score: 0,
        reason: 'No se encontraron items',
      };
    }

    // Score each item
    const scored = items.map((item) => {
      let score = 0;
      const reasons: string[] = [];

      // Normalize query and item fields for comparison
      const queryUpper = query.toUpperCase();
      const skuUpper = (item.sku || '').toUpperCase();
      const nameUpper = (item.name || '').toUpperCase();
      const modelUpper = (item.model || '').toUpperCase();

      // +100 if SKU exact match
      if (skuUpper === queryUpper) {
        score += 100;
        reasons.push('SKU exacto');
      } else if (skuUpper && queryUpper.includes(skuUpper)) {
        score += 80;
        reasons.push('SKU parcial');
      }

      // +50 if name starts with query
      if (nameUpper.startsWith(queryUpper)) {
        score += 50;
        reasons.push('Nombre empieza con');
      }

      // +20 if name includes query
      if (nameUpper.includes(queryUpper)) {
        score += 20;
        reasons.push('Nombre contiene');
      }

      // +20 if model includes query
      if (modelUpper && modelUpper.includes(queryUpper)) {
        score += 20;
        reasons.push('Modelo contiene');
      }

      // Token overlap bonus
      const queryTokens = queryUpper.split(/\s+/).filter((t) => t.length > 0);
      const itemTokens = [
        ...nameUpper.split(/\s+/),
        ...(modelUpper ? modelUpper.split(/\s+/) : []),
        ...(skuUpper ? skuUpper.split(/\s+/) : []),
      ].filter((t) => t.length > 0);

      const overlap = queryTokens.filter((qt) => itemTokens.some((it) => it.includes(qt) || qt.includes(it))).length;
      score += overlap * 5;
      if (overlap > 0) {
        reasons.push(`${overlap} tokens coinciden`);
      }

      return {
        item,
        score,
        reasons: reasons.join(', '),
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const secondBest = scored[1];

    // Check if score is above threshold
    if (best.score < threshold) {
      return {
        item: null,
        score: best.score,
        reason: `Mejor match tiene score bajo (${best.score} < ${threshold})`,
      };
    }

    // Check if ambiguous (best and second-best too close)
    if (secondBest && best.score - secondBest.score < ambiguousThreshold) {
      return {
        item: best.item,
        score: best.score,
        reason: `Match ambiguo (mejor: ${best.score}, segundo: ${secondBest.score}). Revisar manualmente.`,
      };
    }

    return {
      item: best.item,
      score: best.score,
      reason: `Match encontrado (${best.reasons})`,
    };
  } catch (error) {
    console.error('[findBestMatch] Error searching items:', error);
    return {
      item: null,
      score: 0,
      reason: 'Error al buscar items',
    };
  }
}

/**
 * Batch match multiple queries with deduplication
 */
export async function batchMatchQueries(
  queries: string[],
  onProgress?: (current: number, total: number) => void,
  options: MatchOptions = {},
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>();
  const uniqueQueries = Array.from(new Set(queries));

  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < uniqueQueries.length; i += batchSize) {
    const batch = uniqueQueries.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (query) => {
        const result = await findBestMatch(query, undefined, options);
        results.set(query, result);
      }),
    );

    if (onProgress) {
      onProgress(Math.min(i + batchSize, uniqueQueries.length), uniqueQueries.length);
    }
  }

  return results;
}
