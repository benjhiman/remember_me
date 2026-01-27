import { redirect } from 'next/navigation';

export default function InventoryReservationsRedirect() {
  redirect('/stock/reservations');
}
