'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreatePriceList, usePriceList } from '@/lib/api/hooks/use-price-lists';
import { useItemFolders } from '@/lib/api/hooks/use-item-folders';
import { useItems } from '@/lib/api/hooks/use-items';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { BulkPricingStep } from './bulk-pricing-step';

interface CreatePriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (priceListId: string) => void;
}

export function CreatePriceListDialog({ open, onOpenChange, onSuccess }: CreatePriceListDialogProps) {
  const createPriceList = useCreatePriceList();
  const { data: foldersData } = useItemFolders(open);
  const { data: itemsData } = useItems({ enabled: open, limit: 1000 });

  const [step, setStep] = useState<'config' | 'pricing'>('config');
  const [createdPriceListId, setCreatedPriceListId] = useState<string | null>(null);
  const { data: createdPriceList } = usePriceList(createdPriceListId);

  const [name, setName] = useState('');
  const [mode, setMode] = useState<'ALL' | 'FOLDERS' | 'ITEMS'>('ALL');
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemsSearch, setItemsSearch] = useState('');

  const folders = foldersData?.data || [];
  const items = itemsData?.data || [];

  useEffect(() => {
    if (!open) {
      setName('');
      setMode('ALL');
      setSelectedFolderIds([]);
      setSelectedItemIds([]);
      setItemsSearch('');
      setStep('config');
      setCreatedPriceListId(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    try {
      const result = await createPriceList.mutateAsync({
        name: name.trim(),
        mode,
        folderIds: mode === 'FOLDERS' ? selectedFolderIds : undefined,
        itemIds: mode === 'ITEMS' ? selectedItemIds : undefined,
      });

      // Move to pricing step
      setCreatedPriceListId(result.id);
      setStep('pricing');
    } catch (error) {
      // Error handled by hook
    }
  };

  const toggleFolder = (folderId: string) => {
    setSelectedFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId],
    );
  };

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  };

  const removeFolder = (folderId: string) => {
    setSelectedFolderIds((prev) => prev.filter((id) => id !== folderId));
  };

  const removeItem = (itemId: string) => {
    setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
  };

  const filteredItems = itemsSearch
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(itemsSearch.toLowerCase()) ||
          item.sku?.toLowerCase().includes(itemsSearch.toLowerCase()),
      )
    : items;

  const selectedFolders = folders.filter((f) => selectedFolderIds.includes(f.id));
  const selectedItems = items.filter((i) => selectedItemIds.includes(i.id));

  const handlePricingComplete = () => {
    onOpenChange(false);
    setTimeout(() => {
      if (createdPriceListId) {
        onSuccess(createdPriceListId);
      }
    }, 100);
  };

  const handlePricingSkip = () => {
    onOpenChange(false);
    setTimeout(() => {
      if (createdPriceListId) {
        onSuccess(createdPriceListId);
      }
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'config' ? 'Crear Lista de Precios' : 'Asignar Precios'}
          </DialogTitle>
          <DialogDescription>
            {step === 'config'
              ? 'Creá una nueva lista de precios para agrupar y gestionar precios de tus productos.'
              : 'Asigná precios a los items de la lista. Podés hacerlo ahora o más tarde.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'config' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Público, Mayorista"
              required
            />
          </div>

          {/* Mode */}
          <div className="space-y-3">
            <Label>Alcance de items</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ALL" id="mode-all" />
                <Label htmlFor="mode-all" className="font-normal cursor-pointer">
                  Todos los items
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="FOLDERS" id="mode-folders" />
                <Label htmlFor="mode-folders" className="font-normal cursor-pointer">
                  Por carpetas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ITEMS" id="mode-items" />
                <Label htmlFor="mode-items" className="font-normal cursor-pointer">
                  Seleccionar items
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Folder Selection */}
          {mode === 'FOLDERS' && (
            <div className="space-y-2">
              <Label>Carpetas</Label>
              <Popover open={foldersOpen} onOpenChange={setFoldersOpen} modal={false}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    Seleccionar carpetas ({selectedFolderIds.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start" onInteractOutside={(e) => {
                  // Don't close when clicking inside
                  e.preventDefault();
                }}>
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Buscar carpetas..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron carpetas.</CommandEmpty>
                      <CommandGroup>
                        {folders.map((folder) => (
                          <CommandItem
                            key={folder.id}
                            value={folder.id}
                            onSelect={() => {
                              // Toggle folder selection
                              toggleFolder(folder.id);
                            }}
                            className="cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedFolderIds.includes(folder.id)}
                              onCheckedChange={() => {
                                toggleFolder(folder.id);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="mr-2 pointer-events-auto"
                            />
                            <span className="flex-1">
                              {folder.name} ({folder.count} {folder.count === 1 ? 'item' : 'items'})
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedFolders.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedFolders.map((folder) => (
                    <Badge key={folder.id} variant="secondary" className="flex items-center gap-1">
                      {folder.name}
                      <button
                        type="button"
                        onClick={() => removeFolder(folder.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Item Selection */}
          {mode === 'ITEMS' && (
            <div className="space-y-2">
              <Label>Items</Label>
              <Popover open={itemsOpen} onOpenChange={setItemsOpen} modal={false}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    Seleccionar items ({selectedItemIds.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start" onInteractOutside={(e) => {
                  // Don't close when clicking inside
                  e.preventDefault();
                }}>
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar por nombre o SKU..."
                      value={itemsSearch}
                      onValueChange={setItemsSearch}
                    />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>No se encontraron items.</CommandEmpty>
                      <CommandGroup>
                        {filteredItems.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={item.id}
                            onSelect={() => {
                              // Toggle item selection
                              toggleItem(item.id);
                            }}
                            className="cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedItemIds.includes(item.id)}
                              onCheckedChange={() => {
                                toggleItem(item.id);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="mr-2 pointer-events-auto"
                            />
                            <div className="flex-1">
                              <div className="font-medium">{item.name}</div>
                              {item.sku && <div className="text-xs text-muted-foreground">{item.sku}</div>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedItems.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedItems.map((item) => (
                    <Badge key={item.id} variant="secondary" className="flex items-center gap-1">
                      {item.name}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createPriceList.isPending || !name.trim()}>
                {createPriceList.isPending ? 'Creando...' : 'Crear y asignar precios'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          createdPriceList && (
            <BulkPricingStep
              priceListId={createdPriceListId!}
              items={createdPriceList.items}
              onComplete={handlePricingComplete}
              onSkip={handlePricingSkip}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
