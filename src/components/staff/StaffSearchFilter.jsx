import React from 'react';

export default function StaffSearchFilter({
  searchQuery,
  setSearchQuery,
  docTypeFilter,
  setDocTypeFilter,
  statusFilter,
  setStatusFilter,
  credentialTypes = [],
  requestStatuses = [],
}) {
  return (
    <div className="staff-search-card">
      <h4 className="staff-search-title">Search</h4>
      <div className="staff-search-controls">
        {/* Search Field */}
        <div className="staff-input-wrap">
          <svg className="staff-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by ID, Student Name, or Student ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="staff-search-field"
          />
        </div>

        {/* Document Type Dropdown */}
        <div className="staff-input-wrap">
          <svg className="staff-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="staff-dropdown-field"
          >
            <option value="">Document Type</option>
            {credentialTypes.map((ct) => (
              <option key={ct.id} value={ct.name}>
                {ct.name}
              </option>
            ))}
          </select>
        </div>

        {/* All Statuses Dropdown */}
        <div className="staff-input-wrap">
          <svg className="staff-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="staff-dropdown-field"
          >
            <option value="">All Statuses</option>
            {requestStatuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
