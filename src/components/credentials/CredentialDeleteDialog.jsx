import React, { useState } from 'react';
import useToast from '../../hooks/useToast';
import credentialTypesApi from '../../api/credentialTypes';

/**
 * CredentialDeleteDialog Component
 * Confirmation modal before deactivating a Credential Type.
 */
export default function CredentialDeleteDialog({
  isOpen,
  onClose,
  credentialType,
  onDeactivated,
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !credentialType) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await credentialTypesApi.deactivate(credentialType.id);
      toast.success(`Credential "${credentialType.name}" has been deactivated.`);
      if (onDeactivated) {
        onDeactivated(credentialType.id);
      }
      onClose();
    } catch (err) {
      console.error('Failed to deactivate credential type:', err);
      toast.error('Failed to deactivate credential type.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog max-w-md">
        <div className="p-6 text-center">
          {/* Warning Icon */}
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h3 className="text-base font-bold text-slate-900 mb-2">
            Deactivate Credential Type?
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto mb-6">
            Are you sure you want to deactivate{' '}
            <strong className="text-slate-800">
              {credentialType.name} ({credentialType.code})
            </strong>
            ? Students will no longer be able to submit new requests for this document.
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>Yes, Deactivate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
