import React, { useState } from 'react';
import usersApi from '../../api/users';
import useToast from '../../hooks/useToast';
import CourseSelectDropdown, { USTP_COURSE_CODE_MAP } from './CourseSelectDropdown';

function StudentEditForm({ student, onClose, onStudentUpdated }) {
  const toast = useToast();
  const cachedProfile = (() => {
    try {
      const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
      return profiles[student.id] || profiles[student.student_id] || profiles[student.username] || {};
    } catch {
      return {};
    }
  })();

  const [formData, setFormData] = useState({
    first_name: student.first_name || cachedProfile.first_name || '',
    last_name: student.last_name || cachedProfile.last_name || '',
    student_id: student.student_id || student.username || cachedProfile.student_id || '',
    email: student.email || cachedProfile.email || '',
    birth_date: student.birth_date || student.birthdate || cachedProfile.birth_date || cachedProfile.birthdate || '',
    contact_number: student.contact_number || cachedProfile.contact_number || '',
    program: student.course_name || student.program || cachedProfile.course_name || cachedProfile.program || 'BS in Information Technology (BSIT)',
    year_level: student.year_level || cachedProfile.year_level || '1st year',
    is_active: student.is_active ?? true,
  });

  const [contactError, setContactError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'contact_number') {
      setContactError(value && /\D/.test(value) ? 'Contact Number must contain numbers only.' : '');
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.contact_number.trim() && /\D/.test(formData.contact_number.trim())) {
      const msg = 'Contact Number must contain numbers only.';
      setContactError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);

    try {
      const courseName = formData.program.trim();
      const courseCode = USTP_COURSE_CODE_MAP[courseName] || student.course_code || '';
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        course_name: courseName,
        ...(courseCode ? { course_code: courseCode } : {}),
        birth_date: formData.birth_date || null,
        contact_number: formData.contact_number.trim(),
        year_level: formData.year_level,
        is_active: formData.is_active,
      };

      const updated = await usersApi.update(student.id, payload);
      // Merge local extended profile info including edited student ID, birthdate, and contact number
      const fullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();
      const merged = {
        ...updated,
        student_id: formData.student_id.trim() || student.username,
        username: formData.student_id.trim() || student.username,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        full_name: fullName || formData.first_name.trim() || student.username,
        birth_date: formData.birth_date,
        birthdate: formData.birth_date,
        contact_number: formData.contact_number.trim(),
        program: courseName,
        course_name: courseName,
        ...(courseCode ? { course_code: courseCode } : {}),
        year_level: formData.year_level,
      };

      // Also persist student profile in localStorage
      try {
        const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
        const pKey = merged.student_id || merged.username;
        profiles[pKey] = merged;
        if (merged.id) profiles[merged.id] = merged;
        localStorage.setItem('regquest_student_profiles', JSON.stringify(profiles));
      } catch {}

      toast.success(`Student profile for "${fullName || merged.username}" updated successfully.`);
      if (onStudentUpdated) {
        onStudentUpdated(merged);
      }
      onClose();
    } catch (err) {
      console.error('Failed to update student:', err);
      const resData = err.response?.data;
      let errMsg = 'Failed to update student profile.';
      if (resData && typeof resData === 'object') {
        const firstErr = Object.values(resData)[0];
        errMsg = Array.isArray(firstErr) ? firstErr.join(' ') : String(firstErr);
      }
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-visible border border-slate-200 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#E6F8EE] border-b border-emerald-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-emerald-600 flex items-center justify-center shadow-xs">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Update Student Profile
              </h3>
              <p className="text-xs text-emerald-800">
                Student ID: <span className="font-semibold">{formData.student_id || student.username}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Row 1: First Name & Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Row 2: Student ID & Active Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Student ID
              </label>
              <input
                type="text"
                name="student_id"
                value={formData.student_id}
                onChange={handleChange}
                placeholder="Student ID (e.g. 2023123456)"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Active Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Row 3: Birthdate & Contact Number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Birthdate
              </label>
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date}
                max={new Date().toISOString().split('T')[0]}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                inputMode="numeric"
                name="contact_number"
                value={formData.contact_number}
                onChange={handleChange}
                placeholder="e.g. 09123456789"
                className={`w-full px-3 py-2 text-xs bg-white border rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 ${
                  contactError
                    ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {contactError && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{contactError}</p>
              )}
            </div>
          </div>

          {/* Row 4: Course & Year Level */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Course
              </label>
              <CourseSelectDropdown
                value={formData.program}
                onChange={(selectedCourse) =>
                  setFormData((prev) => ({ ...prev, program: selectedCourse }))
                }
                allowClear={false}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Year Level
              </label>
              <select
                name="year_level"
                value={formData.year_level}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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

          {/* Row 4: Account Status */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Account Active</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
            </label>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-bold bg-[#0B0B36] hover:bg-indigo-950 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {loading && (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StudentEditModal({ student, isOpen, onClose, onStudentUpdated }) {
  if (!isOpen || !student) return null;
  return (
    <StudentEditForm
      key={student.id}
      student={student}
      onClose={onClose}
      onStudentUpdated={onStudentUpdated}
    />
  );
}
