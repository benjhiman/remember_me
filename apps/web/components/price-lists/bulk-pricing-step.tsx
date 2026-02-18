'use client';

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBulkUpdatePriceListItems } from '@/lib/api/hooks/use-price-lists';
import type { PriceListItem } from '@/lib/api/hooks/use-price-lists';

interface BulkPricingStepProps {
  priceListId: string;
  items: PriceListItem[];
  onComplete: () => void;
  onSkip: () => void;
}

export function BulkPricingStep({ priceListId, items, onComplete, onSkip }: BulkPricingStepProps) {
  const bulkUpdate = useBulkUpdatePriceListItems();
  const [prices, setPrices] = useState<Record<string, string>>({});

  // Group items by condition
  const groupedItems = useMemo(() => {
    const groups: Record<string, PriceListItem[]> = {
      NEW: [],
      USED: [],
      OEM: [],
      UNKNOWN: [],
    };

    items.forEach((item) => {
      const condition = item.condition || 'UNKNOWN';
      if (groups[condition]) {
        groups[condition].push(item);
      } else {
        groups.UNKNOWN.push(item);
      }
    });

    // Sort each group by displayName
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.displayName.localeCompare(b.displayName));
    });

    return groups;
  }, [items]);

  const handlePriceChange = (itemId: string, value: string) => {
    setPrices((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleBulkSet = (condition: string, value: string) => {
    const newPrices: Record<string, string> = { ...prices };
    groupedItems[condition].forEach((item) => {
      newPrices[item.id] = value;
    });
    setPrices(newPrices);
  };

  const handleSave = async () => {
    const itemsToUpdate = Object.entries(prices)
      .filter(([_, value]) => value.trim() !== '')
      .map(([itemId, value]) => {
        const numValue = parseFloat(value);
        return {
          priceListItemId: itemId,
          basePrice: !isNaN(numValue) && isFinite(numValue) ? numValue : null,
        };
      })
      .filter((item) => item.basePrice !== null); // Only include items with valid prices

    if (itemsToUpdate.length === 0) {
      onComplete();
      return;
    }

    try {
      await bulkUpdate.mutateAsync({
        priceListId,
        items: itemsToUpdate,
      });
      onComplete();
    } catch (error) {
      // Error handled by hook
    }
  };

  const conditionLabels: Record<string, string> = {
    NEW: 'Nuevos',
    USED: 'Usados',
    OEM: 'OEM',
    UNKNOWN: 'Otros',
  };

  const conditionOrder = ['NEW', 'USED', 'OEM', 'UNKNOWN'];

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Asigná precios a los items de la lista. Podés hacerlo individualmente o por condición.
      </div>

      <div className="max-h-[500px] overflow-y-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Precio Base</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conditionOrder.map((condition) => {
              const conditionItems = groupedItems[condition];
              if (conditionItems.length === 0) return null;

              return (
                <React.Fragment key={condition}>
                  {/* Condition Header */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold">
                      {conditionLabels[condition]} ({conditionItems.length})
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Precio para todos"
                        className="w-32 ml-auto"
                        onChange={(e) => handleBulkSet(condition, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                  {/* Items in this condition */}
                  {conditionItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.displayName}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={prices[item.id] || ''}
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                          placeholder="0.00"
                          className="w-32 ml-auto"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onSkip} disabled={bulkUpdate.isPending}>
          Saltar por ahora
        </Button>
        <Button onClick={handleSave} disabled={bulkUpdate.isPending}>
          {bulkUpdate.isPending ? 'Guardando...' : 'Guardar y continuar'}
        </Button>
      </div>
    </div>
  );
}
