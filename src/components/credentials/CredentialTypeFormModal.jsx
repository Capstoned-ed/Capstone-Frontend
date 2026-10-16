import React, { useState } from 'react';
import useToast from '../../hooks/useToast';
import credentialTypesApi from '../../api/credentialTypes';

/**
 * CredentialTypeFormModal Component
 * Form modal to create or update an institutional credential type.
 */
export default function CredentialTypeFormModal({
  isOpen,
  onClose,
  credentialType = null, // null for create, object for edit
  onSaved,
}) {
  const toast = useToast();
  const isEditing = Boolean(credentialType?.id);

  const [code, setCode] = useState(() => credentialType?.code || '');
  const [name, setName] = useState(() => credentialType?.name || '');
  const [description, setDescription] = useState(() => credentialType?.description || '');
  const [price, setPrice] = useState(() =>
    credentialType?.price !== undefined ? String(credentialType.price) : ''
  );
  const [processingDays, setProcessingDays] = useState(() =>
    credentialType?.processing_days !== undefined
      ? String(credentialType.processing_days)
      : '3'
  );
  const [isActive, setIsActive] = useState(() =>
    credentialType?.is_active !== undefined ? credentialType.is_active : true
  );

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  if (!isOpen) return null;

  const validate = () => {
    const errors = {};
    if (!code.trim()) {
      errors.code = 'Code is required (e.g. TOR, HD, COE).';
    } else if (code.trim().length > 10) {
      errors.code = 'Code cannot exceed 10 characters.';
    }

    if (!name.trim()) {
      errors.name = 'Credential name is required.';
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      errors.price = 'Please enter a valid price (greater than or equal to 0).';
    }

    const numDays = parseInt(processingDays, 10);
    if (isNaN(numDays) || numDays < 1) {
      errors.processing_days = 'Processing days must be at least 1 day.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setFieldErrors({});

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price).toFixed(2),
      processing_days: parseInt(processingDays, 10),
      is_active: isActive,
    };

    try {
      let savedRecord;
      if (isEditing) {
        savedRecord = await credentialTypesApi.update(credentialType.id, payload);
        toast.success(`Credential "${payload.name}" updated successfully.`);
      } else {
        savedRecord = await credentialTypesApi.create(payload);
        toast.success(`Credential "${payload.name}" created successfully.`);
      }

      if (onSaved) {
        onSaved(savedRecord);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save credential type:', err);
      const resData = err.response?.data;
      if (resData && typeof resData === 'object') {
        const errors = {};
        for (const [key, val] of Object.entries(resData)) {
          errors[key] = Array.isArray(val) ? val.join(' ') : String(val);
        }
        setFieldErrors(errors);
        const firstMsg = Object.values(errors)[0];
        toast.error(firstMsg || 'Failed to save credential type.');
      } else {
        toast.error('An unexpected error occurred while saving.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            {isEditing ? 'Edit Credential Type' : 'Add New Credential Type'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Code & Name Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. TOR"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  className={`w-full px-3 py-2 text-sm bg-white border ${
                    fieldErrors.code ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200'
                  } rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-bold uppercase transition-all`}
                  required
                />
                {fieldErrors.code && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.code}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Document Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Transcript of records"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3 py-2 text-sm bg-white border ${
                    fieldErrors.name ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200'
                  } rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all`}
                  required
                />
                {fieldErrors.name && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.name}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Brief description or purpose of this credential document..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>

            {/* Price & Processing Days Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fee Amount (₱ PHP) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                    ₱
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="150.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={`w-full pl-7 pr-3 py-2 text-sm bg-white border ${
                      fieldErrors.price ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200'
                    } rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold transition-all`}
                    required
                  />
                </div>
                {fieldErrors.price && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.price}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Est. Processing Days <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="3"
                  value={processingDays}
                  onChange={(e) => setProcessingDays(e.target.value)}
                  className={`w-full px-3 py-2 text-sm bg-white border ${
                    fieldErrors.processing_days
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-slate-200'
                  } rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all`}
                  required
                />
                {fieldErrors.processing_days && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.processing_days}</p>
                )}
              </div>
            </div>

            {/* Active Toggle Switch */}
            <div className="pt-1 flex items-center justify-between border-t border-slate-100 mt-1">
              <div>
                <span className="text-xs font-bold text-slate-800">Available to Students</span>
                <p className="text-[11px] text-slate-500">
                  When active, students can select and request this document type.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B0B36]" />
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary-navy"
            >
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{isEditing ? 'Save Changes' : 'Create Credential'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
