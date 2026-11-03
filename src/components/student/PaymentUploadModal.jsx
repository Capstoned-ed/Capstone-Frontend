import React, { useState, useEffect } from 'react';
import paymentsApi, { getStoredPaymentProof } from '../../api/payments';
import useToast from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';

export default function PaymentUploadModal({ isOpen, onClose, request, onSuccess }) {
  const { user } = useAuth();
  const toast = useToast();

  const [paymentOption, setPaymentOption] = useState('ONLINE'); // 'ONLINE' or 'PERSONAL'
  const [orNumberInput, setOrNumberInput] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Prepopulate if proof was already submitted
  useEffect(() => {
    if (request && isOpen) {
      const existing =
        request.payment_proof ||
        getStoredPaymentProof([
          request.tracking_number,
          request.id,
          request.rawId,
          request.student_id,
        ]);
      if (existing) {
        setOrNumberInput(existing.receiptReferenceNumber || '');
        setReceiptPreview(existing.receiptImage || null);
        setPaymentOption(existing.submissionType || 'ONLINE');
      } else {
        setOrNumberInput('');
        setReceiptFile(null);
        setReceiptPreview(null);
        setPaymentOption('ONLINE');
      }
    }
  }, [request, isOpen]);

  if (!isOpen || !request) return null;

  const trackingCode = request.tracking_number || request.trackingId || request.id;
  const docTitle = request.document_type || request.credential_type_name || 'Document Request';
  const assessedFee = request.assessed_amount || request.amount || '₱100.00';

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.warning('Please upload a valid image file (PNG, JPG) or PDF.');
      return;
    }

    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (paymentOption === 'ONLINE') {
      if (!orNumberInput.trim()) {
        toast.warning('Please enter the Official Receipt (O.R.) Number.');
        return;
      }
      if (!receiptFile && !receiptPreview) {
        toast.warning('Please upload a picture of your Official Receipt.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await paymentsApi.submit({
        requestId: request.rawId || request.id,
        amount: assessedFee,
        receiptImage: receiptFile,
        receiptReferenceNumber: orNumberInput.trim() || 'Submitted at Window',
        trackingNumber: trackingCode,
        receiptDataUrl: receiptPreview,
        submissionType: paymentOption,
        studentName: request.student_name || user?.full_name || user?.username || 'Student',
        studentId: request.student_id || user?.student_id || user?.username || '',
        userId: request.user || user?.id,
      });

      toast.success(
        paymentOption === 'ONLINE'
          ? 'Official Receipt uploaded! Awaiting Registrar Staff verification.'
          : 'Payment marked for in-person submission at Registrar window!'
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to submit proof of payment:', err);
      toast.error('Failed to submit payment proof. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#0B0B36] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-extrabold text-lg shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="2" y1="10" x2="22" y2="10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-white">
                Submit Proof of Payment
              </h3>
              <p className="text-xs text-slate-300">
                Official Cashier Receipt Verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer text-sm"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Request Summary Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Request &amp; Document
              </span>
              <h4 className="text-xs font-bold text-slate-900 font-mono">
                {trackingCode}
              </h4>
              <p className="text-xs text-slate-600 font-semibold">{docTitle}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Assessed Fee
              </span>
              <div className="text-base font-black text-[#0B0B36]">{assessedFee}</div>
            </div>
          </div>

          {/* OTC Instructions Info */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
            <span className="text-base shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
              </svg>
            </span>
            <div>
              <strong className="font-bold">Over-The-Counter Cashier Payment:</strong>
              <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                Pay your assessed fee at the <strong>USTP Cashier's Office</strong>, then upload a clear photo of your Official Receipt (O.R.) below so Registrar Staff can verify and begin processing.
              </p>
            </div>
          </div>

          {/* Submission Mode Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setPaymentOption('ONLINE')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                paymentOption === 'ONLINE'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Option 1: Upload Receipt Photo
            </button>
            <button
              type="button"
              onClick={() => setPaymentOption('PERSONAL')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                paymentOption === 'PERSONAL'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Option 2: Submit at Registrar Window
            </button>
          </div>

          {paymentOption === 'ONLINE' ? (
            /* Option 1 Form */
            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Receipt (O.R.) Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OR-2026-004128"
                  value={orNumberInput}
                  onChange={(e) => setOrNumberInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#0B0B36] font-mono shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Upload Picture of Cashier Official Receipt <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  required={!receiptPreview}
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#0B0B36] file:text-white hover:file:bg-[#1E1E6B] cursor-pointer"
                />
              </div>

              {receiptPreview && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                  <img
                    src={receiptPreview}
                    alt="Receipt Preview"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-300 shadow-2xs"
                  />
                  <div>
                    <span className="text-xs text-emerald-700 font-bold block">
                      ✓ Receipt photo ready to upload
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Ensure the O.R. number and amount are legible.
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span>{submitting ? 'Submitting Receipt...' : 'Submit Proof of Payment'}</span>
                  <span>✓</span>
                </button>
              </div>
            </form>
          ) : (
            /* Option 2 Window submission */
            <div className="space-y-4 pt-1 text-xs text-slate-600">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed">
                <h5 className="font-bold text-slate-900 mb-1">In-Person Window Instructions:</h5>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Download and print your official request form with the assessed fee.</li>
                  <li>Pay the assessed amount at the USTP Cashier's Office.</li>
                  <li>Present your form along with the Cashier Official Receipt directly to the Registrar Window staff.</li>
                </ol>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="px-5 py-2.5 rounded-xl bg-[#0B0B36] hover:bg-[#1E1E6B] active:scale-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span>{submitting ? 'Confirming...' : 'I Will Submit at Registrar Window'}</span>
                  <span>✓</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

