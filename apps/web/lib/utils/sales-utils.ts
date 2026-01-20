import type { SaleStatus } from '@/types/sales';

export function getStatusColor(status: SaleStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800';
    case 'RESERVED':
      return 'bg-yellow-100 text-yellow-800';
    case 'PAID':
      return 'bg-green-100 text-green-800';
    case 'SHIPPED':
      return 'bg-blue-100 text-blue-800';
    case 'DELIVERED':
      return 'bg-purple-100 text-purple-800';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusLabel(status: SaleStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Borrador';
    case 'RESERVED':
      return 'Reservado';
    case 'PAID':
      return 'Pagado';
    case 'SHIPPED':
      return 'Enviado';
    case 'DELIVERED':
      return 'Entregado';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return status;
  }
}
