import type { LeadStatus } from '@/types/api';

export function getStatusBadgeColor(status: LeadStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-blue-100 text-blue-800';
    case 'CONVERTED':
      return 'bg-green-100 text-green-800';
    case 'LOST':
      return 'bg-red-100 text-red-800';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusLabel(status: LeadStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Activo';
    case 'CONVERTED':
      return 'Convertido';
    case 'LOST':
      return 'Perdido';
    case 'ARCHIVED':
      return 'Archivado';
    default:
      return status;
  }
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
