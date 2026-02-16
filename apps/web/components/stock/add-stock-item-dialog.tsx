'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useItems } from '@/lib/api/hooks/use-items';
import { useItemSearchFlattened } from '@/lib/api/hooks/use-item-search';
import { useCreateStockEntry, StockEntryMode, type CreateStockEntryDto } from '@/lib/api/hooks/use-stock-entry-mutations';
import { useBulkAddStock, type BulkStockAddItem } from '@/lib/api/hooks/use-bulk-add-stock';
import { Loader2, Search, X, Plus, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { conditionLabel } from '@/lib/items/condition-label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { parseBulkPaste } from '@/lib/stock/bulk-paste-parser';
import { batchMatchQueries } from '@/lib/stock/bulk-item-matcher';
import { parseFile, type ImportRow } from '@/lib/stock/bulk-file-import';
import { cleanQuery } from '@/lib/stock/bulk-paste-parser';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText } from 'lucide-react';

// Component for each bulk row's item picker
function BulkRowItemPicker({
  row,
  onSelect,
  onUpdate,
  isLoading,
}: {
  row: BulkRow;
  onSelect: (itemId: string, item: any) => void;
  onUpdate: (updates: Partial<BulkRow>) => void;
  isLoading: boolean;
}) {
  const [rowSearchQuery, setRowSearchQuery] = useState('');

  const {
    items: rowItems,
    isLoading: rowItemsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useItemSearchFlattened({
    q: rowSearchQuery,
    limit: 20,
    enabled: row.isOpen || false,
  });

  const selectedItem = rowItems.find((i) => i.id === row.itemId);

  return (
    <div className="col-span-6 min-h-[64px] flex flex-col justify-start">
      <div className="flex-1">
        <Popover
          open={row.isOpen}
          onOpenChange={(open) => {
            onUpdate({ isOpen: open });
            if (!open) {
              setRowSearchQuery('');
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className={cn(
                'w-full h-10 justify-between text-sm font-normal',
                !row.itemId && 'text-muted-foreground'
              )}
              disabled={isLoading}
            >
              <span className="truncate text-left">
                {row.itemSearch || 'Buscar modelo...'}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-[520px] max-w-[calc(100vw-3rem)] p-0 pointer-events-auto" 
            align="start"
            style={{ pointerEvents: 'auto', zIndex: 99999 }}
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar modelo, SKU, marca..."
                value={rowSearchQuery}
                onValueChange={(value) => {
                  setRowSearchQuery(value);
                }}
              />
              <CommandList className="max-h-[300px] overflow-y-auto">
                {rowItemsLoading && rowItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Cargando items...
                  </div>
                ) : rowItems.length === 0 ? (
                  <CommandEmpty>
                    {rowSearchQuery ? 'No se encontraron items' : 'No hay items disponibles'}
                  </CommandEmpty>
                ) : (
                  <CommandGroup>
                    {rowItems.map((item) => {
                      const displayLabel =
                        item.model && item.storageGb && item.color && item.condition
                          ? `${item.brand || 'N/A'} ${item.model} ${item.storageGb}GB - ${item.color} - ${conditionLabel(item.condition)}`
                          : item.name || 'Item sin nombre';
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.id}
                          onSelect={() => {
                            onSelect(item.id, item);
                          }}
                          className="cursor-pointer min-h-[40px] flex items-center"
                        >
                          <div className="flex flex-col w-full">
                            <span className="font-medium truncate">{displayLabel}</span>
                            {item.sku && (
                              <span className="text-xs text-muted-foreground truncate">
                                SKU: {item.sku}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                    {hasNextPage && (
                      <div className="px-2 py-1.5 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchNextPage()}
                          disabled={isFetchingNextPage}
                          className="w-full"
                        >
                          {isFetchingNextPage ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Cargando más...
                            </>
                          ) : (
                            'Cargar más items'
                          )}
                        </Button>
                      </div>
                    )}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {selectedItem && (
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {selectedItem.sku && `SKU: ${selectedItem.sku}`}
        </div>
      )}
    </div>
  );
}

interface AddStockItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 1 | 2 | 3;
type EntryMode = StockEntryMode | 'BULK';

interface BulkRow {
  id: string;
  itemId: string;
  itemSearch: string;
  quantity: string;
  quantityError?: string;
  isOpen?: boolean; // For dropdown state per row
  itemSku?: string; // For debugging/validation
  itemName?: string; // For debugging/validation
}

export function AddStockItemDialog({ open, onOpenChange }: AddStockItemDialogProps) {
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<EntryMode | ''>('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [imeisText, setImeisText] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [quantityError, setQuantityError] = useState<string>('');
  const [condition, setCondition] = useState<'NEW' | 'USED' | 'REFURBISHED'>('NEW');
  const [status, setStatus] = useState<'AVAILABLE' | 'RESERVED' | 'SOLD' | 'DAMAGED' | 'RETURNED' | 'CANCELLED'>('AVAILABLE');
  const [cost, setCost] = useState<string>('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() => [
    { id: '1', itemId: '', itemSearch: '', quantity: '', isOpen: false },
    { id: '2', itemId: '', itemSearch: '', quantity: '', isOpen: false },
  ]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteProcessing, setPasteProcessing] = useState(false);
  const [pasteProgress, setPasteProgress] = useState({ current: 0, total: 0 });
  const [pasteSummary, setPasteSummary] = useState<{
    ok: number;
    pending: number;
    omitted: number;
  } | null>(null);
  const [pasteOmitNoMatch, setPasteOmitNoMatch] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importProcessing, setImportProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importSummary, setImportSummary] = useState<{
    ok: number;
    pending: number;
    omitted: number;
  } | null>(null);
  const [importOmitNoMatch, setImportOmitNoMatch] = useState(false);
  const [confirmSaveValidOpen, setConfirmSaveValidOpen] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bulk-save-dont-ask-again') === 'true';
    }
    return false;
  });

  const createStockEntry = useCreateStockEntry();
  const bulkAddStock = useBulkAddStock();
  const { toast } = useToast();

  // Fetch items for selection (enabled in step 2)
  const { data: itemsData, isLoading: itemsLoading } = useItems({
    q: itemSearch || undefined,
    limit: 50,
    enabled: open && step >= 2,
  });

  const items = itemsData?.data || [];

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const searchLower = itemSearch.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchLower) ||
        item.sku?.toLowerCase().includes(searchLower) ||
        item.brand?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower) ||
        item.model?.toLowerCase().includes(searchLower) ||
        item.color?.toLowerCase().includes(searchLower)
    );
  }, [items, itemSearch]);

  const selectedItem = items.find((item) => item.id === selectedItemId);

  // Parse IMEIs from textarea - each line must be exactly 15 digits
  const parsedImeis = useMemo(() => {
    if (!imeisText.trim()) return [];
    return imeisText
      .split('\n')
      .map((line) => line.trim().replace(/\s+/g, ''))
      .filter((imei) => imei.length === 15 && /^\d{15}$/.test(imei)); // Only valid 15-digit IMEIs
  }, [imeisText]);

  // Check for duplicate IMEIs in textarea
  const duplicateImeisInText = useMemo(() => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    parsedImeis.forEach((imei) => {
      if (seen.has(imei)) {
        duplicates.push(imei);
      } else {
        seen.add(imei);
      }
    });
    return duplicates;
  }, [parsedImeis]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setMode('');
      setItemSearch('');
      setSelectedItemId('');
      setImeisText('');
      setQuantity('');
      setQuantityError('');
      setCondition('NEW');
      setStatus('AVAILABLE');
      setCost('');
      setLocation('');
      setNotes('');
      setBulkNote('');
      setBulkRows([
        { id: '1', itemId: '', itemSearch: '', quantity: '', isOpen: false },
        { id: '2', itemId: '', itemSearch: '', quantity: '', isOpen: false },
      ]);
      setPasteOpen(false);
      setPasteText('');
      setPasteSummary(null);
      setPasteProcessing(false);
      setPasteProgress({ current: 0, total: 0 });
      setImportOpen(false);
      setImportFile(null);
      setImportPreview([]);
      setImportSummary(null);
      setImportProcessing(false);
      setImportProgress({ current: 0, total: 0 });
    }
  }, [open]);

  const handleNext = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (step === 1) {
      // Step 1: Mode selection -> Step 2: Item selection (or bulk mode)
      if (!mode) return;
      if (mode === 'BULK') {
        // Skip to step 3 for bulk mode (no item selection needed)
        setStep(3);
      } else {
        setStep(2);
      }
    } else if (step === 2) {
      // Step 2: Item selection -> Step 3: Data entry
      if (!selectedItemId) return;
      setStep(3);
    }
  };

  const handleBack = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      if (mode === 'BULK') {
        setStep(1); // Bulk mode skips step 2
      } else {
        setStep(2);
      }
    }
  };

  // Bulk mode helpers
  const addBulkRow = (row?: Partial<BulkRow>) => {
    setBulkRows((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        itemId: '',
        itemSearch: '',
        quantity: '',
        isOpen: false,
        ...row,
      },
    ]);
  };

  const handleAddBulkRow = () => {
    addBulkRow();
  };

  const handleFileSelect = async (file: File) => {
    setImportFile(file);
    try {
      const rows = await parseFile(file);
      setImportPreview(rows.slice(0, 10)); // Preview first 10 rows
    } catch (error) {
      console.error('[BulkImport] Error parsing file:', error);
      toast({
        variant: 'destructive',
        title: 'Error al leer archivo',
        description: error instanceof Error ? error.message : 'No se pudo leer el archivo',
      });
      setImportFile(null);
      setImportPreview([]);
    }
  };

  const handleImportProcess = async () => {
    if (!importFile) return;

    setImportProcessing(true);
    setImportProgress({ current: 0, total: 0 });

    try {
      // Parse file
      const rows = await parseFile(importFile);

      if (rows.length === 0) {
        setImportSummary({
          ok: 0,
          pending: 0,
          omitted: 0,
        });
        setImportProcessing(false);
        return;
      }

      // Convert to format for matching (with queryClean)
      const queries = rows.map((row) => ({
        query: row.query,
        queryClean: cleanQuery(row.query),
      }));

      // Batch match queries
      const matchResults = await batchMatchQueries(
        queries,
        (current, total) => {
          setImportProgress({ current, total });
        },
        { threshold: 30, ambiguousThreshold: 10 },
      );

      // Process results and add rows
      let okCount = 0;
      let pendingCount = 0;
      let omittedCount = 0;

      // Consolidate by itemId first (for duplicates)
      const consolidated = new Map<string, { itemId: string; quantity: number; itemName?: string; itemSku?: string }>();
      const pendingLines: Array<{ query: string; quantity: number }> = [];

      for (const row of rows) {
        // Try to get match by original query first, then by cleaned query
        const match = matchResults.get(row.query) || matchResults.get(cleanQuery(row.query));

        if (match?.item) {
          // Found match - consolidate
          const existing = consolidated.get(match.item.id) || {
            itemId: match.item.id,
            quantity: 0,
            itemName: match.item.name,
            itemSku: match.item.sku || undefined,
          };
          existing.quantity += row.quantity;
          consolidated.set(match.item.id, existing);
          okCount++;
        } else {
          // No match
          if (importOmitNoMatch) {
            omittedCount++;
          } else {
            pendingLines.push({ query: row.query, quantity: row.quantity });
            pendingCount++;
          }
        }
      }

      // Add consolidated rows with matches
      Array.from(consolidated.values()).forEach((data) => {
        const displayLabel =
          data.itemName || data.itemSku || `Item ${data.itemId.substring(0, 8)}`;
        addBulkRow({
          itemId: data.itemId,
          itemSearch: displayLabel,
          quantity: data.quantity.toString(),
          itemSku: data.itemSku,
          itemName: data.itemName,
        });
      });

      // Add pending rows (no match)
      for (const line of pendingLines) {
        addBulkRow({
          itemId: '',
          itemSearch: line.query,
          quantity: line.quantity.toString(),
          quantityError: 'Revisar modelo',
        });
      }

      setImportSummary({
        ok: okCount,
        pending: pendingCount,
        omitted: omittedCount,
      });

      // Close import modal after processing
      setImportOpen(false);
      setImportFile(null);
      setImportPreview([]);
    } catch (error) {
      console.error('[BulkImport] Error processing:', error);
      toast({
        variant: 'destructive',
        title: 'Error al procesar archivo',
        description: error instanceof Error ? error.message : 'No se pudo procesar el archivo',
      });
      setImportSummary({
        ok: 0,
        pending: 0,
        omitted: 0,
      });
    } finally {
      setImportProcessing(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const handlePasteProcess = async () => {
    if (!pasteText.trim()) {
      return;
    }

    setPasteProcessing(true);
    setPasteProgress({ current: 0, total: 0 });

    try {
      // Parse lines
      const parseResult = parseBulkPaste(pasteText);

      if (parseResult.ok.length === 0) {
        setPasteSummary({
          ok: 0,
          pending: 0,
          omitted: parseResult.error.length,
        });
        setPasteProcessing(false);
        return;
      }

      // Extract queries with cleaned versions for matching
      const queries = parseResult.ok.map((line) => ({
        query: line.query,
        queryClean: line.queryClean,
      }));
      
      // Batch match queries
      const matchResults = await batchMatchQueries(
        queries,
        (current, total) => {
          setPasteProgress({ current, total });
        },
        { threshold: 30, ambiguousThreshold: 10 },
      );

      // Process results and add rows
      let okCount = 0;
      let pendingCount = 0;
      let omittedCount = 0;

      // Consolidate by itemId first (for duplicates)
      const consolidated = new Map<string, { itemId: string; quantity: number; itemName?: string; itemSku?: string }>();
      const pendingLines: Array<{ query: string; quantity: number }> = [];

      for (const line of parseResult.ok) {
        // Try to get match by original query first, then by cleaned query
        const match = matchResults.get(line.query) || matchResults.get(line.queryClean);
        
        if (match?.item) {
          // Found match - consolidate
          const existing = consolidated.get(match.item.id) || {
            itemId: match.item.id,
            quantity: 0,
            itemName: match.item.name,
            itemSku: match.item.sku || undefined,
          };
          existing.quantity += line.quantity;
          consolidated.set(match.item.id, existing);
          okCount++;
        } else {
          // No match
          if (pasteOmitNoMatch) {
            omittedCount++;
          } else {
            pendingLines.push({ query: line.query, quantity: line.quantity });
            pendingCount++;
          }
        }
      }

      // Add consolidated rows with matches
      Array.from(consolidated.values()).forEach((data) => {
        const displayLabel =
          data.itemName || data.itemSku || `Item ${data.itemId.substring(0, 8)}`;
        addBulkRow({
          itemId: data.itemId,
          itemSearch: displayLabel,
          quantity: data.quantity.toString(),
          itemSku: data.itemSku,
          itemName: data.itemName,
        });
      });

      // Add pending rows (no match)
      for (const line of pendingLines) {
        addBulkRow({
          itemId: '',
          itemSearch: line.query,
          quantity: line.quantity.toString(),
          quantityError: 'Revisar modelo',
        });
      }

      setPasteSummary({
        ok: okCount,
        pending: pendingCount,
        omitted: omittedCount + parseResult.error.length,
      });

      // Close paste modal after processing
      setPasteOpen(false);
      setPasteText('');
    } catch (error) {
      console.error('[BulkPaste] Error processing:', error);
      setPasteSummary({
        ok: 0,
        pending: 0,
        omitted: 0,
      });
    } finally {
      setPasteProcessing(false);
      setPasteProgress({ current: 0, total: 0 });
    }
  };

  const removeBulkRow = (id: string) => {
    setBulkRows((prev) => prev.filter((row) => row.id !== id));
  };

  const updateBulkRow = (id: string, updates: Partial<BulkRow>) => {
    setBulkRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  // Note: Each row will have its own search query, so we don't fetch here
  // Instead, each row's autocomplete will fetch independently

  const handleBulkItemSelect = (rowId: string, itemId: string, item: any) => {
    // Debug log (dev only) - verify we're using the real ID
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[BulkAddStock] Item selected:', {
        rowId,
        itemId,
        item: {
          id: item.id,
          name: item.name,
          sku: item.sku,
          organizationId: item.organizationId,
        },
      });
    }

    // Ensure we're using the real ID field
    const realItemId = item.id || itemId;
    if (!realItemId) {
      console.error('[BulkAddStock] No ID found for item:', item);
      return;
    }

    const displayLabel =
      item.model && item.storageGb && item.color && item.condition
        ? `${item.brand || 'N/A'} ${item.model} ${item.storageGb}GB - ${item.color} - ${conditionLabel(item.condition)}`
        : item.name || 'Item sin nombre';
    updateBulkRow(rowId, {
      itemId: realItemId, // Use real ID
      itemSearch: displayLabel,
      itemSku: item.sku || undefined, // Store for debugging
      itemName: item.name || undefined, // Store for debugging
      quantityError: undefined, // Clear any previous errors
      isOpen: false, // Close dropdown after selection
    });
  };

  // Calculate row categories
  const validBulkRows = bulkRows.filter((row) => {
    const qty = parseInt(row.quantity || '0', 10);
    return row.itemId && row.quantity && !isNaN(qty) && qty >= 1;
  });
  const pendingBulkRows = bulkRows.filter((row) => {
    const qty = parseInt(row.quantity || '0', 10);
    return !row.itemId && row.quantity && !isNaN(qty) && qty >= 1 && row.itemSearch;
  });
  const invalidBulkRows = bulkRows.filter((row) => {
    if (!row.quantity) return false; // Empty row
    const qty = parseInt(row.quantity || '0', 10);
    return isNaN(qty) || qty < 1;
  });

  // Allow submit if there are valid rows and no invalid rows
  const canSubmitBulk = validBulkRows.length > 0 && invalidBulkRows.length === 0;

  const saveValidBulkRows = async () => {
    // Filter valid rows only (recalculate in case state changed)
    const currentValidRows = bulkRows.filter((row) => {
      const qty = parseInt(row.quantity || '0', 10);
      return row.itemId && row.quantity && !isNaN(qty) && qty >= 1;
    });
    const currentPendingRows = bulkRows.filter((row) => {
      const qty = parseInt(row.quantity || '0', 10);
      return !row.itemId && row.quantity && !isNaN(qty) && qty >= 1 && row.itemSearch;
    });

    // Consolidate duplicates
    const consolidated = new Map<string, number>();
    for (const row of currentValidRows) {
      const qty = parseInt(row.quantity || '0', 10);
      const current = consolidated.get(row.itemId) || 0;
      consolidated.set(row.itemId, current + qty);
    }

    // Convert to API format
    const items: BulkStockAddItem[] = Array.from(consolidated.entries()).map(([itemId, quantity]) => ({
      itemId,
      quantity,
    }));

    // Calculate total quantity for summary
    const totalQty = Array.from(consolidated.values()).reduce((sum, qty) => sum + qty, 0);

    // Debug log (dev only) - verify itemIds are real IDs
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[BulkAddStock] Submitting to POST /api/stock/bulk-add:', {
        items,
        note: bulkNote,
        source: 'manual',
      });
      console.debug('[BulkAddStock] Item IDs being sent:', items.map((i) => i.itemId));
    }

    try {
      await bulkAddStock.mutateAsync({
        items,
        note: bulkNote || undefined,
        source: 'manual',
      });

      // After success: keep only pending rows + 1 empty row
      const newRows = [
        ...currentPendingRows.map((row) => ({
          ...row,
          quantityError: undefined, // Clear any previous errors
          itemError: undefined,
        })),
        { id: Date.now().toString(), itemId: '', itemSearch: '', quantity: '', isOpen: false },
      ];
      setBulkRows(newRows);

      // Show success with pending info
      if (currentPendingRows.length > 0) {
        toast({
          title: 'Stock agregado',
          description: `Se guardaron ${currentValidRows.length} items (${totalQty} unidades). Quedan ${currentPendingRows.length} pendientes para revisar.`,
        });
      } else {
        // All rows were valid, close modal
        onOpenChange(false);
      }
    } catch (error: any) {
      // Error handled by mutation, but we can use the propagated info to mark rows
      if (error?.missingItemIds && error.missingItemIds.length > 0) {
        setBulkRows((prev) =>
          prev.map((row) => {
            if (error.missingItemIds.includes(row.itemId)) {
              return {
                ...row,
                itemError: 'Modelo inválido (no existe en tu org). Re-seleccioná.',
                itemId: '', // Clear itemId to force re-selection
                itemSearch: '', // Clear search text
              };
            }
            return row;
          }),
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mode) return;

    // Handle bulk mode
    if (mode === 'BULK') {
      // Check for invalid rows (quantity errors)
      if (invalidBulkRows.length > 0) {
        // Mark invalid rows with errors
        setBulkRows((prev) =>
          prev.map((r) => {
            const qty = parseInt(r.quantity || '0', 10);
            if (r.quantity && (isNaN(qty) || qty < 1)) {
              return { ...r, quantityError: 'Cantidad debe ser >= 1' };
            }
            return r;
          }),
        );
        toast({
          variant: 'destructive',
          title: 'Error de validación',
          description: 'Corregí las cantidades inválidas antes de guardar.',
        });
        return;
      }

      // Check if there are valid rows
      if (validBulkRows.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Agregá al menos 1 item válido antes de guardar.',
        });
        return;
      }

      // If there are pending rows, show confirmation (unless user chose "don't ask again")
      if (pendingBulkRows.length > 0 && !dontAskAgain) {
        setConfirmSaveValidOpen(true);
        return;
      }

      // Proceed with saving only valid rows
      await saveValidBulkRows();
      return;
    }

    // Handle single entry modes
    if (!selectedItemId) return;

    // Validate mode-specific fields
    if (mode === StockEntryMode.IMEI) {
      if (parsedImeis.length === 0) {
        return;
      }
      if (duplicateImeisInText.length > 0) {
        return;
      }
    } else if (mode === StockEntryMode.QUANTITY) {
      const quantityParsed = parseInt(quantity || '0', 10);
      if (isNaN(quantityParsed) || quantityParsed < 1) {
        setQuantityError('Debes ingresar una cantidad mayor o igual a 1');
        return;
      }
    }

    const dto: CreateStockEntryDto = {
      mode,
      itemId: selectedItemId,
      condition: 'NEW', // Default: backend will use this
      status: 'AVAILABLE', // Default: backend will use this
      location: location || undefined,
      notes: notes || undefined,
      ...(cost ? { cost: parseFloat(cost) } : {}),
      ...(mode === StockEntryMode.IMEI
        ? { imeis: parsedImeis }
        : { quantity: parseInt(quantity || '0', 10) }), // Ensure quantity is a number
    };

    // Debug logging (only in dev)
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[AddStockItemDialog] Submitting DTO:', {
        mode: dto.mode,
        itemId: dto.itemId,
        quantity: dto.quantity,
        imeisCount: dto.imeis?.length,
      });
    }

    try {
      await createStockEntry.mutateAsync(dto);
      // Reset form and close dialog
      setStep(1);
      setMode('');
      setItemSearch('');
      setSelectedItemId('');
      setImeisText('');
      setQuantity('');
      setQuantityError('');
      setCondition('NEW');
      setStatus('AVAILABLE');
      setCost('');
      setLocation('');
      setNotes('');
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = createStockEntry.isPending || bulkAddStock.isPending;

  const canProceedStep1 = !!mode; // Step 1: need mode selected
  const canProceedStep2 = !!selectedItemId; // Step 2: need item selected
  const canSubmitStep3 =
    mode === StockEntryMode.IMEI
      ? parsedImeis.length > 0 && duplicateImeisInText.length === 0
      : (() => {
          if (mode === StockEntryMode.QUANTITY) {
            const quantityParsed = parseInt(quantity || '0', 10);
            return !isNaN(quantityParsed) && quantityParsed >= 1;
          }
          return true;
        })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Agregar stock</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Elegí el modo de agregado'}
            {step === 2 && 'Seleccioná el item del catálogo'}
            {step === 3 && mode === 'BULK' && 'Agregá múltiples items a la vez'}
            {step === 3 && mode !== 'BULK' && 'Completá los datos del stock'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-180px)] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4">
            {/* Step 1: Mode Selection */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Modo de agregado</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => setMode('BULK')}
                      className={cn(
                        'p-4 border-2 rounded-lg text-left transition-colors',
                        mode === 'BULK'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="font-medium mb-1">Bulk (Múltiple)</div>
                      <div className="text-sm text-muted-foreground">
                        Agregar varios items a la vez
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode(StockEntryMode.IMEI)}
                      className={cn(
                        'p-4 border-2 rounded-lg text-left transition-colors',
                        mode === StockEntryMode.IMEI
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="font-medium mb-1">IMEI (Serializado)</div>
                      <div className="text-sm text-muted-foreground">
                        Para items con IMEI único (ej: iPhone)
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode(StockEntryMode.QUANTITY)}
                      className={cn(
                        'p-4 border-2 rounded-lg text-left transition-colors',
                        mode === StockEntryMode.QUANTITY
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="font-medium mb-1">Cantidad</div>
                      <div className="text-sm text-muted-foreground">
                        Para lotes sin IMEI (ej: accesorios)
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Item Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="item-search">Buscar item</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="item-search"
                      placeholder="Buscar por nombre, SKU, marca, categoría..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="pl-9"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {itemsLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!itemsLoading && filteredItems.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {itemSearch ? 'No se encontraron items' : 'No hay items disponibles'}
                  </div>
                )}

                {!itemsLoading && filteredItems.length > 0 && (
                  <div className="border rounded-md max-h-[300px] overflow-y-auto">
                    {filteredItems.map((item) => {
                      // Build display label: brand + model + storage + color + condition
                      const displayLabel =
                        item.model && item.storageGb && item.color && item.condition
                          ? `${item.brand || 'N/A'} ${item.model} ${item.storageGb}GB - ${item.color} - ${conditionLabel(item.condition)}`
                          : item.name || 'Item sin nombre';
                      const subtitle = [item.brand, item.category, item.sku].filter(Boolean).join(' • ') || undefined;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedItemId(item.id)}
                          className={cn(
                            'w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b last:border-b-0',
                            selectedItemId === item.id && 'bg-muted'
                          )}
                        >
                          <div className="font-medium">{displayLabel}</div>
                          {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedItem && (
                  <div className="p-3 bg-muted rounded-md">
                    <div className="text-sm font-medium">Item seleccionado:</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedItem.model && selectedItem.storageGb && selectedItem.color && selectedItem.condition
                        ? `${selectedItem.brand || 'N/A'} ${selectedItem.model} ${selectedItem.storageGb}GB - ${selectedItem.color} - ${conditionLabel(selectedItem.condition)}`
                        : selectedItem.name}
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* Step 3: Fields */}
            {step === 3 && (
              <div className="space-y-4">
                {mode === 'BULK' ? (
                  // BULK MODE: Only show bulk table, condition, status
                  <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Items a agregar</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPasteOpen(!pasteOpen)}
                            disabled={isLoading || pasteProcessing || importProcessing}
                          >
                            {pasteOpen ? (
                              <>
                                <X className="h-4 w-4 mr-1.5" />
                                Cerrar
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-1.5" />
                                Pegar lista
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setImportOpen(!importOpen)}
                            disabled={isLoading || pasteProcessing || importProcessing}
                          >
                            {importOpen ? (
                              <>
                                <X className="h-4 w-4 mr-1.5" />
                                Cerrar
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-1.5" />
                                Importar archivo
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Paste Modal/Accordion */}
                      {pasteOpen && (
                        <div className="border rounded-md p-4 bg-gray-50 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="paste-text">Pegá tu lista (una línea por item)</Label>
                            <Textarea
                              id="paste-text"
                              placeholder={`IPH13128NEWWHITE 20
IPH15P256USEDBLACK 11
SELLADO 16 128 TEAL (ACTIVADO) 5`}
                              value={pasteText}
                              onChange={(e) => setPasteText(e.target.value)}
                              rows={8}
                              className="font-mono text-sm"
                              disabled={pasteProcessing}
                            />
                            <div className="text-xs text-muted-foreground">
                              Formato: [descripción/modelo/SKU] [cantidad]
                              <br />
                              Ejemplo: IPH13128NEWWHITE 20
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="omit-no-match"
                              checked={pasteOmitNoMatch}
                              onCheckedChange={(checked) => setPasteOmitNoMatch(checked === true)}
                              disabled={pasteProcessing}
                            />
                            <Label htmlFor="omit-no-match" className="text-sm font-normal cursor-pointer">
                              Omitir líneas sin match
                            </Label>
                          </div>

                          {pasteProcessing && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Procesando {pasteProgress.current}/{pasteProgress.total}...
                            </div>
                          )}

                          {pasteSummary && (
                            <Alert>
                              <AlertDescription className="text-sm">
                                <div className="space-y-1">
                                  {pasteSummary.ok > 0 && (
                                    <div className="text-green-600">✓ {pasteSummary.ok} líneas procesadas</div>
                                  )}
                                  {pasteSummary.pending > 0 && (
                                    <div className="text-yellow-600">⚠ {pasteSummary.pending} líneas para revisar</div>
                                  )}
                                  {pasteSummary.omitted > 0 && (
                                    <div className="text-gray-600">⊘ {pasteSummary.omitted} líneas omitidas</div>
                                  )}
                                </div>
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={handlePasteProcess}
                              disabled={!pasteText.trim() || pasteProcessing}
                              className="flex-1"
                            >
                              {pasteProcessing ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Procesando...
                                </>
                              ) : (
                                'Procesar'
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setPasteText('');
                                setPasteSummary(null);
                              }}
                              disabled={pasteProcessing}
                            >
                              Limpiar
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Import File Modal/Accordion */}
                      {importOpen && (
                        <div className="border rounded-md p-4 bg-gray-50 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="import-file">Seleccioná un archivo CSV o Excel (.xlsx)</Label>
                            <div
                              className={cn(
                                'border-2 border-dashed rounded-md p-6 text-center transition-colors',
                                importFile
                                  ? 'border-primary bg-primary/5'
                                  : 'border-gray-300 hover:border-primary/50 cursor-pointer'
                              )}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const file = e.dataTransfer.files[0];
                                if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                                  handleFileSelect(file);
                                }
                              }}
                              onClick={() => {
                                if (!importFile) {
                                  document.getElementById('import-file-input')?.click();
                                }
                              }}
                            >
                              <input
                                id="import-file-input"
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleFileSelect(file);
                                  }
                                }}
                              />
                              {importFile ? (
                                <div className="space-y-2">
                                  <FileText className="h-8 w-8 mx-auto text-primary" />
                                  <div className="font-medium">{importFile.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {importPreview.length} fila{importPreview.length !== 1 ? 's' : ''} detectada{importPreview.length !== 1 ? 's' : ''}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setImportFile(null);
                                      setImportPreview([]);
                                    }}
                                  >
                                    Cambiar archivo
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                  <div className="text-sm text-muted-foreground">
                                    Arrastrá un archivo aquí o clickeá para seleccionar
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    CSV o Excel (.xlsx)
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {importPreview.length > 0 && (
                            <div className="space-y-2">
                              <Label>Vista previa (primeras {Math.min(10, importPreview.length)} filas)</Label>
                              <div className="border rounded-md max-h-[200px] overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">Modelo</th>
                                      <th className="px-3 py-2 text-left font-medium">Cantidad</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {importPreview.map((row, idx) => (
                                      <tr key={idx} className="border-b">
                                        <td className="px-3 py-2">{row.query}</td>
                                        <td className="px-3 py-2">{row.quantity}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="import-omit-no-match"
                              checked={importOmitNoMatch}
                              onCheckedChange={(checked) => setImportOmitNoMatch(checked === true)}
                              disabled={importProcessing}
                            />
                            <Label htmlFor="import-omit-no-match" className="text-sm font-normal cursor-pointer">
                              Omitir filas sin match
                            </Label>
                          </div>

                          {importProcessing && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Procesando {importProgress.current}/{importProgress.total}...
                            </div>
                          )}

                          {importSummary && (
                            <Alert>
                              <AlertDescription className="text-sm">
                                <div className="space-y-1">
                                  {importSummary.ok > 0 && (
                                    <div className="text-green-600">✓ {importSummary.ok} líneas procesadas</div>
                                  )}
                                  {importSummary.pending > 0 && (
                                    <div className="text-yellow-600">⚠ {importSummary.pending} líneas para revisar</div>
                                  )}
                                  {importSummary.omitted > 0 && (
                                    <div className="text-gray-600">⊘ {importSummary.omitted} líneas omitidas</div>
                                  )}
                                </div>
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={handleImportProcess}
                              disabled={!importFile || importProcessing}
                              className="flex-1"
                            >
                              {importProcessing ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Procesando...
                                </>
                              ) : (
                                'Procesar'
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setImportFile(null);
                                setImportPreview([]);
                                setImportSummary(null);
                              }}
                              disabled={importProcessing}
                            >
                              Limpiar
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="border rounded-md overflow-hidden">
                        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase">
                          <div className="col-span-6">Modelo</div>
                          <div className="col-span-4">Cantidad</div>
                          <div className="col-span-2 text-right">Acción</div>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                          {bulkRows.map((row, index) => {
                            const hasError = !row.itemId || !row.quantity || parseInt(row.quantity || '0', 10) < 1;
                            return (
                              <div key={row.id} className="border-b border-gray-200 px-4 py-3 grid grid-cols-[1fr_140px_56px] gap-3 items-start">
                                <BulkRowItemPicker
                                  row={row}
                                  onSelect={(itemId, item) => handleBulkItemSelect(row.id, itemId, item)}
                                  onUpdate={(updates) => updateBulkRow(row.id, updates)}
                                  isLoading={isLoading}
                                />
                                <div className="flex flex-col">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="0"
                                    value={row.quantity}
                                    onChange={(e) => {
                                      const digitsOnly = e.target.value.replace(/\D/g, '');
                                      updateBulkRow(row.id, {
                                        quantity: digitsOnly,
                                        quantityError: undefined,
                                      });
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && row.itemId && row.quantity) {
                                        e.preventDefault();
                                        handleAddBulkRow();
                                      }
                                    }}
                                    className={cn('h-10 text-sm', row.quantityError && 'border-destructive')}
                                    disabled={isLoading}
                                  />
                                  {row.quantityError && (
                                    <p className="text-xs text-destructive mt-1">{row.quantityError}</p>
                                  )}
                                  {!row.itemId && hasError && (
                                    <p className="text-xs text-destructive mt-1">Seleccioná un modelo</p>
                                  )}
                                </div>
                                <div className="flex justify-end pt-1">
                                  {bulkRows.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeBulkRow(row.id)}
                                      disabled={isLoading}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddBulkRow}
                        disabled={isLoading}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar fila
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bulk-note">Nota (opcional)</Label>
                      <Textarea
                        id="bulk-note"
                        value={bulkNote}
                        onChange={(e) => setBulkNote(e.target.value)}
                        placeholder="Ej: Compra proveedor X"
                        rows={2}
                        disabled={isLoading}
                      />
                    </div>
                    {validBulkRows.length > 0 && (
                      <div className="p-3 bg-muted rounded-md text-sm">
                        <div className="font-medium">Resumen:</div>
                        <div className="text-muted-foreground">
                          {validBulkRows.length} item{validBulkRows.length !== 1 ? 's' : ''} •{' '}
                          {validBulkRows.reduce((sum, row) => sum + parseInt(row.quantity || '0', 10), 0)} unidades
                        </div>
                      </div>
                    )}
                  </div>
                  </>
                ) : (
                  // MANUAL MODE: Show all fields (item selection already done in step 2)
                  <>
                    {mode === StockEntryMode.IMEI && (
                  <div className="space-y-2">
                    <Label htmlFor="imeis">
                      IMEIs (uno por línea) <span className="text-muted-foreground">({parsedImeis.length})</span>
                    </Label>
                    <Textarea
                      id="imeis"
                      placeholder="123456789012345&#10;123456789012346&#10;123456789012347"
                      value={imeisText}
                      onChange={(e) => {
                        // Extract only digits
                        const digitsOnly = e.target.value.replace(/\D/g, '');
                        // Chunk into groups of 15 digits
                        const chunks: string[] = [];
                        for (let i = 0; i < digitsOnly.length; i += 15) {
                          chunks.push(digitsOnly.slice(i, i + 15));
                        }
                        // Join with newlines
                        const formatted = chunks.join('\n');
                        setImeisText(formatted);
                      }}
                      rows={8}
                      disabled={isLoading}
                      className="font-mono text-sm"
                    />
                    {duplicateImeisInText.length > 0 && (
                      <div className="text-sm text-destructive">
                        IMEIs duplicados en la lista: {duplicateImeisInText.join(', ')}
                      </div>
                    )}
                    {parsedImeis.length > 0 && duplicateImeisInText.length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        {parsedImeis.length} IMEI{parsedImeis.length !== 1 ? 's' : ''} válido{parsedImeis.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setImeisText('')}
                      disabled={!imeisText || isLoading}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Limpiar
                    </Button>
                  </div>
                    )}

                    {mode === StockEntryMode.QUANTITY && (
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Cantidad *</Label>
                        <Input
                          id="quantity"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={quantity}
                          onChange={(e) => {
                            // Only allow digits
                            const digitsOnly = e.target.value.replace(/\D/g, '');
                            setQuantity(digitsOnly);
                            // Clear error when user types
                            if (quantityError) {
                              setQuantityError('');
                            }
                          }}
                          onWheel={(e) => {
                            // Prevent scroll wheel from changing value
                            e.currentTarget.blur();
                          }}
                          onBlur={() => {
                            // Validate on blur but don't auto-fill
                            const quantityParsed = parseInt(quantity || '0', 10);
                            if (isNaN(quantityParsed) || quantityParsed < 1) {
                              setQuantityError('Debes ingresar una cantidad mayor o igual a 1');
                            } else {
                              setQuantityError('');
                            }
                          }}
                          placeholder="Ingresá la cantidad (ej: 20)"
                          disabled={isLoading}
                          className={cn('text-lg font-medium', quantityError && 'border-destructive')}
                          autoFocus
                        />
                        <p className="text-xs text-muted-foreground">Solo números. Mínimo: 1</p>
                        {quantityError && (
                          <p className="text-xs text-destructive">{quantityError}</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cost">Costo (opcional)</Label>
                        <Input
                          id="cost"
                          type="number"
                          step="0.01"
                          min="0"
                          value={cost}
                          onChange={(e) => setCost(e.target.value)}
                          placeholder="0.00"
                          disabled={isLoading}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="location">Ubicación (opcional)</Label>
                        <Input
                          id="location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Almacén A"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notas (opcional)</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notas adicionales..."
                        rows={3}
                        disabled={isLoading}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

            <DialogFooter>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                      Atrás
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                    Cancelar
                  </Button>
                  {step < 3 ? (
                    <Button 
                      type="button" 
                      onClick={handleNext} 
                      disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2) || isLoading}
                    >
                      Siguiente
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={
                        (mode === 'BULK' ? !canSubmitBulk : !canSubmitStep3) || isLoading
                      }
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        'Guardar'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>

      {/* Confirm Save Valid Only Dialog */}
      <Dialog open={confirmSaveValidOpen} onOpenChange={setConfirmSaveValidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar solo items válidos</DialogTitle>
            <DialogDescription>
              Se guardarán {validBulkRows.length} items ({Array.from(validBulkRows).reduce((sum, r) => sum + parseInt(r.quantity || '0', 10), 0)} unidades totales).
              <br />
              Quedan {pendingBulkRows.length} pendientes para revisar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dont-ask-again"
                checked={dontAskAgain}
                onCheckedChange={(checked) => {
                  setDontAskAgain(checked === true);
                  if (checked) {
                    localStorage.setItem('bulk-save-dont-ask-again', 'true');
                  } else {
                    localStorage.removeItem('bulk-save-dont-ask-again');
                  }
                }}
              />
              <Label htmlFor="dont-ask-again" className="text-sm font-normal cursor-pointer">
                No volver a preguntar
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmSaveValidOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={async () => {
                setConfirmSaveValidOpen(false);
                await saveValidBulkRows();
              }}
            >
              Guardar válidos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
