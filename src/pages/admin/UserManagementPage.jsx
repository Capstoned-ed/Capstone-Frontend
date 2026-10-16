import React, { useState, useEffect, useCallback } from 'react';
import usersApi from '../../api/users';
import useToast from '../../hooks/useToast';
import { ROLES } from '../../constants/roles';
import UserTable from '../../components/admin/UserTable';
import StudentTableCard from '../../components/admin/StudentTableCard';
import '../../styles/UserManagementPage.css';

export default function UserManagementPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add User Form State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserName, setAddUserName] = useState('');
  const [addUserEmail, setAddUserEmail] = useState('');
  const [addUserRole, setAddUserRole] = useState(ROLES.STAFF);

  // Add Student Form State
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [addStudentLoading, setAddStudentLoading] = useState(false);
  const [studentFullName, setStudentFullName] = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentProgram, setStudentProgram] = useState('');
  const [studentYearLevel, setStudentYearLevel] = useState('1st year');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Unable to load users from the server. Please check your connection.');
      toast.error('Failed to fetch user directory.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const data = await usersApi.list();
        if (!ignore) {
          setUsers(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
        if (!ignore) {
          setError('Unable to load users from the server.');
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const handleUserCreated = (newUser) => {
    setUsers((prev) => [newUser, ...prev]);
  };

  const handleUserUpdated = (updatedUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
    );
  };

  const handleUserDeactivated = (userId) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u))
    );
  };

  // Add User Handlers
  const handleAddUserReset = () => {
    setAddUserName('');
    setAddUserEmail('');
    setAddUserRole(ROLES.STAFF);
    setIsAddUserOpen(false);
  };

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();

    if (!addUserName.trim()) {
      toast.error('Please enter a full name.');
      return;
    }
    if (!addUserEmail.trim()) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setAddUserLoading(true);

    try {
      const nameParts = addUserName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const usernameBase = addUserEmail.includes('@')
        ? addUserEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '')
        : addUserName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');

      const username = usernameBase || `user_${Date.now()}`;

      const payload = {
        username,
        email: addUserEmail.trim().toLowerCase(),
        password: 'Password123!',
        role: addUserRole,
        first_name: firstName,
        last_name: lastName,
      };

      const newUser = await usersApi.create(payload);
      toast.success(`User "${addUserName}" (${addUserRole}) provisioned successfully.`);
      handleUserCreated(newUser);
      handleAddUserReset();
    } catch (err) {
      console.error('Failed to create user:', err);
      const resData = err.response?.data;
      let errMsg = 'Failed to create new user.';
      if (resData && typeof resData === 'object') {
        const firstErr = Object.values(resData)[0];
        errMsg = Array.isArray(firstErr) ? firstErr.join(' ') : String(firstErr);
      }
      toast.error(errMsg);
    } finally {
      setAddUserLoading(false);
    }
  };

  // Add Student Handlers
  const handleAddStudentReset = () => {
    setStudentFullName('');
    setStudentIdInput('');
    setStudentEmail('');
    setStudentProgram('');
    setStudentYearLevel('1st year');
    setIsAddStudentOpen(false);
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();

    if (!studentFullName.trim()) {
      toast.error("Please enter the student's full name.");
      return;
    }
    if (!studentIdInput.trim()) {
      toast.error('Please enter the Student ID.');
      return;
    }
    if (!studentEmail.trim()) {
      toast.error('Please enter a valid active email address.');
      return;
    }

    setAddStudentLoading(true);

    try {
      const nameParts = studentFullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const finalStudentId = studentIdInput.trim();

      const payload = {
        username: finalStudentId,
        email: studentEmail.trim().toLowerCase(),
        password: finalStudentId,
        role: ROLES.STUDENT,
        first_name: firstName,
        last_name: lastName,
      };

      const res = await usersApi.create(payload);
      const newStudent = {
        ...res,
        student_id: finalStudentId,
        program: studentProgram.trim() || 'B.S in Information Technology',
        year_level: studentYearLevel,
      };

      toast.success(`Student "${studentFullName}" provisioned with password: ${finalStudentId}`);
      handleUserCreated(newStudent);
      handleAddStudentReset();
    } catch (err) {
      console.error('Failed to create student:', err);
      const resData = err.response?.data;
      let errMsg = 'Failed to add student account.';
      if (resData && typeof resData === 'object') {
        const firstErr = Object.values(resData)[0];
        errMsg = Array.isArray(firstErr) ? firstErr.join(' ') : String(firstErr);
      }
      toast.error(errMsg);
    } finally {
      setAddStudentLoading(false);
    }
  };

  // Metric Stats Calculations
  const totalUsers = users.length;
  const staffMembers = users.filter(
    (u) => u.role === ROLES.STAFF || u.role === ROLES.REGISTRAR
  ).length;
  const administrators = users.filter((u) => u.role === ROLES.ADMIN).length;
  const students = users.filter((u) => u.role === ROLES.STUDENT).length;

  const stats = [
    {
      title: 'Total Users',
      value: totalUsers,
      pillClass: 'user-stat-pill-slate',
      icon: (
        <svg className="user-stat-icon text-slate-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      ),
    },
    {
      title: 'Staff Member',
      value: staffMembers,
      pillClass: 'user-stat-pill-green',
      icon: (
        <svg className="user-stat-icon text-[#22C55E]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      ),
    },
    {
      title: 'Administrator',
      value: administrators,
      pillClass: 'user-stat-pill-blue',
      icon: (
        <svg className="user-stat-icon text-[#3B82F6]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
        </svg>
      ),
    },
    {
      title: 'Student',
      value: students,
      pillClass: 'user-stat-pill-orange',
      icon: (
        <svg className="user-stat-icon text-[#F97316]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 13.5L5.5 13 4 13.82 12 18l8-4.18-1.5-.82L12 16.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="user-mgmt-container">
      {/* 1. Top 4 Metric Cards */}
      <div className="user-stat-grid">
        {stats.map((item) => (
          <div key={item.title} className="user-stat-card">
            {/* Left vertical color pill accent */}
            <div className={`user-stat-pill ${item.pillClass}`} />
            <div className="user-stat-header">
              {item.icon}
              <span className="user-stat-title">
                {item.title}
              </span>
            </div>
            <div className="user-stat-body">
              <span className="user-stat-value">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Collapsible Add New User Form Card */}
      <div className="add-user-card">
        {!isAddUserOpen ? (
          <div>
            <button
              type="button"
              onClick={() => setIsAddUserOpen(true)}
              className="add-user-trigger-btn"
            >
              Add New User
            </button>
          </div>
        ) : (
          <form onSubmit={handleAddUserSubmit} className="add-user-form">
            <h3 className="add-user-title">
              Add New User
            </h3>

            <div className="add-user-grid-3">
              <div>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={addUserName}
                  onChange={(e) => setAddUserName(e.target.value)}
                  required
                  className="add-user-input"
                />
              </div>

              <div>
                <input
                  type="email"
                  placeholder="Email"
                  value={addUserEmail}
                  onChange={(e) => setAddUserEmail(e.target.value)}
                  required
                  className="add-user-input"
                />
              </div>

              <div>
                <select
                  value={addUserRole}
                  onChange={(e) => setAddUserRole(e.target.value)}
                  className="add-user-select"
                >
                  <option value={ROLES.STAFF}>Staff</option>
                  <option value={ROLES.ADMIN}>Administrator</option>
                  <option value={ROLES.REGISTRAR}>Registrar</option>
                </select>
              </div>
            </div>

            <div className="add-user-actions">
              <button
                type="submit"
                disabled={addUserLoading}
                className="add-user-submit-btn"
              >
                {addUserLoading && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Add User</span>
              </button>
              <button
                type="button"
                onClick={handleAddUserReset}
                disabled={addUserLoading}
                className="add-user-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 3. Staff & Role Management Card */}
      <UserTable
        users={users}
        loading={loading}
        error={error}
        onUserUpdated={handleUserUpdated}
        onUserDeactivated={handleUserDeactivated}
        onRetry={fetchUsers}
      />

      {/* 4. Collapsible Add New Student Form Card */}
      <div className="add-student-card">
        {!isAddStudentOpen ? (
          <div>
            <button
              type="button"
              onClick={() => setIsAddStudentOpen(true)}
              className="add-student-trigger-btn"
            >
              Add New Student
            </button>
          </div>
        ) : (
          <form onSubmit={handleAddStudentSubmit} className="add-student-form">
            <div className="add-student-header">
              <div className="add-student-badge">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <div>
                <h3 className="add-student-title">
                  Add New Student
                </h3>
                <p className="add-student-subtitle">
                  Provision a new student profile and institutional credentials.
                </p>
              </div>
            </div>

            <div className="add-student-grid-3">
              <div>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={studentFullName}
                  onChange={(e) => setStudentFullName(e.target.value)}
                  required
                  className="add-student-input"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Student ID (e.g. 2023123456)"
                  value={studentIdInput}
                  onChange={(e) => setStudentIdInput(e.target.value)}
                  required
                  className="add-student-input"
                />
              </div>

              <div>
                <input
                  type="email"
                  placeholder="Active Email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  required
                  className="add-student-input"
                />
              </div>
            </div>

            <div className="add-student-grid-2">
              <div>
                <input
                  type="text"
                  placeholder="Course (e.g. B.S in Information Technology)"
                  value={studentProgram}
                  onChange={(e) => setStudentProgram(e.target.value)}
                  required
                  className="add-student-input"
                />
              </div>

              <div>
                <select
                  value={studentYearLevel}
                  onChange={(e) => setStudentYearLevel(e.target.value)}
                  className="add-student-select"
                >
                  <option value="1st year">1st year</option>
                  <option value="2nd year">2nd year</option>
                  <option value="3rd year">3rd year</option>
                  <option value="4th year">4th year</option>
                  <option value="5th year">5th year</option>
                  <option value="Alumnus">Alumnus</option>
                </select>
              </div>
            </div>

            <div className="add-student-notice">
              <svg className="w-4 h-4 text-[#15803D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                The login password will automatically be set to the <strong>Student ID</strong> (<code>{studentIdInput.trim() || 'Student ID'}</code>).
              </span>
            </div>

            <div className="add-student-actions">
              <button
                type="submit"
                disabled={addStudentLoading}
                className="add-student-submit-btn"
              >
                {addStudentLoading && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Add Student</span>
              </button>
              <button
                type="button"
                onClick={handleAddStudentReset}
                disabled={addStudentLoading}
                className="add-student-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 5. Student Accounts Management Card */}
      <StudentTableCard
        users={users}
        onStudentUpdated={handleUserUpdated}
      />
    </div>
  );
}
