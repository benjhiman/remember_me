'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { useCustomers } from '@/lib/api/hooks/use-customers';
import { useCreateCustomer } from '@/lib/api/hooks/use-customer-mutations';
import { usePriceLists, usePriceList } from '@/lib/api/hooks/use-price-lists';
import { useItemSearchFlattened } from '@/lib/api/hooks/use-item-search';
import { useStockItems } from '@/lib/api/hooks/use-stock-items';
import { useStockReservations } from '@/lib/api/hooks/use-stock-reservations';
import { useAuthStore } from '@/lib/store/auth-store';
import { Plus, X, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils/cn';
import { conditionLabel } from '@/lib/items/condition-label';
import type { Sale } from '@/types/sales';

const saleItemSchema = z.object({
  stockItemId: z.string().optional(),
  model: z.string().min(1, 'El modelo es requerido'),
  quantity: z.number().min(1, 'La cantidad debe ser al menos 1'),
  unitPrice: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
});

const createSaleSchema = z.object({
  stockReservationIds: z.array(z.string()).optional(),
  customerName: z.string().min(1, 'El nombre del cliente es requerido'),
  customerEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  customerCity: z.string().optional(),
  customerAddress: z.string().optional(),
  customerInstagram: z.string().optional(),
  customerWeb: z.string().optional(),
  location: z.string().optional(),
  saleNumber: z.string().optional(),
  priceListId: z.string().optional(),
  discount: z.number().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'Debe agregar al menos un item'),
});

type CreateSaleFormData = z.infer<typeof createSaleSchema>;

