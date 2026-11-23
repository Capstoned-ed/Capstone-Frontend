import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import usersApi from '../../api/users';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';
import useToast from '../../hooks/useToast';
import UserEditModal from './UserEditModal';
import UserDeleteDialog from './UserDeleteDialog';
import TablePagination from '../common/TablePagination';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/admin/UserTable.css';

const PAGE_SIZE = 10;

export default function UserTable({
  users: propUsers,
  loading: propLoading,
  error: propError,
  onUserUpdated: propOnUserUpdated,
  onUserDeactivated: propOnUserDeactivated,
  onRetry: propOnRetry,
  overviewOnly = false,
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [internalUsers, setInternalUsers] = useState([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState(null);

  const isControlled = propUsers !== undefined;
  const users = isControlled ? propUsers : internalUsers;
  const loading = propLoading !== undefined ? propLoading : internalLoading;
  const error = propError !== undefined ? propError : internalError;

  // Modals state
  const [editingUser, setEditingUser] = useState(null);
  const [deactivatingUser, setDeactivatingUser] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const tableScrollRef = useRef(null);
  const [lockedMinHeight, setLockedMinHeight] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = useCallback(async () => {
    if (propOnRetry) {
      propOnRetry();
      return;
    }
    setInternalLoading(true);
    setInternalError(null);
    try {
      const data = await usersApi.list();
      setInternalUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
      setInternalError('Unable to load users from the server. Please check your connection.');
      toast.error('Failed to fetch user list.');
    } finally {
      setInternalLoading(false);
    }
  }, [propOnRetry, toast]);

  useEffect(() => {
    if (isControlled) return;
    let ignore = false;
    async function loadData() {
      try {
        const data = await usersApi.list();
        if (!ignore) {
          setInternalUsers(data);
          setInternalLoading(false);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
        if (!ignore) {
          setInternalError('Unable to load users from the server. Please check your connection.');
          setInternalLoading(false);
          toast.error('Failed to fetch user list.');
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [isControlled, toast]);

  // Handle updated user
  const handleUserUpdated = (updatedUser) => {
    if (propOnUserUpdated) {
      propOnUserUpdated(updatedUser);
    } else {
      setInternalUsers((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
      );
    }
    setEditingUser(null);
    window.dispatchEvent(new Event('regquest_users_updated'));
  };

  // Handle soft-deactivated user
  const handleUserDeactivated = (userId) => {
    if (propOnUserDeactivated) {
      propOnUserDeactivated(userId);
    } else {
      setInternalUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u))
      );
    }
    setDeactivatingUser(null);
    window.dispatchEvent(new Event('regquest_users_updated'));
  };

  // Handle reactivate user directly
  const handleReactivate = async (user) => {
    setActionLoadingId(user.id);
    try {
      const updated = await usersApi.activate(user.id);
      toast.success(`User "${user.username}" reactivated successfully.`);
      handleUserUpdated(updated);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reactivate user.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Format user display name from actual backend record
  const formatDisplayName = (user) => {
    if (user.full_name) {
      return user.full_name;
    }
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) {
      return user.first_name;
    }
    return (user.username || '')
      .split(/[._]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  // ONLY Admin, Registrar, and Staff accounts (exclude students from Staff & Role Management table)
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const staffAndAdminUsers = users
    .filter((user) => user.role !== ROLES.STUDENT)
    .filter((user) => (roleFilter === 'ALL' ? true : user.role === roleFilter))
    .filter((user) => {
      if (!normalizedQuery) return true;
      const haystacks = [
        formatDisplayName(user),
        user.username,
        user.email,
        user.role,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      return haystacks.some((val) => val.includes(normalizedQuery));
    });

  const effectivePageSize = overviewOnly ? 5 : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(staffAndAdminUsers.length / effectivePageSize));
  const safePage = overviewOnly ? 1 : Math.min(currentPage, totalPages);
  const paginatedUsers = overviewOnly
    ? staffAndAdminUsers.slice(0, 5)
    : staffAndAdminUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (!overviewOnly && totalPages > 1 && paginatedUsers.length === PAGE_SIZE && tableScrollRef.current) {
      setLockedMinHeight(tableScrollRef.current.offsetHeight);
    }
  }, [overviewOnly, totalPages, paginatedUsers.length]);

  return (
    <div className="user-table-card" style={{ overflowAnchor: 'none' }}>
      {/* Card Header Bar (Light Blue/Periwinkle matching the photo) */}
      <div className="user-table-header-bar flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left Title & Shield Icon */}
        <div className="user-table-header-left items-start sm:items-center min-w-0">
          <div className="w-8 h-8 text-[#3B82F6] flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="user-table-card-title">
              {overviewOnly
                ? 'Staff, Registrar & Role Overview'
                : 'Staff, Registrar & Role Management'}
            </h3>
            <p className="user-table-card-desc">
              {overviewOnly
                ? 'Overview of Registrar, Staff, and Administrator accounts and roles'
                : 'Assign roles and access levels for Registrar, Staff, and Administrator'}
            </p>
          </div>
        </div>

        {/* Search & Role Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto">
          <div className="relative w-full sm:w-60">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search staff by name, ID, or email..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-blue-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                aria-label="Clear staff search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: 'ALL', label: 'All Roles' },
              { key: ROLES.REGISTRAR, label: 'Registrar Frontdesk' },
              { key: ROLES.STAFF, label: 'Staff' },
              { key: ROLES.ADMIN, label: 'Administrator' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setRoleFilter(tab.key);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  roleFilter === tab.key
                    ? 'bg-[#0B0B36] text-white shadow-sm'
                    : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="user-table-loading-container">
          <div className="user-table-loading-header">
            <div className="user-table-spinner" />
            <span>Loading staff directory...</span>
          </div>
          {[1, 2, 3].map((n) => (
            <div key={n} className="user-table-skeleton-row" />
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="user-table-error-container">
          <div className="user-table-error-icon-wrap">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="user-table-error-message">{error}</p>
          <button
            type="button"
            onClick={fetchUsers}
            className="user-table-retry-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Staff & Admin Data Table */}
      {!loading && !error && (
        <div
          ref={tableScrollRef}
          className="user-table-scroll"
          style={totalPages > 1 && lockedMinHeight ? { minHeight: `${lockedMinHeight}px` } : undefined}
        >
          <table className="user-table-element">
            <thead>
              <tr className="user-table-thead-tr">
                <th className="user-table-th">Name</th>
                <th className="user-table-th">Email</th>
                <th className="user-table-th">Current Role</th>
                <th className="user-table-th">Status</th>
                {!overviewOnly && <th className="user-table-th">Actions</th>}
              </tr>
            </thead>
            <tbody className="user-table-tbody">
              {staffAndAdminUsers.length === 0 ? (
                <tr>
                  <td colSpan={overviewOnly ? 4 : 5} className="user-table-empty-cell">
                    No staff or administrator accounts found.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const displayName = formatDisplayName(user);

                  return (
                    <tr
                      key={user.id}
                      className="user-table-row"
                    >
                      {/* Name */}
                      <td className="user-table-cell-name">
                        <div className="font-semibold text-slate-800">{displayName}</div>
                        {user.username && (
                          <div className="text-[11px] text-slate-400 font-normal">
                            ID: {user.username}
                          </div>
                        )}
                      </td>

                      {/* Email */}
                      <td className="user-table-cell-email">
                        {user.email || '—'}
                      </td>

                      {/* Current Role (matching color pills) */}
                      <td className="user-table-cell">
                        {user.role === ROLES.ADMIN ? (
                          <span className="role-badge role-badge-admin">
                            Administrator
                          </span>
                        ) : user.role === ROLES.STAFF ? (
                          <span className="role-badge role-badge-staff">
                            Staff
                          </span>
                        ) : (
                          <span className="role-badge role-badge-registrar">
                            Registrar Frontdesk
                          </span>
                        )}
                      </td>

                      {/* Status (Active / Inactive pills) */}
                      <td className="user-table-cell">
                        {user.is_active ? (
                          <span className="status-badge status-badge-active">
                            Active
                          </span>
                        ) : (
                          <span className="status-badge status-badge-inactive">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions: [Change Role] & [Deactivate / Activate] */}
                      {!overviewOnly && (
                        <td className="user-table-cell">
                          {currentUser && (
                            String(user.id) === String(currentUser.id) ||
                            String(user.id) === String(currentUser.userId) ||
                            (user.username && currentUser.username && user.username.toLowerCase() === currentUser.username.toLowerCase())
                          ) ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 cursor-not-allowed select-none"
                              title="You cannot modify or deactivate your own active account"
                            >
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span>Current Account (Protected)</span>
                            </span>
                          ) : (
                            <div className="action-btn-group">
                              {/* Update / Change Role Button (Solid Blue) */}
                              <button
                                type="button"
                                onClick={() => setEditingUser(user)}
                                className="btn-change-role"
                              >
                                Update / Change Role
                              </button>

                              {/* Deactivate Button (Red Outline) or Activate */}
                              {user.is_active ? (
                                <button
                                  type="button"
                                  onClick={() => setDeactivatingUser(user)}
                                  className="btn-deactivate"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleReactivate(user)}
                                  disabled={actionLoadingId === user.id}
                                  className="btn-activate"
                                >
                                  {actionLoadingId === user.id ? (
                                    <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                  ) : null}
                                  <span>Activate</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (
        overviewOnly ? (
          <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-700">{paginatedUsers.length}</span> of{' '}
              <span className="font-bold text-slate-700">{staffAndAdminUsers.length}</span>
            </p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.ADMIN.USERS)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#0B0B36] text-white hover:bg-indigo-950 transition-colors cursor-pointer"
            >
              <span>See All</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : (
          <TablePagination
            currentPage={safePage}
            totalItems={staffAndAdminUsers.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            accentColor="blue"
          />
        )
      )}

      {/* Modals */}
      <UserEditModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onUserUpdated={handleUserUpdated}
        existingUsers={users}
      />

      <UserDeleteDialog
        user={deactivatingUser}
        isOpen={!!deactivatingUser}
        onClose={() => setDeactivatingUser(null)}
        onUserDeactivated={handleUserDeactivated}
      />
    </div>
  );
}
