'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import SignaturePad from './SignaturePad';

export default function PortalQuotePage() {
  const { token } = useParams();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOptional, setSelectedOptional] = useState<Set<string>>(new Set());
  const [showSignature, setShowSignature] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/portal/quote/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else {
          setQuote(data);
          // Select all optional items by default
          const optIds = new Set<string>();
          data.items?.forEach((item: any) => { if (item.isOptional) optIds.add(item.id); });
          setSelectedOptional(optIds);
        }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load quote'); setLoading(false); });
  }, [token]);

  const toggleOptional = (itemId: string) => {
    setSelectedOptional(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const totals = useMemo(() => {
    if (!quote?.items) return { subtotal: 0, tax: 0, discount: 0, total: 0 };
    let subtotal = 0, tax = 0;
    quote.items.forEach((item: any) => {
      if (item.isOptional && !selectedOptional.has(item.id)) return;
      const lineNet = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      const lineTax = lineNet * (item.taxRate || 0) / 100;
      subtotal += lineNet;
      tax += lineTax;
    });
    const discountAmt = quote.discountType === 'percentage' ? subtotal * (quote.discount || 0) / 100 : (quote.discount || 0);
    return { subtotal, tax, discount: discountAmt, total: subtotal + tax - discountAmt };
  }, [quote, selectedOptional]);

  const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: quote?.currency || 'GBP' }).format(n);

  const handleAccept = async (data: { signatureData: string; signerName: string; signerEmail: string }) => {
    setSubmitting(true);
    await fetch(`/api/portal/quote/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setSubmitted(true);
    setShowSignature(false);
    setSubmitting(false);
  };

  const handleReject = async () => {
    setSubmitting(true);
    await fetch(`/api/portal/quote/${token}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    });
    setSubmitted(true);
    setShowReject(false);
    setSubmitting(false);
  };

  if (loading) return <div className="text-center py-20 text-slate-400">Loading quote...</div>;
  if (error) return <div className="text-center py-20 text-red-400">{error}</div>;
  if (!quote) return null;

  const isAccepted = quote.status === 'accepted' || submitted;
  const isRejected = quote.status === 'rejected';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
        {quote.company && <p className="text-lg font-bold text-white mb-1">{quote.company.name}</p>}
        <h1 className="text-2xl font-bold text-white">{quote.title}</h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-400">
          <span>Quote #{quote.quoteNumber}</span>
          <span>Date: {new Date(quote.createdAt).toLocaleDateString()}</span>
          {quote.validUntil && <span>Valid Until: {new Date(quote.validUntil).toLocaleDateString()}</span>}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            isAccepted ? 'bg-green-600/20 text-green-400' : isRejected ? 'bg-red-600/20 text-red-400' : 'bg-blue-600/20 text-blue-400'
          }`}>{isAccepted ? 'Accepted' : isRejected ? 'Rejected' : quote.status}</span>
        </div>
        {quote.contact && (
          <p className="text-sm text-slate-400 mt-2">Attention: {quote.contact.firstName} {quote.contact.lastName}</p>
        )}
      </div>

      {/* Submitted confirmation */}
      {submitted && (
        <div className={`rounded-xl p-6 border ${isAccepted ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
          <p className="font-semibold text-lg">{isAccepted ? 'Quote Accepted!' : 'Quote Rejected'}</p>
          <p className="text-sm mt-1">{isAccepted ? 'Thank you for accepting this quote. We will be in touch shortly.' : 'The quote has been rejected. Thank you for your response.'}</p>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left p-3">Description</th>
              <th className="text-right p-3 w-16">Qty</th>
              <th className="text-right p-3 w-24">Price</th>
              <th className="text-right p-3 w-16">Tax%</th>
              {quote.items.some((i: any) => i.discount > 0) && <th className="text-right p-3 w-16">Disc%</th>}
              <th className="text-right p-3 w-24">Total</th>
              {quote.items.some((i: any) => i.isOptional) && <th className="text-center p-3 w-16">Include</th>}
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item: any) => {
              const included = !item.isOptional || selectedOptional.has(item.id);
              const lineNet = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
              const lineTax = lineNet * (item.taxRate || 0) / 100;
              const lineTotal = lineNet + lineTax;
              return (
                <tr key={item.id} className={`border-b border-slate-800 ${!included ? 'opacity-40' : ''}`}>
                  <td className="p-3 text-white">
                    {item.description}
                    {item.billingType === 'recurring' && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400">{item.billingPeriod || 'recurring'}</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-slate-300">{item.quantity}</td>
                  <td className="p-3 text-right text-slate-300">{fmt(item.unitPrice)}</td>
                  <td className="p-3 text-right text-slate-400">{item.taxRate}%</td>
                  {quote.items.some((i: any) => i.discount > 0) && (
                    <td className="p-3 text-right text-slate-400">{item.discount > 0 ? `${item.discount}%` : '-'}</td>
                  )}
                  <td className="p-3 text-right text-white font-medium">{fmt(lineTotal)}</td>
                  {quote.items.some((i: any) => i.isOptional) && (
                    <td className="p-3 text-center">
                      {item.isOptional ? (
                        <input type="checkbox" checked={selectedOptional.has(item.id)} onChange={() => toggleOptional(item.id)}
                          disabled={isAccepted || isRejected} className="rounded" />
                      ) : <span className="text-xs text-slate-500">Required</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
        <div className="flex flex-col items-end gap-2 text-sm">
          <div className="flex justify-between w-64"><span className="text-slate-400">Subtotal</span><span className="text-white">{fmt(totals.subtotal)}</span></div>
          {totals.discount > 0 && <div className="flex justify-between w-64"><span className="text-slate-400">Discount</span><span className="text-red-400">-{fmt(totals.discount)}</span></div>}
          <div className="flex justify-between w-64"><span className="text-slate-400">Tax</span><span className="text-white">{fmt(totals.tax)}</span></div>
          <div className="flex justify-between w-64 pt-2 border-t border-slate-700"><span className="text-white font-semibold">Total</span><span className="text-white font-bold text-lg">{fmt(totals.total)}</span></div>
        </div>
      </div>

      {/* Notes & Terms */}
      {quote.notes && (
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
          <h3 className="text-white font-semibold mb-2">Notes</h3>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{quote.notes}</p>
        </div>
      )}
      {quote.terms && (
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
          <h3 className="text-white font-semibold mb-2">Terms & Conditions</h3>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{quote.terms}</p>
        </div>
      )}

      {/* Signature Display */}
      {quote.signature && (
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
          <h3 className="text-white font-semibold mb-2">Signed</h3>
          <img src={quote.signature.signatureData} alt="Signature" className="h-20 bg-white rounded p-2" />
          <p className="text-sm text-slate-400 mt-2">Signed by {quote.signature.signerName} on {new Date(quote.signature.signedAt).toLocaleDateString()}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <a href={`/api/portal/quote/${token}/pdf`} target="_blank" rel="noopener noreferrer"
          className="px-6 py-3 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors flex items-center gap-2">
          Download PDF
        </a>
        {!isAccepted && !isRejected && !submitted && (
          <>
            <button onClick={() => setShowSignature(true)} className="px-6 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors">
              Accept Quote
            </button>
            <button onClick={() => setShowReject(true)} className="px-6 py-3 rounded-lg bg-red-600/20 text-red-400 font-medium hover:bg-red-600/30 border border-red-600/30 transition-colors">
              Reject Quote
            </button>
          </>
        )}
      </div>

      {/* Signature Modal */}
      {showSignature && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-lg border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Accept & Sign Quote</h2>
            <SignaturePad onSubmit={handleAccept} onCancel={() => setShowSignature(false)} />
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showReject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Reject Quote</h2>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)" rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowReject(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300">Cancel</button>
              <button onClick={handleReject} disabled={submitting} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500">
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
