import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

/**
 * CredentialTypeCard Component
 * Displays available credential documents for students with pricing, processing duration, and request action.
 */
export default function CredentialTypeCard({ credentialType, onRequest }) {
  const navigate = useNavigate();

  const formatCurrency = (amount) => {
    const val = Number(amount) || 0;
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const handleRequestClick = () => {
    if (onRequest) {
      onRequest(credentialType);
    } else {
      navigate(`${ROUTES.STUDENT.NEW_REQUEST}?type=${credentialType.code || credentialType.id}`);
    }
  };

  return (
    <div className="credential-card">
      <div>
        {/* Top Header: Code badge & Price */}
        <div className="credential-card-top">
          <span className="badge-code">
            {credentialType.code}
          </span>
          <span className="credential-card-price">
            {formatCurrency(credentialType.price)}
          </span>
        </div>

        {/* Title */}
        <h4 className="credential-card-title">
          {credentialType.name}
        </h4>

        {/* Description */}
        <p className="credential-card-desc">
          {credentialType.description ||
            'Official institutional document for academic, employment, or personal records.'}
        </p>
      </div>

      <div>
        {/* Processing Details */}
        <div className="credential-card-meta">
          <span className="credential-card-days">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <polyline points="12 6 12 12 16 14" strokeWidth={2} />
            </svg>
            Est. {credentialType.processing_days}{' '}
            {credentialType.processing_days === 1 ? 'business day' : 'business days'}
          </span>
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Available
          </span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleRequestClick}
          className="btn-request-card"
        >
          <span>Request Document</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
