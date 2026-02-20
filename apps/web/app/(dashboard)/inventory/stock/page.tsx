'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { PageShell } from '@/components/layout/page-shell';
import { SellerStockView } from '@/components/stock/seller-stock-view';
import { Permission, userCan } from '@/lib/auth/permissions';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AddStockItemDialog } from '@/components/stock/add-stock-item-dialog';

export default function InventoryStockPage() {
  const { user } = useAuthStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Stock', href: '/inventory/stock' },
  ];

  const actions = userCan(user, Permission.EDIT_STOCK) ? (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        Agregar Stock
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      <PageShell
        title="Stock"
        description="Consulta el stock disponible"
        breadcrumbs={breadcrumbs}
        actions={actions}
      >
        <SellerStockView />
      </PageShell>

      {userCan(user, Permission.EDIT_STOCK) && (
        <AddStockItemDialog 
          open={isAddDialogOpen} 
          onOpenChange={setIsAddDialogOpen}
        />
      )}
    </>
  );
}
