import React, { useState, useEffect, useCallback } from 'react';
import usersApi from '../../api/users';
import useToast from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import UserTable from '../../components/admin/UserTable';
import StudentTableCard from '../../components/admin/StudentTableCard';
import CourseSelectDropdown, { USTP_COURSE_CODE_MAP } from '../../components/admin/CourseSelectDropdown';
import '../../styles/admin/UserManagementPage.css';

const isValidName = (val) => /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s]+$/.test(val.trim());
const getNameError = (val, label = 'Name') => {
  if (!val) return '';
  return /[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s]/.test(val)
    ? `${label} must not contain numbers or special characters.`
    : '';
};
const isValidNumericId = (val) => /^\d+$/.test(val.trim());
const getNumericIdError = (val, label = 'ID Number') => {
  if (!val) return '';
  return /\D/.test(val) ? `${label} must contain numbers only.` : '';
};

export default function UserManagementPage() {
  const toast = useToast();
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add User Form State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserFirstName, setAddUserFirstName] = useState('');
  const [addUserFirstNameError, setAddUserFirstNameError] = useState('');
  const [addUserLastName, setAddUserLastName] = useState('');
  const [addUserLastNameError, setAddUserLastNameError] = useState('');
  const [addUserIdInput, setAddUserIdInput] = useState('');
  const [addUserIdError, setAddUserIdError] = useState('');
  const [addUserEmail, setAddUserEmail] = useState('');
  const [addUserContactNumber, setAddUserContactNumber] = useState('');
  const [addUserContactError, setAddUserContactError] = useState('');
  const [addUserRole, setAddUserRole] = useState(ROLES.STAFF);

  // Add Student Form State
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [addStudentLoading, setAddStudentLoading] = useState(false);
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentFirstNameError, setStudentFirstNameError] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [studentLastNameError, setStudentLastNameError] = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentIdError, setStudentIdError] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentBirthDate, setStudentBirthDate] = useState('');
  const [studentContactNumber, setStudentContactNumber] = useState('');
  const [studentContactError, setStudentContactError] = useState('');
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
        let profiles = {};
        try {
          profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
        } catch {}

        const enriched = (Array.isArray(data) ? data : []).map((u) => {
          const p = profiles[u.id] || profiles[u.username];
          const firstName = u.first_name || p?.first_name || '';
          const lastName = u.last_name || p?.last_name || '';
          const fullName = (firstName ? `${firstName} ${lastName || ''}`.trim() : '') || p?.full_name || '';

          return {
            ...u,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            program: u.course_name || u.program || p?.program || p?.course_name || 'B.S in Information Technology',
            year_level: u.year_level || p?.year_level || '1st year',
            student_id: u.student_id || p?.student_id || u.username,
            birth_date: u.birth_date || u.birthdate || p?.birth_date || p?.birthdate || '',
            birthdate: u.birthdate || u.birth_date || p?.birthdate || p?.birth_date || '',
            contact_number: u.contact_number || p?.contact_number || '',
          };
        });

        try {
          localStorage.setItem('regquest_users_cache', JSON.stringify(enriched));
          const creationDates = JSON.parse(localStorage.getItem('regquest_account_creation_dates') || '{}');
          enriched.forEach((u) => {
            if (u.username && u.date_joined) {
              creationDates[u.username.toLowerCase()] = u.date_joined;
              creationDates[String(u.id)] = u.date_joined;
            }
          });
          localStorage.setItem('regquest_account_creation_dates', JSON.stringify(creationDates));
        } catch {}

        if (!ignore) {
          setUsers(enriched);
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
    try {
      const activity = JSON.parse(localStorage.getItem('regquest_account_activity') || '[]');
      const targetName = updatedUser.full_name || updatedUser.username || `User #${updatedUser.id}`;
      activity.unshift({
        id: `act-${Date.now()}`,
        actor: (currentAdmin?.username || 'admin').toLowerCase(),
        actorName: currentAdmin?.full_name || currentAdmin?.username || 'Administrator',
        targetName,
        targetId: updatedUser.username || String(updatedUser.id),
        role: updatedUser.role || 'user',
        action: 'Account Details & Role Permissions Updated',
        timestamp: new Date().toISOString(),
        status: updatedUser.is_active !== false ? 'Active' : 'Inactive',
        type: 'account',
      });
      localStorage.setItem('regquest_account_activity', JSON.stringify(activity.slice(0, 50)));
    } catch {}
  };

  const handleUserDeactivated = (userId) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u))
    );
    try {
      const activity = JSON.parse(localStorage.getItem('regquest_account_activity') || '[]');
      activity.unshift({
        id: `act-${Date.now()}`,
        actor: (currentAdmin?.username || 'admin').toLowerCase(),
        actorName: currentAdmin?.full_name || currentAdmin?.username || 'Administrator',
        targetName: `Account ID #${userId}`,
        targetId: String(userId),
        role: 'user',
        action: 'Account Deactivated (Status: Inactive)',
        timestamp: new Date().toISOString(),
        status: 'Inactive',
        type: 'account',
      });
      localStorage.setItem('regquest_account_activity', JSON.stringify(activity.slice(0, 50)));
    } catch {}
  };

  // Add User Handlers
  const handleAddUserReset = () => {
    setAddUserFirstName('');
    setAddUserFirstNameError('');
    setAddUserLastName('');
    setAddUserLastNameError('');
    setAddUserIdInput('');
    setAddUserIdError('');
    setAddUserEmail('');
    setAddUserContactNumber('');
    setAddUserContactError('');
    setAddUserRole(ROLES.STAFF);
    setIsAddUserOpen(false);
  };

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();

    if (!addUserFirstName.trim()) {
      setAddUserFirstNameError('Please enter a first name.');
      toast.error('Please enter a first name.');
      return;
    }
    if (!isValidName(addUserFirstName)) {
      const msg = 'First Name must not contain numbers or special characters.';
      setAddUserFirstNameError(msg);
      toast.error(msg);
      return;
    }
    if (!addUserLastName.trim()) {
      setAddUserLastNameError('Please enter a last name.');
      toast.error('Please enter a last name.');
      return;
    }
    if (!isValidName(addUserLastName)) {
      const msg = 'Last Name must not contain numbers or special characters.';
      setAddUserLastNameError(msg);
      toast.error(msg);
      return;
    }
    if (!addUserIdInput.trim()) {
      setAddUserIdError('Please enter an ID number.');
      toast.error('Please enter an ID number.');
      return;
    }
    if (!isValidNumericId(addUserIdInput)) {
      const msg = 'ID Number must contain numbers only.';
      setAddUserIdError(msg);
      toast.error(msg);
      return;
    }
    if (!addUserEmail.trim()) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (addUserContactNumber.trim() && !isValidNumericId(addUserContactNumber)) {
      const msg = 'Contact Number must contain numbers only.';
      setAddUserContactError(msg);
      toast.error(msg);
      return;
    }

    setAddUserLoading(true);

    try {
      const firstName = addUserFirstName.trim();
      const lastName = addUserLastName.trim();
      const fullName = `${firstName} ${lastName}`.trim();

      const finalIdNumber = addUserIdInput.trim();

      const contactNo = addUserContactNumber.trim();
      const payload = {
        username: finalIdNumber,
        email: addUserEmail.trim().toLowerCase(),
        password: finalIdNumber,
        role: addUserRole,
        first_name: firstName,
        last_name: lastName,
        ...(contactNo ? { contact_number: contactNo } : {}),
      };

      const res = await usersApi.create(payload);
      let newUser = {
        ...res,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        username: finalIdNumber,
        employee_id: finalIdNumber,
        id_number: finalIdNumber,
        contact_number: contactNo,
      };

      // Patch first_name, last_name, and contact_number via usersApi.update because UserCreateSerializer
      // in Django backend only validates ['username', 'email', 'password', 'role'],
      // whereas UserUpdateSerializer accepts ['first_name', 'last_name', 'email', 'role', 'contact_number', 'is_active']
      if (res?.id && (firstName || lastName || contactNo)) {
        try {
          const patched = await usersApi.update(res.id, {
            first_name: firstName,
            last_name: lastName,
            ...(contactNo ? { contact_number: contactNo } : {}),
          });
          newUser = {
            ...newUser,
            ...patched,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            contact_number: contactNo,
          };
        } catch (patchErr) {
          console.warn('Could not patch user name:', patchErr);
        }
      }

      // Persist user in cache for instant display and login lookup
      try {
        const usersCache = JSON.parse(localStorage.getItem('regquest_users_cache') || '[]');
        const filtered = usersCache.filter((u) => u.id !== newUser.id && u.username !== finalIdNumber);
        localStorage.setItem('regquest_users_cache', JSON.stringify([newUser, ...filtered]));
      } catch (e) {
        console.warn('Could not cache user profile:', e);
      }

      // Persist active email in staff/student profile so it appears in their profile immediately
      try {
        const emailLower = addUserEmail.trim().toLowerCase();
        if (addUserRole === ROLES.STUDENT) {
          const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
          const pData = {
            id: newUser.id,
            username: finalIdNumber,
            student_id: finalIdNumber,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            email: emailLower,
            program: 'B.S. in Information Technology',
            year_level: '1st year',
          };
          profiles[finalIdNumber] = { ...(profiles[finalIdNumber] || {}), ...pData };
          if (newUser.id) profiles[String(newUser.id)] = { ...(profiles[String(newUser.id)] || {}), ...pData };
          localStorage.setItem('regquest_student_profiles', JSON.stringify(profiles));
        } else {
          const staffProfiles = JSON.parse(localStorage.getItem('regquest_staff_profiles') || '{}');
          const sData = {
            id: newUser.id,
            username: finalIdNumber,
            employee_id: finalIdNumber,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            email: emailLower,
            contact_number: contactNo,
            phone: contactNo,
            role: addUserRole,
          };
          staffProfiles[finalIdNumber] = { ...(staffProfiles[finalIdNumber] || {}), ...sData };
          if (newUser.id) staffProfiles[String(newUser.id)] = { ...(staffProfiles[String(newUser.id)] || {}), ...sData };
          localStorage.setItem('regquest_staff_profiles', JSON.stringify(staffProfiles));
        }

        window.dispatchEvent(new CustomEvent('regquest_profile_updated', {
          detail: { username: finalIdNumber, email: emailLower, full_name: fullName }
        }));
      } catch (profileErr) {
        console.warn('Could not cache role profile:', profileErr);
      }

      // Record creation date so new account never receives historical notifications
      try {
        const creationDates = JSON.parse(localStorage.getItem('regquest_account_creation_dates') || '{}');
        const isoNow = res?.date_joined || new Date().toISOString();
        creationDates[finalIdNumber.toLowerCase()] = isoNow;
        if (res?.id) creationDates[String(res.id)] = isoNow;
        localStorage.setItem('regquest_account_creation_dates', JSON.stringify(creationDates));
      } catch {}

      // Record account provisioning in activity log for Profile Overview
      try {
        const activity = JSON.parse(localStorage.getItem('regquest_account_activity') || '[]');
        activity.unshift({
          id: `act-${Date.now()}`,
          actor: (currentAdmin?.username || 'admin').toLowerCase(),
          actorName: currentAdmin?.full_name || currentAdmin?.username || 'Administrator',
          targetName: fullName,
          targetId: finalIdNumber,
          role: addUserRole,
          action: `Account Provisioned (${addUserRole.toUpperCase()}) - Default Password: ID`,
          timestamp: res?.date_joined || new Date().toISOString(),
          status: 'Active',
          type: 'account',
        });
        localStorage.setItem('regquest_account_activity', JSON.stringify(activity.slice(0, 50)));
      } catch {}

      toast.success(`User "${fullName}" (${addUserRole}) account provisioned successfully.`);
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
    setStudentFirstName('');
    setStudentFirstNameError('');
    setStudentLastName('');
    setStudentLastNameError('');
    setStudentIdInput('');
    setStudentIdError('');
    setStudentEmail('');
    setStudentBirthDate('');
    setStudentContactNumber('');
    setStudentContactError('');
    setStudentProgram('');
    setStudentYearLevel('1st year');
    setIsAddStudentOpen(false);
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();

    if (!studentFirstName.trim()) {
      setStudentFirstNameError("Please enter the student's first name.");
      toast.error("Please enter the student's first name.");
      return;
    }
    if (!isValidName(studentFirstName)) {
      const msg = 'First Name must not contain numbers or special characters.';
      setStudentFirstNameError(msg);
      toast.error(msg);
      return;
    }
    if (!studentLastName.trim()) {
      setStudentLastNameError("Please enter the student's last name.");
      toast.error("Please enter the student's last name.");
      return;
    }
    if (!isValidName(studentLastName)) {
      const msg = 'Last Name must not contain numbers or special characters.';
      setStudentLastNameError(msg);
      toast.error(msg);
      return;
    }
    if (!studentIdInput.trim()) {
      setStudentIdError('Please enter the Student ID.');
      toast.error('Please enter the Student ID.');
      return;
    }
    if (!isValidNumericId(studentIdInput)) {
      const msg = 'Student ID must contain numbers only.';
      setStudentIdError(msg);
      toast.error(msg);
      return;
    }
    if (!studentEmail.trim()) {
      toast.error('Please enter a valid active email address.');
      return;
    }
    if (!studentBirthDate) {
      toast.error("Please select the student's birthdate.");
      return;
    }
    if (!studentContactNumber.trim()) {
      setStudentContactError('Please enter a contact number.');
      toast.error('Please enter a contact number.');
      return;
    }
    if (!isValidNumericId(studentContactNumber)) {
      const msg = 'Contact Number must contain numbers only.';
      setStudentContactError(msg);
      toast.error(msg);
      return;
    }
    if (!studentProgram) {
      toast.error('Please select a course for the student.');
      return;
    }

    setAddStudentLoading(true);

    try {
      const firstName = studentFirstName.trim();
      const lastName = studentLastName.trim();
      const fullName = `${firstName} ${lastName}`.trim();

      const finalStudentId = studentIdInput.trim();
      const courseCode = USTP_COURSE_CODE_MAP[studentProgram] || 'IT';

      const payload = {
        username: finalStudentId,
        email: studentEmail.trim().toLowerCase(),
        password: finalStudentId,
        role: ROLES.STUDENT,
        first_name: firstName,
        last_name: lastName,
        course_name: studentProgram.trim(),
        course_code: courseCode,
        birth_date: studentBirthDate || null,
        contact_number: studentContactNumber.trim(),
        year_level: studentYearLevel,
      };

      const res = await usersApi.create(payload);
      let newStudent = {
        ...res,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        student_id: finalStudentId,
        program: studentProgram.trim(),
        course: studentProgram.trim(),
        course_name: studentProgram.trim(),
        course_code: courseCode,
        year_level: studentYearLevel,
        birth_date: studentBirthDate,
        birthdate: studentBirthDate,
        contact_number: studentContactNumber.trim(),
      };

      // Patch profile fields via usersApi.update to ensure course & names are saved in database
      if (res?.id) {
        try {
          const patched = await usersApi.update(res.id, {
            first_name: firstName,
            last_name: lastName,
            course_name: studentProgram.trim(),
            course_code: courseCode,
            birth_date: studentBirthDate || null,
            contact_number: studentContactNumber.trim(),
            year_level: studentYearLevel,
          });
          newStudent = {
            ...newStudent,
            ...patched,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            program: studentProgram.trim(),
            course_name: studentProgram.trim(),
            course_code: courseCode,
          };
        } catch (patchErr) {
          console.warn('Could not patch student name/course in database:', patchErr);
        }
      }

      // Persist student profile in localStorage so name, program, and year level persist everywhere
      try {
        const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
        const pData = {
          id: newStudent.id,
          username: finalStudentId,
          student_id: finalStudentId,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          program: studentProgram.trim(),
          course: studentProgram.trim(),
          course_name: studentProgram.trim(),
          course_code: courseCode,
          year_level: studentYearLevel,
          birth_date: studentBirthDate,
          birthdate: studentBirthDate,
          contact_number: studentContactNumber.trim(),
          email: studentEmail.trim().toLowerCase(),
        };
        profiles[finalStudentId] = pData;
        if (newStudent.id) profiles[newStudent.id] = pData;
        localStorage.setItem('regquest_student_profiles', JSON.stringify(profiles));
      } catch (e) {
        console.warn('Could not cache student profile:', e);
      }

      // Record creation date so new account never receives historical notifications
      try {
        const creationDates = JSON.parse(localStorage.getItem('regquest_account_creation_dates') || '{}');
        const isoNow = res?.date_joined || new Date().toISOString();
        creationDates[finalStudentId.toLowerCase()] = isoNow;
        if (res?.id) creationDates[String(res.id)] = isoNow;
        localStorage.setItem('regquest_account_creation_dates', JSON.stringify(creationDates));
      } catch {}

      // Record student provisioning in activity log for Profile Overview
      try {
        const activity = JSON.parse(localStorage.getItem('regquest_account_activity') || '[]');
        activity.unshift({
          id: `act-${Date.now()}`,
          actor: (currentAdmin?.username || 'admin').toLowerCase(),
          actorName: currentAdmin?.full_name || currentAdmin?.username || 'Administrator',
          targetName: fullName,
          targetId: finalStudentId,
          role: 'student',
          action: 'Student Account Provisioned - Default Password: ID',
          timestamp: res?.date_joined || new Date().toISOString(),
          status: 'Active',
          type: 'account',
        });
        localStorage.setItem('regquest_account_activity', JSON.stringify(activity.slice(0, 50)));
      } catch {}

      toast.success(`Student "${fullName}" account provisioned successfully.`);
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
  const registrars = users.filter((u) => u.role === ROLES.REGISTRAR).length;
  const staffMembers = users.filter((u) => u.role === ROLES.STAFF).length;
  const administrators = users.filter((u) => u.role === ROLES.ADMIN).length;
  const students = users.filter((u) => u.role === ROLES.STUDENT).length;

  const roleDescriptionMap = {
    [ROLES.REGISTRAR]: 'Review and approve/reject credential requests.',
    [ROLES.STAFF]: 'Process approved requests, prepare documents, and update request statuses.',
    [ROLES.ADMIN]: 'Manage user accounts, assign roles, system settings, reports, and monitor overall system activities.',
  };

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
      title: 'Registrar',
      value: registrars,
      pillClass: 'user-stat-pill-indigo',
      icon: (
        <svg className="user-stat-icon text-[#6366F1]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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

            <div className="add-student-grid-2">
              <div>
                <input
                  type="text"
                  placeholder="First Name"
                  value={addUserFirstName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAddUserFirstName(val);
                    setAddUserFirstNameError(getNameError(val, 'First Name'));
                  }}
                  required
                  className={`add-user-input ${addUserFirstNameError ? '!border-red-500 focus:!border-red-500' : ''}`}
                />
                {addUserFirstNameError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{addUserFirstNameError}</p>
                )}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Last Name"
                  value={addUserLastName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAddUserLastName(val);
                    setAddUserLastNameError(getNameError(val, 'Last Name'));
                  }}
                  required
                  className={`add-user-input ${addUserLastNameError ? '!border-red-500 focus:!border-red-500' : ''}`}
                />
                {addUserLastNameError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{addUserLastNameError}</p>
                )}
              </div>
            </div>

            <div className="add-student-grid-2">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="ID Number"
                  value={addUserIdInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAddUserIdInput(val);
                    setAddUserIdError(getNumericIdError(val, 'ID Number'));
                  }}
                  required
                  className={`add-user-input ${addUserIdError ? '!border-red-500 focus:!border-red-500' : ''}`}
                />
                {addUserIdError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{addUserIdError}</p>
                )}
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
            </div>

            <div className="add-student-grid-2">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Contact No. (e.g. 09123456789)"
                  value={addUserContactNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAddUserContactNumber(val);
                    setAddUserContactError(getNumericIdError(val, 'Contact Number'));
                  }}
                  className={`add-user-input ${addUserContactError ? '!border-red-500 focus:!border-red-500' : ''}`}
                />
                {addUserContactError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{addUserContactError}</p>
                )}
              </div>

              <div>
                <select
                  value={addUserRole}
                  onChange={(e) => setAddUserRole(e.target.value)}
                  className="add-user-select"
                >
                  <option value={ROLES.REGISTRAR}>Registrar</option>
                  <option value={ROLES.STAFF}>Staff</option>
                  <option value={ROLES.ADMIN}>Administrator</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="font-bold text-slate-800 capitalize">{addUserRole} Role:</span>
              <span>{roleDescriptionMap[addUserRole]}</span>
            </div>

            <p className="add-user-hint">
              * The user's ID number will be used as their username and default login password.
            </p>

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

            <div className="add-student-grid-2">
              <div>
                <input
                  type="text"
                  placeholder="First Name"
                  value={studentFirstName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStudentFirstName(val);
                    setStudentFirstNameError(getNameError(val, 'First Name'));
                  }}
                  required
                  className={`add-student-input ${studentFirstNameError ? '!border-red-500 focus:!border-red-500' : ''}`}
                />
                {studentFirstNameError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{studentFirstNameError}</p>
                )}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Last Name"
                  value={studentLastName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStudentLastName(val);
                    setStudentLastNameError(getNameError(val, 'Last Name'));
                  }}
                  required
                  className={`add-student-input ${studentLastNameError ? '!border-red-500 focus:!border-red-500' : ''}`}
                />
                {studentLastNameError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{studentLastNameError}</p>
                )}
              </div>
            </div>

            <div className="add-student-grid-2">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Student ID (e.g. 2023123456)"
                  value={studentIdInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStudentIdInput(val);
                    setStudentIdError(getNumericIdError(val, 'Student ID'));
                  }}
                  required
                  className={`add-student-input ${studentIdError ? '!border-red-500 focus:!border-red-500' : ''}`}
                />
                {studentIdError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{studentIdError}</p>
                )}
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Birthdate
                </label>
                <input
                  type="date"
                  value={studentBirthDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setStudentBirthDate(e.target.value)}
                  required
                  className="add-student-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Contact Number (e.g. 09123456789)"
                  value={studentContactNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStudentContactNumber(val);
                    setStudentContactError(getNumericIdError(val, 'Contact Number'));
                  }}
                  required
                  className={`add-student-input ${studentContactError ? '!border-red-500 focus:!border-red-500' : ''}`}
                />
                {studentContactError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{studentContactError}</p>
                )}
              </div>
            </div>

            <div className="add-student-grid-2">
              <div>
                <CourseSelectDropdown
                  value={studentProgram}
                  onChange={setStudentProgram}
                  required
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
