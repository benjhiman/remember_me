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
import { useLeads } from '@/lib/api/hooks/use-leads';
import { useItems } from '@/lib/api/hooks/use-items';
import { useStockItems } from '@/lib/api/hooks/use-stock-items';
import { useAuthStore } from '@/lib/store/auth-store';
import { Plus, X, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Sale } from '@/types/sales';

const saleItemSchema = z.object({
  stockItemId: z.string().optional(),
  model: z.string().min(1, 'El modelo es requerido'),
  quantity: z.number().min(1, 'La cantidad debe ser al menos 1'),
  unitPrice: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
});

const createSaleSchema = z.object({
  leadId: z.string().optional(),
  customerName: z.string().min(1, 'El nombre del cliente es requerido'),
  customerEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  location: z.string().optional(),
  orderNumber: z.string().optional(),
  subject: z.string().optional(),
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
  const { data: leadsData } = useLeads({ limit: 50, enabled: true });
  const { data: itemsData } = useItems({ limit: 1000, enabled: true });
  const { data: stockData } = useStockItems({ limit: 1000, enabled: true });

  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(sale?.leadId || '');
  const [invoiceDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  });

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
      leadId: sale?.leadId || '',
      customerName: sale?.customerName || '',
      customerEmail: sale?.customerEmail || '',
      customerPhone: sale?.customerPhone || '',
      location: sale?.metadata?.location || '',
      orderNumber: sale?.metadata?.orderNumber || '',
      subject: sale?.metadata?.subject || sale?.notes || '',
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

  useEffect(() => {
    setValue('leadId', selectedLeadId);
  }, [selectedLeadId, setValue]);

  const filteredLeads = leadsData?.data.filter(
    (lead) =>
      lead.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.email?.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.phone?.includes(leadSearch)
  );

  const filteredItems = itemsData?.data.filter(
    (item) =>
      item.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      item.model?.toLowerCase().includes(leadSearch.toLowerCase()) ||
      item.sku?.toLowerCase().includes(leadSearch.toLowerCase())
  );

  const handleItemModelChange = (index: number, model: string) => {
    setValue(`items.${index}.model`, model);
    // Try to find matching stock item for price
    const stockItem = stockData?.data.find((s) => s.model === model && s.status === 'AVAILABLE');
    if (stockItem && stockItem.basePrice) {
      setValue(`items.${index}.unitPrice`, parseFloat(stockItem.basePrice.toString()));
      setValue(`items.${index}.stockItemId`, stockItem.id);
    }
  };

  const handleFormSubmit = (data: CreateSaleFormData) => {
    onSubmit({ ...data, leadId: selectedLeadId || undefined });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Header Section */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-red-500">
            Invoice Owner <span className="text-red-500">*</span>
          </Label>
          <Input value={user?.name || ''} disabled className="bg-gray-50" />
        </div>
        <div>
          <Label className="text-red-500">
            Account Name <span className="text-red-500">*</span>
          </Label>
          <Input
            {...register('customerName')}
            placeholder="Buscar cliente..."
            className={errors.customerName ? 'border-red-500' : ''}
          />
          {errors.customerName && (
            <p className="text-sm text-red-500 mt-1">{errors.customerName.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Location</Label>
          <Input {...register('location')} placeholder="Head Office" />
          <p className="text-xs text-gray-500 mt-1">Source Of Supply: Florida</p>
        </div>
        <div>
          <Label>Invoice Number</Label>
          <Input value={sale?.saleNumber || 'Auto-generated'} disabled className="bg-gray-50" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Order Number</Label>
          <Input {...register('orderNumber')} placeholder="SO-12345" />
        </div>
        <div>
          <Label>Invoice Date</Label>
          <Input
            value={format(invoiceDate, 'dd MMM yyyy', { locale: es })}
            disabled
            className="bg-gray-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Terms</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Due on R..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="net30">Net 30</SelectItem>
              <SelectItem value="net60">Net 60</SelectItem>
              <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Due Date</Label>
          <Input
            type="date"
            value={format(dueDate, 'yyyy-MM-dd')}
            onChange={(e) => setDueDate(new Date(e.target.value))}
          />
        </div>
        <div>
          <Label>Price List</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Warehouse Location</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Head Office" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="head-office">Head Office</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subject */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Label>Subject</Label>
          <Info className="h-4 w-4 text-gray-400" />
        </div>
        <Textarea
          {...register('subject')}
          placeholder="Let your customer know what this invoice is for."
          className="min-h-[80px]"
        />
      </div>

      {/* Discount */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Factura Final</Label>
          <Select>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Discount Type</Label>
          <Input value="At Transaction Level" disabled className="bg-gray-50" />
        </div>
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
                <TableHead className="w-[120px]">Tax</TableHead>
                <TableHead className="w-[120px] text-right">Amount</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Input
                      {...register(`items.${index}.model`)}
                      placeholder="Type or click to select an item."
                      list={`items-list-${index}`}
                      onChange={(e) => handleItemModelChange(index, e.target.value)}
                    />
                    <datalist id={`items-list-${index}`}>
                      {filteredItems?.map((item) => (
                        <option key={item.id} value={item.model || item.name}>
                          {item.name}
                        </option>
                      ))}
                    </datalist>
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
                  <TableCell>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a Tax" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Tax</SelectItem>
                        <SelectItem value="iva21">IVA 21%</SelectItem>
                      </SelectContent>
                    </Select>
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
          <Button type="button" variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Item Header
          </Button>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-[300px] space-y-2">
          <div className="flex justify-between text-sm">
            <span>Sub Total</span>
            <span className="font-medium">{watch('currency') || 'USD'} {subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span>Discount</span>
              <span className="font-medium text-red-600">-{discount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold border-t pt-2">
            <span>Total</span>
            <span>{watch('currency') || 'USD'} {total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
  );
}