interface SaleFormZohoProps {
  sale?: Sale;
  onSubmit: (data: CreateSaleFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SaleFormZoho({ sale, onSubmit, onCancel, isLoading }: SaleFormZohoProps) {
  const { user } = useAuthStore();
  const { data: customersData } = useCustomers({ limit: 100, enabled: true });
  const { data: priceListsData } = usePriceLists();
  const { data: stockData } = useStockItems({ limit: 10000, enabled: true });
  const { data: reservationsData } = useStockReservations({ status: 'ACTIVE', limit: 100, enabled: true });
  const createCustomer = useCreateCustomer();

  // Local storage for location
  const [savedLocation, setSavedLocation] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sale-location') || 'Principal';
    }
    return 'Principal';
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isConsumidorFinal, setIsConsumidorFinal] = useState(false);
  const [createCustomerDialogOpen, setCreateCustomerDialogOpen] = useState(false);
  const [reservationSelectOpen, setReservationSelectOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [invoiceNumberMode, setInvoiceNumberMode] = useState<'auto' | 'manual'>('auto');
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('');

  const invoiceDate = new Date();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateSaleFormData>({
    resolver: zodResolver(createSaleSchema),
    defaultValues: {
      customerName: sale?.customerName || '',
      customerEmail: sale?.customerEmail || '',
      customerPhone: sale?.customerPhone || '',
      customerCity: (sale as any)?.customerCity || (sale?.metadata as any)?.customerCity || '',
      location: sale?.metadata?.location || savedLocation,
      saleNumber: sale?.saleNumber || undefined,
      priceListId: undefined,
      discount: sale?.discount ? parseFloat(sale.discount) : undefined,
      currency: sale?.currency || 'USD',
      notes: sale?.notes || '',
      items: sale?.items?.map((item) => ({
        stockItemId: item.stockItemId || undefined,
        model: item.model,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice.toString()),
      })) || [
        {
          model: '',
          quantity: 1,
          unitPrice: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const items = watch('items');
  const discount = watch('discount') || 0;
  const priceListId = watch('priceListId');
  const location = watch('location');
  const { data: selectedPriceList } = usePriceList(priceListId || null);

  // Save location to localStorage when it changes
  useEffect(() => {
    if (location && typeof window !== 'undefined') {
      localStorage.setItem('sale-location', location);
      setSavedLocation(location);
    }
  }, [location]);

  // Calculate subtotal
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);
  }, [items]);

  // Calculate total
  const total = useMemo(() => {
    return subtotal - discount;
  }, [subtotal, discount]);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!customersData?.items) return [];
    const searchLower = customerSearch.toLowerCase();
    return customersData.items.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchLower) ||
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.phone?.includes(customerSearch)
    );
  }, [customersData, customerSearch]);

  // Handle customer selection
  const handleCustomerSelect = (customerId: string | 'consumidor-final') => {
    if (customerId === 'consumidor-final') {
      setIsConsumidorFinal(true);
      setSelectedCustomerId(null);
      setValue('customerName', '');
      setCustomerSearchOpen(false);
    } else {
      const customer = customersData?.items.find((c) => c.id === customerId);
      if (customer) {
        setSelectedCustomerId(customer.id);
        setIsConsumidorFinal(false);
        setValue('customerName', customer.name);
        setValue('customerEmail', customer.email || '');
        setValue('customerPhone', customer.phone || '');
        setCustomerSearchOpen(false);
        setCustomerSearch('');
      }
    }
  };

  // Handle price list change - apply prices to items
  useEffect(() => {
    if (priceListId && selectedPriceList?.items && items.length > 0) {
      items.forEach((item, index) => {
        // Find matching price list item by model/displayName
        const priceListItem = selectedPriceList.items.find((pli) => {
          const itemModelLower = item.model.toLowerCase();
          const pliNameLower = pli.displayName.toLowerCase();
          return pliNameLower.includes(itemModelLower) || itemModelLower.includes(pliNameLower.split(' ')[0]);
        });

        if (priceListItem && priceListItem.basePrice !== null && priceListItem.basePrice !== undefined) {
          setValue(`items.${index}.unitPrice`, priceListItem.basePrice);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceListId, selectedPriceList, items.length]);

  // Handle reservation selection
  const handleReservationSelect = (reservationId: string) => {
    setSelectedReservationId(reservationId);
    const reservation = reservationsData?.data.find((r) => r.id === reservationId);
    if (reservation && reservation.stockItem) {
      // Find full stock item to get price
      const fullStockItem = stockData?.data.find((si) => si.id === reservation.stockItemId);
      const unitPrice = fullStockItem?.basePrice ? parseFloat(fullStockItem.basePrice.toString()) : 0;
      
      // Add item from reservation
      append({
        stockItemId: reservation.stockItemId,
        model: reservation.stockItem.model,
        quantity: reservation.quantity,
        unitPrice,
      });
      setReservationSelectOpen(false);
    }
  };

  // Item search for each row
  function ItemPicker({ index }: { index: number }) {
    const [itemSearch, setItemSearch] = useState('');
    const [itemPickerOpen, setItemPickerOpen] = useState(false);
    const { items: searchItems, isLoading: itemsLoading } = useItemSearchFlattened({
      q: itemSearch,
      limit: 50,
      enabled: itemPickerOpen,
    });

    // Get stock items for this item
    const itemModel = watch(`items.${index}.model`);
    const stockItemsForModel = useMemo(() => {
      if (!itemModel || !stockData?.data) return [];
      return stockData.data.filter((si) => {
        const modelMatch = si.model?.toLowerCase().includes(itemModel.toLowerCase());
        const skuMatch = si.sku?.toLowerCase().includes(itemModel.toLowerCase());
        return modelMatch || skuMatch;
      });
    }, [itemModel]);

    const totalStock = useMemo(() => {
      return stockItemsForModel.reduce((sum, si) => sum + (si.quantity || 0), 0);
    }, [stockItemsForModel]);

    // Filter items by search
    const filteredSearchItems = useMemo(() => {
      if (!itemSearch.trim()) return searchItems.slice(0, 50);
      const searchLower = itemSearch.toLowerCase();
      return searchItems.filter((item) => {
        const displayName = item.model && item.storageGb && item.color && item.condition
          ? `${item.brand || ''} ${item.model} ${item.storageGb}GB - ${item.color} - ${conditionLabel(item.condition)}`
          : item.name || '';
        return (
          displayName.toLowerCase().includes(searchLower) ||
          item.sku?.toLowerCase().includes(searchLower) ||
          item.brand?.toLowerCase().includes(searchLower) ||
          item.model?.toLowerCase().includes(searchLower)
        );
      });
    }, [searchItems, itemSearch]);

    const handleItemSelect = (item: any) => {
      const displayName = item.model && item.storageGb && item.color && item.condition
        ? `${item.brand || ''} ${item.model} ${item.storageGb}GB - ${item.color} - ${conditionLabel(item.condition)}`
        : item.name || item.model || '';

      setValue(`items.${index}.model`, displayName);

      // Try to find stock item and price
      // Match by SKU first, then by model/storage/color
      const stockItem = stockData?.data.find((si) => {
        if (item.sku && si.sku && si.sku === item.sku) return true;
        if (si.model === item.model && si.storage === `${item.storageGb}GB` && si.color === item.color) return true;
        return false;
      });

      if (stockItem) {
        setValue(`items.${index}.stockItemId`, stockItem.id);
        // Apply price from price list if selected, otherwise use stock basePrice
        if (priceListId && selectedPriceList?.items) {
          const priceListItem = selectedPriceList.items.find((pli) => {
            const pliNameLower = pli.displayName.toLowerCase();
            const itemNameLower = displayName.toLowerCase();
            return pliNameLower.includes(itemNameLower.split(' ')[0]) || itemNameLower.includes(pliNameLower.split(' ')[0]);
          });
          if (priceListItem?.basePrice !== null && priceListItem?.basePrice !== undefined) {
            setValue(`items.${index}.unitPrice`, priceListItem.basePrice);
          } else if (stockItem.basePrice) {
            setValue(`items.${index}.unitPrice`, parseFloat(stockItem.basePrice.toString()));
          }
        } else if (stockItem.basePrice) {
          setValue(`items.${index}.unitPrice`, parseFloat(stockItem.basePrice.toString()));
        }
      } else if (priceListId && selectedPriceList?.items) {
        // Try to find price from price list even without stock
        const priceListItem = selectedPriceList.items.find((pli) => {
          const pliNameLower = pli.displayName.toLowerCase();
          const itemNameLower = displayName.toLowerCase();
          return pliNameLower.includes(itemNameLower.split(' ')[0]) || itemNameLower.includes(pliNameLower.split(' ')[0]);
        });
        if (priceListItem?.basePrice !== null && priceListItem?.basePrice !== undefined) {
          setValue(`items.${index}.unitPrice`, priceListItem.basePrice);
        }
      }

      setItemPickerOpen(false);
      setItemSearch('');
    };

    return (
      <div className="space-y-1">
        <Popover open={itemPickerOpen} onOpenChange={setItemPickerOpen} modal={false}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left font-normal"
              onClick={() => setItemPickerOpen(true)}
            >
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              {itemModel || 'Type or click to select an item.'}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[500px] p-0"
            align="start"
            side="bottom"
            sideOffset={8}
            collisionPadding={10}
            collisionBoundary={document.querySelector('[data-radix-dialog-content]') || undefined}
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar por SKU, modelo, marca..."
                value={itemSearch}
                onValueChange={setItemSearch}
              />
              <CommandList className="max-h-[300px]">
                <CommandEmpty>
                  {itemsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Cargando...
                    </div>
                  ) : (
                    'No se encontraron items.'
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {filteredSearchItems.map((item) => {
                    const displayName = item.model && item.storageGb && item.color && item.condition
                      ? `${item.brand || ''} ${item.model} ${item.storageGb}GB - ${item.color} - ${conditionLabel(item.condition)}`
                      : item.name || item.model || 'Item sin nombre';

                    // Get stock for this item
                    const itemStockItems = stockData?.data.filter((si) => {
                      if (item.sku && si.sku && si.sku === item.sku) return true;
                      if (si.model === item.model && si.storage === `${item.storageGb}GB` && si.color === item.color) return true;
                      return false;
                    }) || [];
                    const stockQty = itemStockItems.reduce((sum, si) => sum + (si.quantity || 0), 0);

                    return (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => handleItemSelect(item)}
                        className="cursor-pointer"
                      >
                        <div className="flex-1 w-full min-w-0">
                          <div className="font-medium truncate">{displayName}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {item.sku && <span>SKU: {item.sku}</span>}
                            <span className={stockQty > 0 ? 'text-green-600' : 'text-red-600'}>
                              Stock: {stockQty} pcs
                            </span>
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {itemModel && totalStock !== undefined && (
          <div className="text-xs text-muted-foreground">
            Stock disponible: <span className={totalStock > 0 ? 'text-green-600' : 'text-red-600'}>{totalStock} pcs</span>
          </div>
        )}
      </div>
    );
  }

  // Create customer dialog
  function CreateCustomerDialog() {
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerEmail, setNewCustomerEmail] = useState('');
    const [newCustomerCity, setNewCustomerCity] = useState('');
    const [newCustomerAddress, setNewCustomerAddress] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [newCustomerInstagram, setNewCustomerInstagram] = useState('');
    const [newCustomerWeb, setNewCustomerWeb] = useState('');

    const handleCreateCustomer = async () => {
      if (!newCustomerName.trim() || !newCustomerCity.trim() || !newCustomerPhone.trim()) {
        return;
      }

      try {
        const customer = await createCustomer.mutateAsync({
          name: newCustomerName,
          email: newCustomerEmail || undefined,
          phone: newCustomerPhone,
          city: newCustomerCity,
          address: newCustomerAddress || undefined,
          instagram: newCustomerInstagram || undefined,
          web: newCustomerWeb || undefined,
        });

        // Select the newly created customer
        handleCustomerSelect(customer.id);
        setCreateCustomerDialogOpen(false);
        // Reset form
        setNewCustomerName('');
        setNewCustomerEmail('');
        setNewCustomerCity('');
        setNewCustomerAddress('');
        setNewCustomerPhone('');
        setNewCustomerInstagram('');
        setNewCustomerWeb('');
      } catch (error) {
        // Error handled by hook
      }
    };

    return (
      <Dialog open={createCustomerDialogOpen} onOpenChange={setCreateCustomerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Cliente</DialogTitle>
            <DialogDescription>Agregá un nuevo cliente a tu base de datos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-red-500">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div>
              <Label className="text-red-500">
                Ciudad <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newCustomerCity}
                onChange={(e) => setNewCustomerCity(e.target.value)}
                placeholder="Ciudad"
              />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input
                value={newCustomerAddress}
                onChange={(e) => setNewCustomerAddress(e.target.value)}
                placeholder="Dirección"
              />
            </div>
            <div>
              <Label className="text-red-500">
                Teléfono <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div>
              <Label>Instagram</Label>
              <Input
                value={newCustomerInstagram}
                onChange={(e) => setNewCustomerInstagram(e.target.value)}
                placeholder="@usuario"
              />
            </div>
            <div>
              <Label>Página Web</Label>
              <Input
                value={newCustomerWeb}
                onChange={(e) => setNewCustomerWeb(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCustomerDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCustomer}
              disabled={!newCustomerName.trim() || !newCustomerCity.trim() || !newCustomerPhone.trim() || createCustomer.isPending}
            >
              {createCustomer.isPending ? 'Creando...' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const handleFormSubmit = (data: CreateSaleFormData) => {
    const submitData = {
      ...data,
      saleNumber: invoiceNumberMode === 'manual' && manualInvoiceNumber ? manualInvoiceNumber : undefined,
      stockReservationIds: selectedReservationId ? [selectedReservationId] : undefined,
    };
    onSubmit(submitData);
  };

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Reservation Selection (at the top) */}
        {!sale && reservationsData?.data && reservationsData.data.length > 0 && (
          <div className="border rounded-lg p-4 bg-blue-50/50">
            <Label className="mb-2 block">Seleccionar Reserva de Stock (Opcional)</Label>
            <Popover open={reservationSelectOpen} onOpenChange={setReservationSelectOpen} modal={false}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start">
                  {selectedReservationId
                    ? `Reserva seleccionada: ${reservationsData.data.find((r) => r.id === selectedReservationId)?.stockItem?.model || ''}`
                    : 'Seleccionar reserva existente...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start" side="bottom" sideOffset={8}>
                <Command>
                  <CommandInput placeholder="Buscar reserva..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No se encontraron reservas.</CommandEmpty>
                    <CommandGroup>
                      {reservationsData.data.map((reservation) => (
                        <CommandItem
                          key={reservation.id}
                          value={reservation.id}
                          onSelect={() => handleReservationSelect(reservation.id)}
                          className="cursor-pointer"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{reservation.stockItem?.model || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">
                              Cantidad: {reservation.quantity} | {reservation.stockItem?.sku || 'Sin SKU'}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Header Section */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-red-500">
              Vendedor <span className="text-red-500">*</span>
            </Label>
            <Input value={user?.name || ''} disabled className="bg-gray-50" />
          </div>
          <div>
            <Label className="text-red-500">
              Cliente <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen} modal={false}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="flex-1 justify-start">
                    <Search className="mr-2 h-4 w-4" />
                    {isConsumidorFinal
                      ? 'Consumidor Final'
                      : selectedCustomerId
                        ? customersData?.items.find((c) => c.id === selectedCustomerId)?.name || 'Buscar cliente...'
                        : watch('customerName') || 'Buscar cliente...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start" side="bottom" sideOffset={8}>
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar cliente..."
                      value={customerSearch}
                      onValueChange={setCustomerSearch}
                    />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="consumidor-final"
                          onSelect={() => handleCustomerSelect('consumidor-final')}
                          className="cursor-pointer font-medium"
                        >
                          Consumidor Final
                        </CommandItem>
                        {filteredCustomers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.id}
                            onSelect={() => handleCustomerSelect(customer.id)}
                            className="cursor-pointer"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{customer.name}</div>
                              {customer.email && (
                                <div className="text-xs text-muted-foreground">{customer.email}</div>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCreateCustomerDialogOpen(true)}
                title="Crear nuevo cliente"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {isConsumidorFinal && (
              <Input
                {...register('customerName')}
                placeholder="Nombre del consumidor final"
                className="mt-2"
              />
            )}
            {errors.customerName && (
              <p className="text-sm text-red-500 mt-1">{errors.customerName.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Ubicación</Label>
            <Input
              {...register('location')}
              placeholder="Principal"
              defaultValue="Principal"
            />
          </div>
          <div>
            <Label>Fecha</Label>
            <Input
              value={format(invoiceDate, 'dd MMM yyyy', { locale: es })}
              disabled
              className="bg-gray-50"
            />
          </div>
        </div>

        <div>
          <Label>Número de Invoice</Label>
          <div className="flex gap-2">
            <Select value={invoiceNumberMode} onValueChange={(v: 'auto' | 'manual') => setInvoiceNumberMode(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-generado</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            {invoiceNumberMode === 'auto' ? (
              <Input
                value={sale?.saleNumber || 'INV-2026-001 (auto)'}
                disabled
                className="bg-gray-50 flex-1"
              />
            ) : (
              <Input
                value={manualInvoiceNumber}
                onChange={(e) => setManualInvoiceNumber(e.target.value)}
                placeholder="INV-2026-001"
                className="flex-1"
              />
            )}
          </div>
        </div>

        <div>
          <Label>Price List</Label>
          <Select value={priceListId || 'none'} onValueChange={(value) => setValue('priceListId', value === 'none' ? undefined : value)}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {priceListsData?.data.map((pl) => (
                <SelectItem key={pl.id} value={pl.id}>
                  {pl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Items Table */}
        <div>
          <Label className="text-red-500 mb-2 block">
            Item Details <span className="text-red-500">*</span>
          </Label>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[400px]">Item details</TableHead>
                  <TableHead className="w-[120px]">Quantity</TableHead>
                  <TableHead className="w-[120px]">Rate</TableHead>
                  <TableHead className="w-[120px] text-right">Amount</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <ItemPicker index={index} />
                      {errors.items?.[index]?.model && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.items[index]?.model?.message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        className="w-full"
                      />
                      {errors.items?.[index]?.quantity && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.items[index]?.quantity?.message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                        className="w-full"
                      />
                      {errors.items?.[index]?.unitPrice && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.items[index]?.unitPrice?.message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {(items[index]?.quantity || 0) * (items[index]?.unitPrice || 0)}
                    </TableCell>
                    <TableCell>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ model: '', quantity: 1, unitPrice: 0 })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add another line
            </Button>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-[300px] space-y-2">
            <div className="flex justify-between text-sm">
              <span>Sub Total</span>
              <span className="font-medium">
                {watch('currency') || 'USD'} {subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Discount</span>
                <span className="font-medium text-red-600">
                  -{discount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold border-t pt-2">
              <span>Total</span>
              <span>
                {watch('currency') || 'USD'} {total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Discount Input */}
        <div>
          <Label>Discount</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register('discount', { valueAsNumber: true })}
            placeholder="0.00"
            className="w-[200px]"
          />
        </div>

        {/* Description (moved to bottom) */}
        <div>
          <Label>Descripción</Label>
          <Textarea
            {...register('notes')}
            placeholder="Notas adicionales..."
            className="min-h-[80px]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-end pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Guardando...' : sale ? 'Actualizar' : 'Crear Venta'}
          </Button>
        </div>
      </form>

      <CreateCustomerDialog />
    </>
  );
}
