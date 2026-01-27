import { redirect } from 'next/navigation';

export default function InventoryRedirect() {
  redirect('/inventory/stock');
}
