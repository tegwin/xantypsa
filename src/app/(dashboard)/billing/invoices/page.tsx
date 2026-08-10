import { redirect } from 'next/navigation';

export default function BillingInvoicesPage() {
  redirect('/invoices/list');
}
