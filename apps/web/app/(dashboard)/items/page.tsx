import { redirect } from 'next/navigation';

// Server-side redirect to canonical items route
export default function ItemsRedirect() {
  redirect('/inventory/items');
}
