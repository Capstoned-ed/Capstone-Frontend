import React, { useState, useEffect } from 'react';
import paymentsApi, { getStoredPaymentProof } from '../../api/payments';
import { saveStoredNotification } from '../../api/notifications';
import requestsApi, { getStaffAssignments, extractTotalAmount, resolveRequestDocType } from '../../api/requests';
import useToast from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { extractApiErrorMessage } from '../../utils/errorUtils';

export default function PaymentUploadModal({ isOpen, onClose, request, onSuccess, defaultOption = 'ONLINE' }) {
  const { user } = useAuth();
  const toast = useToast();

  const [paymentOption, setPaymentOption] = useState(defaultOption); // 'ONLINE' or 'PERSONAL'
  const [orNumberInput, setOrNumberInput] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Prepopulate if proof was already submitted for THIS specific request
  useEffect(() => {
    if (request && isOpen) {
      const trackingCode = request.tracking_number || request.trackingId || request.id;
      let existing = request.payment_proof;

      // Verify proof belongs to THIS request
      if (existing) {
        const pTrack = String(existing.trackingNumber || '').trim().toUpperCase();
        const pReqId = String(existing.requestId || '').trim().toUpperCase();
        const thisTrack = String(trackingCode || '').trim().toUpperCase();
        const thisId = String(request.id || request.rawId || '').trim().toUpperCase();
        const matches =
          (pTrack && (pTrack === thisTrack || pTrack === thisId)) ||
          (pReqId && (pReqId === thisTrack || pReqId === thisId));
        if (!matches) {
          existing = null;
        }
      }

      if (!existing) {
        existing = getStoredPaymentProof([
          request.tracking_number,
          request.id,
          request.rawId,
        ]);
      }

      if (existing) {
        setOrNumberInput(existing.receiptReferenceNumber || '');
        setReceiptPreview(existing.receiptImage || null);
        setPaymentOption(existing.submissionType || defaultOption || 'ONLINE');
      } else {
        setOrNumberInput('');
        setReceiptFile(null);
        setReceiptPreview(null);
        setPaymentOption(defaultOption || 'ONLINE');
      }
    }
  }, [request, isOpen, defaultOption]);

  if (!isOpen || !request) return null;

  const trackingCode = request.tracking_number || request.trackingId || request.id;
  const docTitle = resolveRequestDocType(request) || request.document_type || request.credential_type_name || 'Document Request';
  const requiredAmountNumeric = extractTotalAmount(request);
  const assessedFee = `₱${requiredAmountNumeric.toFixed(2)}`;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const hasValidExt = /\.(png|jpe?g|gif|webp|bmp|jfif|pdf)$/i.test(file.name || '');
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf' && !hasValidExt) {
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
      const trackingCode = request?.tracking_number || request?.trackingId || request?.id || '';
      const finalOrNumber = orNumberInput.trim() || (paymentOption === 'PERSONAL' ? 'Paid at USTP Cashier (FTF)' : 'Submitted at Window');
      const targetRequestUuid = request.rawId || request.id;
      await paymentsApi.submit({
        requestId: targetRequestUuid,
        amount: requiredAmountNumeric.toFixed(2),
        receiptImage: receiptFile,
        receiptReferenceNumber: finalOrNumber,
        trackingNumber: trackingCode,
        receiptDataUrl: receiptPreview,
        submissionType: paymentOption,
        studentName: request.student_name || user?.full_name || user?.username || 'Student',
        studentId: request.student_id || user?.student_id || user?.username || '',
        userId: request.user || user?.id,
      });

      const studentName =
        user?.full_name ||
        [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
        user?.username ||
        'A student';
      const assignmentsMap = getStaffAssignments();
      const assignedStaff =
        request?.assigned_staff ||
        assignmentsMap[String(trackingCode)] ||
        assignmentsMap[String(request?.rawId)] ||
        assignmentsMap[String(request?.id)] ||
        null;

      saveStoredNotification({
        event_type: 'PAYMENT_SUBMITTED',
        title: 'Student Payment Submitted',
        message: `${studentName} submitted ${paymentOption === 'ONLINE' ? 'online receipt' : 'face-to-face'} payment for request (${trackingCode}).`,
        target_role: 'staff',
        target_roles: ['staff', 'registrar'],
        target_name: assignedStaff || undefined,
        tracking_number: trackingCode,
        related_object_type: 'CredentialRequest',
        related_object_id: String(request?.rawId || request?.id || trackingCode),
      });

      toast.success(
        paymentOption === 'ONLINE'
          ? 'Official Receipt uploaded! Awaiting Registrar Staff verification.'
          : 'Face-to-Face payment confirmed! Awaiting Registrar Staff verification.'
      );

      if (onSuccess) await onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to submit proof of payment:', err);
      const errMsg = extractApiErrorMessage(err, 'Failed to submit payment proof. Please try again.');
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 transform transition-all"
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
              <strong className="font-bold">Over-The-Counter Cashier Payment Instructions:</strong>
              <ul className="text-[11px] text-amber-900 mt-1 space-y-1 list-disc pl-4 leading-relaxed">
                <li>
                  After printing your assessed form, go to the <strong>Registrar's Office first to have it signed</strong> before proceeding to the <strong>USTP Cashier's Office</strong> to pay.
                </li>
                <li>
                  Upload a clear photo of your <strong>Official Receipt (O.R.)</strong> and enter your O.R. Number below so Registrar Staff can verify and begin processing.
                </li>
              </ul>
            </div>
          </div>

          <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start gap-2.5 text-xs text-rose-950 shadow-2xs">
            <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-[11px] sm:text-xs font-semibold leading-snug m-0">
              <span className="font-extrabold uppercase tracking-wide text-rose-700">Important:</span>{' '}
              <strong>Do not lose your Official Receipt (O.R.)</strong> — you must keep and submit/present it together when claiming your requested document(s).
            </p>
          </div>

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
                  onChange={(e) => {
                    if (submitting) return;
                    setOrNumberInput(e.target.value);
                  }}
                  disabled={submitting}
                  readOnly={submitting}
                  tabIndex={submitting ? -1 : undefined}
                  aria-disabled={submitting ? 'true' : undefined}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#0B0B36] font-mono shadow-2xs disabled:bg-slate-100 disabled:cursor-not-allowed"
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
                  disabled={submitting}
                  readOnly={submitting}
                  tabIndex={submitting ? -1 : undefined}
                  aria-disabled={submitting ? 'true' : undefined}
                  onChange={(e) => {
                    if (submitting) return;
                    handleFileChange(e);
                  }}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#0B0B36] file:text-white hover:file:bg-[#1E1E6B] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      </div>
    </div>
  );
}

