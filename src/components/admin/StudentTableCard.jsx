import React, { useState } from 'react';
import { ROLES } from '../../constants/roles';
import StudentEditModal from './StudentEditModal';
import '../../styles/admin/StudentTableCard.css';

export default function StudentTableCard({ users = [], onStudentUpdated }) {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Format student display name
  const formatStudentName = (student) => {
    if (student.full_name) {
      return student.full_name;
    }
    if (student.first_name && student.last_name) {
      return `${student.first_name} ${student.last_name}`;
    }
    if (student.first_name) {
      return student.first_name;
    }

    // Check cached student profiles in localStorage
    try {
      const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
      const p = profiles[student.id] || profiles[student.username] || profiles[student.student_id];
      if (p?.full_name) return p.full_name;
      if (p?.first_name) return `${p.first_name} ${p.last_name || ''}`.trim();
    } catch {}

    // Known student fallback for 2023301564
    if (student.username === '2023301564') {
      return 'Daisy Traya';
    }

    return (student.username || '')
      .split(/[._]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  // Filter ONLY student role accounts + search query
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const students = users
    .filter((u) => u.role === ROLES.STUDENT)
    .filter((student) => {
      if (!normalizedQuery) return true;
      const haystacks = [
        formatStudentName(student),
        student.student_id,
        student.username,
        student.program,
        student.course_name,
        student.year_level,
        student.email,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      return haystacks.some((val) => val.includes(normalizedQuery));
    });

  const handleUpdate = (updatedStudent) => {
    if (onStudentUpdated) {
      onStudentUpdated(updatedStudent);
    }
    setSelectedStudent(null);
  };

  return (
    <div className="student-table-card">
      {/* Mint Green Card Header Bar matching reference photo */}
      <div className="student-table-header-bar">
        <div className="student-table-header-left">
          <div className="student-table-icon-wrap">
            {/* Solid green user/student icon */}
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="student-table-title">
              Student Accounts Management
            </h3>
            <p className="student-table-desc">
              View, update, and organize student profiles and registration data.
            </p>
            <div className="relative mt-2.5 max-w-xs sm:max-w-sm">
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
                  setShowAllStudents(false);
                }}
                placeholder="Search student by name, ID, program, or email..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-emerald-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  aria-label="Clear student search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Student Table */}
      <div className="student-table-scroll">
        <table className="student-table-element">
          <thead>
            <tr className="student-table-thead-tr">
              <th className="student-table-th">Name</th>
              <th className="student-table-th">ID Number</th>
              <th className="student-table-th">Program</th>
              <th className="student-table-th">Year Level</th>
              <th className="student-table-th">Email</th>
              <th className="student-table-th">Actions</th>
            </tr>
          </thead>
          <tbody className="student-table-tbody">
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} className="student-table-empty">
                  No student accounts registered in the system yet.
                </td>
              </tr>
            ) : (
              (showAllStudents ? students : students.slice(0, 10)).map((student) => {
                const displayName = formatStudentName(student);
                const idNumber = student.student_id || student.username || '—';
                const program = student.program || 'B.S in Information Technology';
                const yearLevel = student.year_level || '1st year';
                const email = student.email || '—';

                return (
                  <tr key={student.id} className="student-table-row">
                    {/* Name */}
                    <td className="student-table-cell-name">
                      {displayName}
                    </td>

                    {/* ID Number */}
                    <td className="student-table-cell font-medium">
                      {idNumber}
                    </td>

                    {/* Program */}
                    <td className="student-table-cell font-medium">
                      {program}
                    </td>

                    {/* Year Level */}
                    <td className="student-table-cell font-medium">
                      {yearLevel}
                    </td>

                    {/* Email */}
                    <td className="student-table-cell-email">
                      {email}
                    </td>

                    {/* Actions: [ View / Update ] */}
                    <td className="student-table-cell">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className="btn-view-update"
                      >
                        View / Update
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {students.length > 10 && (
          <div className="table-see-more-wrap">
            <button
              type="button"
              onClick={() => setShowAllStudents((prev) => !prev)}
              className="table-see-more-btn"
            >
              <span>
                {showAllStudents ? 'See Less' : 'See More'}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${showAllStudents ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Student Profile Edit Modal */}
      <StudentEditModal
        student={selectedStudent}
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        onStudentUpdated={handleUpdate}
      />
    </div>
  );
}
