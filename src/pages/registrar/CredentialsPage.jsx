import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import credentialTypesApi from '../../api/credentialTypes';
import useToast from '../../hooks/useToast';
import CredentialTypeTable from '../../components/credentials/CredentialTypeTable';
import CredentialTypeFormModal from '../../components/credentials/CredentialTypeFormModal';
import CredentialDeleteDialog from '../../components/credentials/CredentialDeleteDialog';
import '../../styles/CredentialTypes.css';

export default function RegistrarCredentialsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [credentialTypes, setCredentialTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState(null);

  const [deleteDialogOpen, setDeleteDialogOpenOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(null);
  const [activatingId, setActivatingId] = useState(null);

  // RBAC: Registrar can mutate credential types
  const canMutate = user?.role === ROLES.REGISTRAR || user?.role === ROLES.ADMIN;

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const data = await credentialTypesApi.list();
        if (!ignore) {
          setCredentialTypes(data);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load credential types:', err);
          toast.error('Unable to load credential catalog.');
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [toast]);

  // Handle Create or Update
  const handleOpenCreate = () => {
    setSelectedForEdit(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (type) => {
    setSelectedForEdit(type);
    setFormModalOpen(true);
  };

  const handleSaved = (savedType) => {
    setCredentialTypes((prev) => {
      const exists = prev.some((t) => t.id === savedType.id);
      if (exists) {
        return prev.map((t) => (t.id === savedType.id ? savedType : t));
      }
      return [savedType, ...prev];
    });
  };

  // Handle Deactivation
  const handleOpenDeactivate = (type) => {
    setSelectedForDelete(type);
    setDeleteDialogOpenOpen(true);
  };

  const handleDeactivated = (deactivatedId) => {
    setCredentialTypes((prev) =>
      prev.map((t) => (t.id === deactivatedId ? { ...t, is_active: false } : t))
    );
  };

  // Handle Activation
  const handleActivate = async (type) => {
    if (!type || activatingId) return;
    setActivatingId(type.id);
    try {
      const updated = await credentialTypesApi.update(type.id, { is_active: true });
      setCredentialTypes((prev) =>
        prev.map((t) => (t.id === type.id ? { ...t, ...updated, is_active: true } : t))
      );
      toast.success(`Credential "${type.name}" has been activated.`);
    } catch (err) {
      console.error('Failed to activate credential type:', err);
      toast.error('Failed to activate credential type.');
    } finally {
      setActivatingId(null);
    }
  };

  // Metrics Calculations
  const totalCount = credentialTypes.length;
  const activeCount = credentialTypes.filter((t) => t.is_active).length;
  const inactiveCount = credentialTypes.filter((t) => !t.is_active).length;

  return (
    <div className="credentials-page-wrapper">
      {/* Header Banner */}
      <div className="credentials-header">
        <div>
          <h2 className="credentials-title">
            Institutional Credentials Configuration
          </h2>
          <p className="credentials-subtitle">
            Manage academic certificates, transcripts, diplomas, and official fee structures.
          </p>
        </div>

        {canMutate && (
          <div>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="btn-primary-navy"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Credential Type</span>
            </button>
          </div>
        )}
      </div>

      {/* Top Stat Cards */}
      <div className="credentials-stat-grid">
        <div className="credential-stat-card">
          <div className="credential-stat-icon-wrap bg-indigo-50 text-indigo-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div className="credential-stat-value">{totalCount}</div>
            <div className="credential-stat-label">Total Credential Types</div>
          </div>
        </div>

        <div className="credential-stat-card">
          <div className="credential-stat-icon-wrap bg-emerald-50 text-emerald-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="credential-stat-value text-emerald-600">{activeCount}</div>
            <div className="credential-stat-label">Active &amp; Offered</div>
          </div>
        </div>

        <div className="credential-stat-card">
          <div className="credential-stat-icon-wrap bg-rose-50 text-rose-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <div className="credential-stat-value text-slate-700">{inactiveCount}</div>
            <div className="credential-stat-label">Inactive / Archived</div>
          </div>
        </div>
      </div>

      {/* Main Credential Types Table */}
      <CredentialTypeTable
        credentialTypes={credentialTypes}
        loading={loading}
        canMutate={canMutate}
        onEdit={handleOpenEdit}
        onDeactivate={handleOpenDeactivate}
        onActivate={handleActivate}
        activatingId={activatingId}
      />

      {/* Modals */}
      <CredentialTypeFormModal
        key={selectedForEdit ? selectedForEdit.id : (formModalOpen ? 'create' : 'closed')}
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        credentialType={selectedForEdit}
        onSaved={handleSaved}
      />

      <CredentialDeleteDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpenOpen(false)}
        credentialType={selectedForDelete}
        onDeactivated={handleDeactivated}
      />
    </div>
  );
}
