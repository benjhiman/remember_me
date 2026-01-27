import { redirect } from 'next/navigation';

export default function StockRedirect() {
  redirect('/inventory/stock');
}
