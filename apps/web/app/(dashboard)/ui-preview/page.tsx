'use client';

import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Package, Search, Plus } from 'lucide-react';

export default function UIPreviewPage() {
  const breadcrumbs = [
    { label: 'UI Preview', href: '/ui-preview' },
  ];

  return (
    <PageShell
      title="UI Preview"
      description="Componentes y estilos Zoho-like"
      breadcrumbs={breadcrumbs}
      actions={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo Item
        </Button>
      }
      toolbar={
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar..."
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
          <select className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700">
            <option>Todos</option>
            <option>Activo</option>
            <option>Inactivo</option>
          </select>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Table Example */}
        <div className="zoho-card">
          <div className="overflow-x-auto">
            <table className="zoho-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Asignado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr className="cursor-pointer">
                  <td>
                    <div className="text-sm font-medium text-gray-900">Ejemplo Item 1</div>
                    <div className="text-xs text-gray-500">ejemplo@email.com</div>
                  </td>
                  <td>
                    <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Activo
                    </span>
                  </td>
                  <td className="text-sm text-gray-600">22 Ene 2025</td>
                  <td className="text-sm text-gray-600">Usuario Ejemplo</td>
                  <td>
                    <Button variant="outline" size="sm">Ver</Button>
                  </td>
                </tr>
                <tr className="cursor-pointer">
                  <td>
                    <div className="text-sm font-medium text-gray-900">Ejemplo Item 2</div>
                    <div className="text-xs text-gray-500">ejemplo2@email.com</div>
                  </td>
                  <td>
                    <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Pendiente
                    </span>
                  </td>
                  <td className="text-sm text-gray-600">21 Ene 2025</td>
                  <td className="text-sm text-gray-600">Usuario Ejemplo</td>
                  <td>
                    <Button variant="outline" size="sm">Ver</Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Example */}
        <div className="zoho-card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Formulario de Ejemplo</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
              <Input placeholder="Ingresá un nombre..." className="h-9" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <Input type="email" placeholder="email@ejemplo.com" className="h-9" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
              <select className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700">
                <option>Seleccionar...</option>
                <option>Activo</option>
                <option>Inactivo</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm">Guardar</Button>
              <Button variant="outline" size="sm">Cancelar</Button>
            </div>
          </div>
        </div>

        {/* Empty State Example */}
        <div className="zoho-card p-12">
          <div className="text-center max-w-sm mx-auto">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">No hay items</h3>
            <p className="text-xs text-gray-600 mb-4">
              Creá tu primer item para empezar a gestionar.
            </p>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Crear Item
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
