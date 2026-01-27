import { redirect } from 'next/navigation';

export default function PriceListsRedirect() {
  redirect('/inventory/pricelist');
}
