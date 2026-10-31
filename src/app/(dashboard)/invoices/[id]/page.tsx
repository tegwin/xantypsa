'use client';

import { useState } from 'react';
import { useApi, apiPatch, apiPost, apiDelete } from '@/hooks/useApi';
import { PageHeader, StatusBadge, LoadingSpinner, Modal } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { downloadPDF } from '@/lib/pdf';
import { useRouter, useParams } from 'next/navigation';
import { Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function InvoiceDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: invoice, loading, refetch } = useApi<any>(`/api/invoices/${id}`);
  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState({ amount: '', paymentDate: new Date().toISOString().split('T')[0], method: 'bank_transfer', reference: '' });

  const updateStatus = async (status: string) => {
    await apiPatch(`/api/invoices/${id}`, { status });
    refetch();
  };

  const handlePayment = async () => {
    const res = await apiPost(`/api/invoices/${id}/payments`, {
      ...payment,
      amount: parseFloat(payment.amount),
    });
    if (res) {
      setShowPayment(false);
      setPayment({ amount: '', paymentDate: new Date().toISOString().split('T')[0], method: 'bank_transfer', reference: '' });
      refetch();
    }
  };

  const handleDelete = async () => {
    if (confirm('Delete this invoice?')) {
      await apiDelete(`/api/invoices/${id}`);
      router.push('/invoices/list');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!invoice) return <div className="text-slate-400">Invoice not found</div>;

  const outstanding = invoice.total - (invoice.amountPaid || 0);

  const handleDownloadPDF = () => {
    if (!invoice) return;
    downloadPDF({
      type: 'invoice',
      number: invoice.invoiceNumber,
      title: invoice.title || `Invoice ${invoice.invoiceNumber}`,
      status: invoice.status,
      date: formatDate(invoice.issueDate || invoice.createdAt),
      dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : undefined,
      currency: invoice.currency || 'GBP',
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal || 0,
      discount: invoice.discount || 0,
      total: invoice.total,
      amountPaid: invoice.amountPaid || 0,
      amountDue: outstanding,
      notes: invoice.notes,
      terms: invoice.terms,
      paymentTerms: invoice.paymentTerms,
      company: invoice.company,
      contact: invoice.contact,
      tenant: { name: 'XantyPSA' },
      items: (invoice.items || []).map((li: any) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        taxRate: li.taxRate,
        discount: li.discount || 0,
        total: li.total,
      })),
    });
  };

  const freqLabels: Record<string, string> = { monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' };
  const termsLabels: Record<string, string> = { due_on_receipt: 'Due on Receipt', net_15: 'Net 15', net_30: 'Net 30', net_60: 'Net 60' };

  return (
    <div className="animate-fadeIn">
      <PageHeader title={invoice.invoiceNumber} subtitle={`Invoice for ${invoice.company?.name || 'Unknown'}`}>
        <div className="flex gap-2">
          {invoice.status === 'draft' && <button onClick={() => updateStatus('sent')} className="btn-primary">Mark as Sent</button>}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button onClick={() => setShowPayment(true)} className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg hover:bg-green-500/30 text-sm">
              Record Payment
            </button>
          )}
          <button onClick={handleDownloadPDF} className="btn-secondary flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={handleDelete} className="btn-secondary text-red-400">Delete</button>
          <button onClick={() => router.push('/invoices/list')} className="btn-secondary">← Back</button>
        </div>
      </PageHeader>

      {/* Recurring Badge Banner */}
      {invoice.isRecurring && (
        <div className="glass rounded-xl p-4 mb-6 flex items-center gap-3 border border-purple-500/20">
          <RefreshCw className="w-5 h-5 text-purple-400" />
          <div>
            <span className="text-purple-400 font-medium">Recurring Invoice</span>
            <span className="text-slate-400 mx-2">-</span>
            <span className="text-white">{freqLabels[invoice.recurringFreq] || invoice.recurringFreq}</span>
            {invoice.nextRecurring && (
              <>
                <span className="text-slate-400 mx-2">-</span>
                <span className="text-slate-400">Next: {formatDate(invoice.nextRecurring)}</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Line Items</h3>
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-white/5">
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium text-right">Qty</th>
                  <th className="pb-3 font-medium text-right">Unit Price</th>
                  <th className="pb-3 font-medium text-right">Tax</th>
                  <th className="pb-3 font-medium text-right">Discount</th>
                  <th className="pb-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((li: any) => (
                  <tr key={li.id} className="border-b border-white/5">
                    <td className="py-3">
                      <div className="text-white">{li.description}</div>
                      {li.product && (
                        <div className="text-xs text-slate-500">{li.product.sku || li.product.name}</div>
                      )}
                    </td>
                    <td className="py-3 text-right text-slate-300">{li.quantity}</td>
                    <td className="py-3 text-right text-slate-300">{formatCurrency(li.unitPrice)}</td>
                    <td className="py-3 text-right text-slate-400">{li.taxRate}%</td>
                    <td className="py-3 text-right text-slate-400">{li.discount ? `${li.discount}%` : '—'}</td>
                    <td className="py-3 text-right text-white font-medium">{formatCurrency(li.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 pt-4 border-t border-white/5 text-right space-y-1">
              <div className="text-slate-400">Subtotal: {formatCurrency(invoice.subtotal)}</div>
              {invoice.discount > 0 && <div className="text-slate-400">Discount: -{formatCurrency(invoice.discount)}</div>}
              <div className="text-slate-400">Tax: {formatCurrency(invoice.taxTotal)}</div>
              <div className="text-white font-bold text-lg">Total: {formatCurrency(invoice.total)}</div>
              {invoice.amountPaid > 0 && <div className="text-green-400">Paid: {formatCurrency(invoice.amountPaid)}</div>}
              {outstanding > 0 && <div className="text-amber-400 font-semibold">Outstanding: {formatCurrency(outstanding)}</div>}
            </div>
          </div>

          {invoice.payments?.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Payments</h3>
              <div className="space-y-3">
                {invoice.payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                    <div>
                      <div className="text-white font-medium">{formatCurrency(p.amount)}</div>
                      <div className="text-xs text-slate-400">{p.method.replace('_', ' ')} {p.reference && `- ${p.reference}`}</div>
                    </div>
                    <div className="text-sm text-slate-400">{formatDate(p.paidAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass rounded-xl p-6 space-y-4">
            <h3 className="text-white font-semibold">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Status</span><StatusBadge status={invoice.status} /></div>
              <div className="flex justify-between"><span className="text-slate-400">Company</span><span className="text-white">{invoice.company?.name || '—'}</span></div>
              {invoice.contact && (
                <div className="flex justify-between"><span className="text-slate-400">Contact</span><span className="text-white">{invoice.contact.firstName} {invoice.contact.lastName}</span></div>
              )}
              {invoice.contractId && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Contract</span>
                  <Link href={`/contracts/${invoice.contractId}`} className="text-blue-400 hover:text-blue-300 text-sm">
                    View Contract →
                  </Link>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Terms</span>
                <span className="text-white">{termsLabels[invoice.paymentTerms] || invoice.paymentTerms || '—'}</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-400">Due Date</span>
                <span className={invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' ? 'text-red-400' : 'text-white'}>
                  {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
                </span>
              </div>
              {invoice.isRecurring && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Frequency</span>
                    <span className="px-2 py-0.5 rounded-lg text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      {freqLabels[invoice.recurringFreq] || invoice.recurringFreq}
                    </span>
                  </div>
                  {invoice.nextRecurring && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Next Invoice</span>
                      <span className="text-white">{formatDate(invoice.nextRecurring)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between"><span className="text-slate-400">Created</span><span className="text-white">{formatDate(invoice.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Created By</span><span className="text-white">{invoice.createdBy?.name || '—'}</span></div>
              {invoice.sentAt && <div className="flex justify-between"><span className="text-slate-400">Sent</span><span className="text-white">{formatDate(invoice.sentAt)}</span></div>}
              {invoice.paidAt && <div className="flex justify-between"><span className="text-slate-400">Paid</span><span className="text-green-400">{formatDate(invoice.paidAt)}</span></div>}
            </div>
          </div>

          {invoice.notes && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Notes</h3>
              <p className="text-sm text-slate-400 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title="Record Payment">
        <div className="space-y-4">
          <div>
            <label className="label">Amount *</label>
            <input className="input w-full" type="number" step="0.01" value={payment.amount}
              onChange={(e) => setPayment({...payment, amount: e.target.value})}
              placeholder={outstanding.toString()} />
            {outstanding > 0 && (
              <button onClick={() => setPayment({...payment, amount: outstanding.toString()})}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1">Pay full outstanding ({formatCurrency(outstanding)})</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input className="input w-full" type="date" value={payment.paymentDate}
                onChange={(e) => setPayment({...payment, paymentDate: e.target.value})} />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="input w-full" value={payment.method}
                onChange={(e) => setPayment({...payment, method: e.target.value})}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_card">Credit Card</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="direct_debit">Direct Debit</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input w-full" value={payment.reference}
              onChange={(e) => setPayment({...payment, reference: e.target.value})} placeholder="e.g. transaction ID" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowPayment(false)} className="btn-secondary">Cancel</button>
            <button onClick={handlePayment} disabled={!payment.amount || parseFloat(payment.amount) <= 0} className="btn-primary">Record Payment</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
