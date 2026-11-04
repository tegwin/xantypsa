'use client';

import { useState } from 'react';
import { useApi, apiPatch, apiPost, apiDelete } from '@/hooks/useApi';
import { PageHeader, StatusBadge, LoadingSpinner, Modal } from '@/components/ui';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Edit, Trash2, Send, Copy, Eye, CheckCircle, XCircle, ArrowRightCircle,
  Download, ExternalLink, Building2, User, Clock, FileText, Mail,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function QuoteDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: quote, loading, refetch } = useApi<any>(`/api/quotes/${id}`);
  const [showDelete, setShowDelete] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [sending, setSending] = useState(false);

  if (loading) return <LoadingSpinner />;
  if (!quote) return <div className="p-8 text-slate-400">Quote not found</div>;

  const changeStatus = async (status: string, extra?: any) => {
    await apiPatch(`/api/quotes/${id}`, { status, ...extra });
    toast.success(`Quote ${status}`);
    refetch();
  };

  const handleClone = async () => {
    const result = await apiPost(`/api/quotes/${id}/clone`, {});
    if (result?.id) {
      toast.success('Quote cloned');
      router.push(`/quotes/${result.id}`);
    }
  };

  // Turns the accepted quote into a draft invoice and opens it. The button
  // used to navigate back to this same page, so it appeared to do nothing.
  const handleConvert = async () => {
    // apiPost toasts both success and failure, so nothing to report here.
    try {
      const invoice = await apiPost(`/api/quotes/${id}/convert`, {});
      if (invoice?.id) router.push(`/invoices/${invoice.id}`);
    } catch {
      // Already shown to the user; stay on the quote so they can retry.
    }
  };

  const handleDelete = async () => {
    await apiDelete(`/api/quotes/${id}`);
    router.push('/quotes/list');
  };

  const handleReject = async () => {
    await changeStatus('rejected', { rejectedReason: rejectReason });
    setShowReject(false);
  };

  const handleSendEmail = async () => {
    setSending(true);
    try {
      const result = await apiPost(`/api/quotes/${id}/send`, {});
      if (result?.success) {
        toast.success(result.message || 'Email sent!');
        setShowSendEmail(false);
        refetch();
      } else {
        toast.error(result?.error || 'Failed to send email');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
    }
    setSending(false);
  };

  const downloadPdf = () => window.open(`/api/quotes/${id}/pdf`, '_blank');

  const portalUrl = quote.accessToken ? `${window.location.origin}/portal/quote/${quote.accessToken}` : null;

  return (
    <div className="animate-fadeIn">
      <PageHeader title={quote.title} subtitle={`${quote.quoteNumber}`}>
        <div className="flex gap-2 flex-wrap">
          {/* Always show PDF download */}
          <button onClick={downloadPdf} className="btn-secondary flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> PDF</button>
          {quote.status === 'draft' && (
            <>
              <button onClick={() => router.push(`/quotes/${id}/edit`)} className="btn-secondary flex items-center gap-1.5"><Edit className="w-3.5 h-3.5" /> Edit</button>
              <button onClick={() => setShowSendEmail(true)} className="btn-primary flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Send Email</button>
              <button onClick={() => changeStatus('sent')} className="btn-secondary flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Mark Sent</button>
              <button onClick={handleClone} className="btn-secondary flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Clone</button>
              <button onClick={() => setShowDelete(true)} className="btn-danger flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
            </>
          )}
          {quote.status === 'sent' && (
            <>
              <button onClick={() => changeStatus('viewed')} className="btn-secondary flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Mark Viewed</button>
              <button onClick={() => changeStatus('accepted')} className="btn-primary flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Accept</button>
              <button onClick={() => setShowReject(true)} className="btn-danger flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Reject</button>
            </>
          )}
          {quote.status === 'viewed' && (
            <>
              <button onClick={() => changeStatus('accepted')} className="btn-primary flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Accept</button>
              <button onClick={() => setShowReject(true)} className="btn-danger flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Reject</button>
            </>
          )}
          {quote.status === 'accepted' && !quote.invoice && (
            <button onClick={handleConvert} className="btn-primary flex items-center gap-1.5"><ArrowRightCircle className="w-3.5 h-3.5" /> Convert to Invoice</button>
          )}
          {['rejected', 'expired'].includes(quote.status) && (
            <>
              <button onClick={handleClone} className="btn-secondary flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Clone</button>
              <button onClick={() => setShowDelete(true)} className="btn-danger flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
            </>
          )}
          <button onClick={() => router.push(`/quotes/${id}/edit`)} className="btn-secondary flex items-center gap-1.5"><Edit className="w-3.5 h-3.5" /> Edit</button>
          <button onClick={() => router.push('/quotes/list')} className="btn-secondary">← Back</button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-3">
            <StatusBadge status={quote.status} />
            {quote.currency && <span className="text-sm text-slate-400">{quote.currency}</span>}
          </div>

          {/* Line Items */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Line Items ({quote.items?.length || 0})</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="text-left p-3">Description</th>
                  <th className="text-right p-3 w-16">Qty</th>
                  <th className="text-right p-3 w-24">Price</th>
                  <th className="text-right p-3 w-16">Tax%</th>
                  <th className="text-right p-3 w-16">Disc%</th>
                  <th className="text-right p-3 w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.items?.map((item: any) => {
                  const lineNet = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
                  const lineTax = lineNet * (item.taxRate || 0) / 100;
                  const lineTotal = lineNet + lineTax;
                  return (
                    <tr key={item.id} className="border-b border-white/5">
                      <td className="p-3 text-white">
                        {item.description}
                        {item.isOptional && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-400">Optional</span>}
                        {item.billingType === 'recurring' && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400">{item.billingPeriod || 'Recurring'}</span>}
                      </td>
                      <td className="p-3 text-right text-slate-300">{item.quantity}</td>
                      <td className="p-3 text-right text-slate-300">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3 text-right text-slate-400">{item.taxRate}%</td>
                      <td className="p-3 text-right text-slate-400">{item.discount > 0 ? `${item.discount}%` : '-'}</td>
                      <td className="p-3 text-right text-white font-medium">{formatCurrency(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="glass rounded-xl p-6">
            <div className="flex flex-col items-end gap-2 text-sm">
              <div className="flex justify-between w-64"><span className="text-slate-400">Subtotal</span><span className="text-white">{formatCurrency(quote.subtotal)}</span></div>
              {quote.discount > 0 && (
                <div className="flex justify-between w-64"><span className="text-slate-400">Discount ({quote.discountType === 'percentage' ? `${quote.discount}%` : 'Fixed'})</span><span className="text-red-400">-{formatCurrency(quote.discountType === 'percentage' ? quote.subtotal * quote.discount / 100 : quote.discount)}</span></div>
              )}
              <div className="flex justify-between w-64"><span className="text-slate-400">Tax</span><span className="text-white">{formatCurrency(quote.taxTotal)}</span></div>
              <div className="flex justify-between w-64 pt-2 border-t border-white/10"><span className="text-white font-semibold">Total</span><span className="text-white font-bold text-lg">{formatCurrency(quote.total)}</span></div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Notes</h3>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
          {quote.terms && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Terms & Conditions</h3>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{quote.terms}</p>
            </div>
          )}
          {quote.internalNotes && (
            <div className="glass rounded-xl p-6 border border-amber-600/20">
              <h3 className="text-amber-400 font-semibold mb-2">Internal Notes (not visible to customer)</h3>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{quote.internalNotes}</p>
            </div>
          )}

          {/* Signature */}
          {quote.signature && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3">Digital Signature</h3>
              <img src={quote.signature.signatureData} alt="Signature" className="h-20 bg-white rounded p-2 mb-2" />
              <p className="text-sm text-slate-400">Signed by <strong className="text-white">{quote.signature.signerName}</strong> on {formatDate(quote.signature.signedAt)}</p>
              {quote.signature.signerEmail && <p className="text-xs text-slate-500">{quote.signature.signerEmail}</p>}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass rounded-xl p-6 space-y-3">
            <h3 className="text-white font-semibold">Quote Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Status</span><StatusBadge status={quote.status} /></div>
              {quote.company && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Company</span>
                  <Link href={`/crm/companies/${quote.company.id || quote.companyId}`} className="text-brand-400 hover:text-brand-300">{quote.company.name}</Link>
                </div>
              )}
              {quote.contact && (
                <div className="flex justify-between"><span className="text-slate-400">Contact</span><span className="text-white">{quote.contact.firstName} {quote.contact.lastName}</span></div>
              )}
              {quote.createdBy && (
                <div className="flex justify-between"><span className="text-slate-400">Created by</span><span className="text-white">{quote.createdBy.name}</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-400">Created</span><span className="text-white">{formatDate(quote.createdAt)}</span></div>
              {quote.validUntil && <div className="flex justify-between"><span className="text-slate-400">Valid until</span><span className="text-white">{formatDate(quote.validUntil)}</span></div>}
            </div>
          </div>

          {/* Timestamps */}
          <div className="glass rounded-xl p-6 space-y-3">
            <h3 className="text-white font-semibold">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Created</span><span className="text-slate-300">{formatRelativeTime(quote.createdAt)}</span></div>
              {quote.sentAt && <div className="flex justify-between"><span className="text-slate-400">Sent</span><span className="text-slate-300">{formatRelativeTime(quote.sentAt)}</span></div>}
              {quote.viewedAt && <div className="flex justify-between"><span className="text-slate-400">Viewed</span><span className="text-slate-300">{formatRelativeTime(quote.viewedAt)}</span></div>}
              {quote.acceptedAt && <div className="flex justify-between"><span className="text-slate-400">Accepted</span><span className="text-green-400">{formatRelativeTime(quote.acceptedAt)}</span></div>}
              {quote.rejectedAt && <div className="flex justify-between"><span className="text-slate-400">Rejected</span><span className="text-red-400">{formatRelativeTime(quote.rejectedAt)}</span></div>}
            </div>
            {quote.rejectedReason && (
              <div className="mt-2 p-2 bg-red-600/10 rounded text-sm text-red-300">
                <strong>Rejection reason:</strong> {quote.rejectedReason}
              </div>
            )}
          </div>

          {/* Portal Link */}
          {portalUrl && (
            <div className="glass rounded-xl p-6 space-y-3">
              <h3 className="text-white font-semibold">Customer Portal Link</h3>
              <div className="flex items-center gap-2">
                <input value={portalUrl} readOnly className="w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-slate-300" />
                <button onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('Link copied!'); }}
                  className="btn-secondary text-xs px-2 py-1.5 whitespace-nowrap">Copy</button>
              </div>
              <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
                <ExternalLink className="w-3 h-3" /> Open portal
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDelete && (
        <Modal title="Delete Quote" onClose={() => setShowDelete(false)}>
          <p className="text-slate-300 mb-6">Are you sure you want to delete quote <strong className="text-white">{quote.quoteNumber}</strong>? This cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDelete(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {showReject && (
        <Modal title="Reject Quote" onClose={() => setShowReject(false)}>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection (optional)" rows={3} className="w-full mb-4" />
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowReject(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleReject} className="btn-danger">Reject Quote</button>
          </div>
        </Modal>
      )}

      {/* Send Email Modal */}
      {showSendEmail && (
        <Modal title="Send Quote by Email" onClose={() => setShowSendEmail(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              This will send the quote as a PDF attachment to the customer and generate a portal link for online viewing and acceptance.
            </p>
            <div className="bg-white/5 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Recipient</span><span className="text-white">{quote.contact?.email || quote.company?.email || 'No email found'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Quote</span><span className="text-white">{quote.quoteNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="text-white">{formatCurrency(quote.total)}</span></div>
            </div>
            {!(quote.contact?.email || quote.company?.email) && (
              <p className="text-sm text-red-400">No email address found. Please add an email to the contact or company first.</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowSendEmail(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSendEmail} disabled={sending || !(quote.contact?.email || quote.company?.email)} className="btn-primary flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
