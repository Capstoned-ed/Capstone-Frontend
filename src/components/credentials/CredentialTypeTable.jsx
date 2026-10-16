import React, { useState } from 'react';

/**
 * CredentialTypeTable Component
 * Displays a searchable, filterable table of institutional credential types.
 * Mutation buttons are conditionally rendered based on RBAC (canMutate).
 */
export default function CredentialTypeTable({
  credentialTypes = [],
  loading = false,
  canMutate = false,
  onEdit,
  onDeactivate,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const formatCurrency = (amount) => {
    const val = Number(amount) || 0;
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const filteredTypes = credentialTypes.filter((type) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      type.code?.toLowerCase().includes(q) ||
      type.name?.toLowerCase().includes(q) ||
      type.description?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === 'ACTIVE') return type.is_active;
    if (statusFilter === 'INACTIVE') return !type.is_active;
    return true;
  });

  return (
    <div className="credentials-table-card">
      {/* Toolbar */}
      <div className="credentials-toolbar">
        {/* Search Input */}
        <div className="credentials-search-box">
          <svg
            className="credentials-search-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by code, title, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="credentials-search-input"
          />
        </div>

        {/* Filter Tabs */}
        <div className="credentials-filter-tabs">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`filter-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
          >
            All ({credentialTypes.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`filter-tab ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
          >
            Active ({credentialTypes.filter((t) => t.is_active).length})
          </button>
          {canMutate && (
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`filter-tab ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
            >
              Inactive ({credentialTypes.filter((t) => !t.is_active).length})
            </button>
          )}
        </div>
      </div>

      {/* Table Presentation */}
      <div className="credentials-table-wrapper">
        <table className="credentials-table">
          <thead className="credentials-thead">
            <tr>
              <th className="credentials-th">Code</th>
              <th className="credentials-th">Document Name</th>
              <th className="credentials-th">Price</th>
              <th className="credentials-th">Est. Processing</th>
              <th className="credentials-th">Status</th>
              {canMutate && <th className="credentials-th text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="credentials-tbody">
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <tr key={i} className="credentials-row animate-pulse">
                  <td className="credentials-td">
                    <div className="h-5 bg-slate-200 rounded w-12" />
                  </td>
                  <td className="credentials-td">
                    <div className="h-4 bg-slate-200 rounded w-44 mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-28" />
                  </td>
                  <td className="credentials-td">
                    <div className="h-4 bg-slate-200 rounded w-16" />
                  </td>
                  <td className="credentials-td">
                    <div className="h-4 bg-slate-200 rounded w-20" />
                  </td>
                  <td className="credentials-td">
                    <div className="h-5 bg-slate-200 rounded-full w-16" />
                  </td>
                  {canMutate && (
                    <td className="credentials-td text-right">
                      <div className="h-6 bg-slate-200 rounded w-24 ml-auto" />
                    </td>
                  )}
                </tr>
              ))
            ) : filteredTypes.length === 0 ? (
              <tr>
                <td
                  colSpan={canMutate ? 6 : 5}
                  className="py-12 text-center text-sm text-slate-400 font-medium"
                >
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'No credential types match your search criteria.'
                    : 'No credential types configured in the catalog.'}
                </td>
              </tr>
            ) : (
              filteredTypes.map((type) => (
                <tr key={type.id} className="credentials-row">
                  {/* Short Code */}
                  <td className="credentials-td">
                    <span className="badge-code">{type.code}</span>
                  </td>

                  {/* Name & Description */}
                  <td className="credentials-td">
                    <div className="font-bold text-slate-900 tracking-tight">
                      {type.name}
                    </div>
                    {type.description && (
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {type.description}
                      </div>
                    )}
                  </td>

                  {/* Price */}
                  <td className="credentials-td">
                    <span className="price-text">{formatCurrency(type.price)}</span>
                  </td>

                  {/* Processing Days */}
                  <td className="credentials-td">
                    <span className="days-pill">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth={2} />
                        <polyline points="12 6 12 12 16 14" strokeWidth={2} />
                      </svg>
                      {type.processing_days}{' '}
                      {type.processing_days === 1 ? 'day' : 'days'}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="credentials-td">
                    {type.is_active ? (
                      <span className="badge-active">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="badge-inactive">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Inactive
                      </span>
                    )}
                  </td>

                  {/* Actions Column (RBAC Protected) */}
                  {canMutate && (
                    <td className="credentials-td text-right">
                      <div className="credentials-actions justify-end">
                        <button
                          type="button"
                          onClick={() => onEdit && onEdit(type)}
                          className="btn-action-edit"
                          title="Edit Credential Configuration"
                        >
                          Edit
                        </button>
                        {type.is_active && (
                          <button
                            type="button"
                            onClick={() => onDeactivate && onDeactivate(type)}
                            className="btn-action-delete"
                            title="Deactivate Credential Type"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
