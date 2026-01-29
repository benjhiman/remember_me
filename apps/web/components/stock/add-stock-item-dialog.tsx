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
import { useCreateStockEntry, StockEntryMode, type CreateStockEntryDto } from '@/lib/api/hooks/use-stock-entry-mutations';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface AddStockItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 1 | 2 | 3;

export function AddStockItemDialog({ open, onOpenChange }: AddStockItemDialogProps) {
  const [step, setStep] = useState<Step>(1);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [mode, setMode] = useState<StockEntryMode | ''>('');
  const [imeisText, setImeisText] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [condition, setCondition] = useState<'NEW' | 'USED' | 'REFURBISHED'>('NEW');
  const [status, setStatus] = useState<'AVAILABLE' | 'RESERVED' | 'SOLD' | 'DAMAGED' | 'RETURNED' | 'CANCELLED'>('AVAILABLE');
  const [cost, setCost] = useState<string>('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const createStockEntry = useCreateStockEntry();

  // Fetch items for selection
  const { data: itemsData, isLoading: itemsLoading } = useItems({
    q: itemSearch || undefined,
    limit: 50,
    enabled: open && step === 1,
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
        item.category?.toLowerCase().includes(searchLower)
    );
  }, [items, itemSearch]);

  const selectedItem = items.find((item) => item.id === selectedItemId);

  // Parse IMEIs from textarea
  const parsedImeis = useMemo(() => {
    if (!imeisText.trim()) return [];
    return imeisText
      .split('\n')
      .map((line) => line.trim().replace(/\s+/g, ''))
      .filter((imei) => imei.length > 0);
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
      setItemSearch('');
      setSelectedItemId('');
      setMode('');
      setImeisText('');
      setQuantity(1);
      setCondition('NEW');
      setStatus('AVAILABLE');
      setCost('');
      setLocation('');
      setNotes('');
    }
  }, [open]);

  const handleNext = () => {
    if (step === 1) {
      if (!selectedItemId) return;
      setStep(2);
    } else if (step === 2) {
      if (!mode) return;
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItemId || !mode) return;

    // Validate mode-specific fields
    if (mode === StockEntryMode.IMEI) {
      if (parsedImeis.length === 0) {
        return;
      }
      if (duplicateImeisInText.length > 0) {
        return;
      }
    } else if (mode === StockEntryMode.QUANTITY) {
      if (quantity < 1) {
        return;
      }
    }

    const dto: CreateStockEntryDto = {
      mode,
      itemId: selectedItemId,
      condition,
      status,
      location: location || undefined,
      notes: notes || undefined,
      ...(cost ? { cost: parseFloat(cost) } : {}),
      ...(mode === StockEntryMode.IMEI
        ? { imeis: parsedImeis }
        : { quantity }),
    };

    try {
      await createStockEntry.mutateAsync(dto);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = createStockEntry.isPending;

  const canProceedStep1 = !!selectedItemId;
  const canProceedStep2 = !!mode;
  const canSubmitStep3 =
    mode === StockEntryMode.IMEI
      ? parsedImeis.length > 0 && duplicateImeisInText.length === 0
      : quantity >= 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar stock</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Seleccioná el item del catálogo'}
            {step === 2 && 'Elegí el modo de agregado'}
            {step === 3 && 'Completá los datos del stock'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Step 1: Item Selection */}
            {step === 1 && (
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
                    {filteredItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                        className={cn(
                          'w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b last:border-b-0',
                          selectedItemId === item.id && 'bg-muted'
                        )}
                      >
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {[item.brand, item.category, item.sku].filter(Boolean).join(' • ')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedItem && (
                  <div className="p-3 bg-muted rounded-md">
                    <div className="text-sm font-medium">Item seleccionado:</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedItem.name} {selectedItem.brand && `• ${selectedItem.brand}`}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Mode Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Modo de agregado</Label>
                  <div className="grid grid-cols-2 gap-4">
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

            {/* Step 3: Fields */}
            {step === 3 && (
              <div className="space-y-4">
                {mode === StockEntryMode.IMEI && (
                  <div className="space-y-2">
                    <Label htmlFor="imeis">
                      IMEIs (uno por línea) <span className="text-muted-foreground">({parsedImeis.length})</span>
                    </Label>
                    <Textarea
                      id="imeis"
                      placeholder="123456789012345&#10;123456789012346&#10;123456789012347"
                      value={imeisText}
                      onChange={(e) => setImeisText(e.target.value)}
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
                    <Label htmlFor="quantity">Cantidad</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                      disabled={isLoading}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="condition">Condición</Label>
                    <Select value={condition} onValueChange={(v) => setCondition(v as any)} disabled={isLoading}>
                      <SelectTrigger id="condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEW">Nuevo</SelectItem>
                        <SelectItem value="USED">Usado</SelectItem>
                        <SelectItem value="REFURBISHED">Reacondicionado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Estado</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as any)} disabled={isLoading}>
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AVAILABLE">Disponible</SelectItem>
                        <SelectItem value="RESERVED">Reservado</SelectItem>
                        <SelectItem value="SOLD">Vendido</SelectItem>
                        <SelectItem value="DAMAGED">Dañado</SelectItem>
                        <SelectItem value="RETURNED">Devuelto</SelectItem>
                        <SelectItem value="CANCELLED">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

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
                  <Button type="button" onClick={handleNext} disabled={!canProceedStep1 && !canProceedStep2 || isLoading}>
                    Siguiente
                  </Button>
                ) : (
                  <Button type="submit" disabled={!canSubmitStep3 || isLoading}>
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
      </DialogContent>
    </Dialog>
  );
}
