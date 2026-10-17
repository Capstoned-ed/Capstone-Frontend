import React, { useState, useEffect, useCallback } from 'react';
import usersApi from '../../api/users';
import { ROLES } from '../../constants/roles';
import useToast from '../../hooks/useToast';
import UserEditModal from './UserEditModal';
import UserDeleteDialog from './UserDeleteDialog';
import '../../styles/admin/UserTable.css';

export default function UserTable({
  users: propUsers,
  loading: propLoading,
  error: propError,
  onUserUpdated: propOnUserUpdated,
  onUserDeactivated: propOnUserDeactivated,
  onRetry: propOnRetry,
}) {
  const toast = useToast();
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

  // ONLY Admin and Staff accounts (exclude students from Staff & Role Management table)
  const staffAndAdminUsers = users.filter((user) => user.role !== ROLES.STUDENT);

  return (
    <div className="user-table-card">
      {/* Card Header Bar (Light Blue/Periwinkle matching the photo) */}
      <div className="user-table-header-bar">
        {/* Left Title & Shield Icon */}
        <div className="user-table-header-left">
          <div className="w-8 h-8 text-[#3B82F6] flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
            </svg>
          </div>
          <div>
            <h3 className="user-table-card-title">
              Staff &amp; Role Management
            </h3>
            <p className="user-table-card-desc">
              Set roles and access levels for registrar staff
            </p>
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
        <div className="user-table-scroll">
          <table className="user-table-element">
            <thead>
              <tr className="user-table-thead-tr">
                <th className="user-table-th">Name</th>
                <th className="user-table-th">Email</th>
                <th className="user-table-th">Current Role</th>
                <th className="user-table-th">Status</th>
                <th className="user-table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="user-table-tbody">
              {staffAndAdminUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="user-table-empty-cell">
                    No staff or administrator accounts found.
                  </td>
                </tr>
              ) : (
                staffAndAdminUsers.map((user) => {
                  const displayName = formatDisplayName(user);

                  return (
                    <tr
                      key={user.id}
                      className="user-table-row"
                    >
                      {/* Name */}
                      <td className="user-table-cell-name">
                        {displayName}
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
                            Registrar
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
                      <td className="user-table-cell">
                        <div className="action-btn-group">
                          {/* Change Role Button (Solid Blue) */}
                          <button
                            type="button"
                            onClick={() => setEditingUser(user)}
                            className="btn-change-role"
                          >
                            Change Role
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <UserEditModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onUserUpdated={handleUserUpdated}
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
