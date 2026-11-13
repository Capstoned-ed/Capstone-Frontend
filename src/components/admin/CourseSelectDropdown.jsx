import React, { useState, useRef, useEffect, useMemo } from 'react';

export const USTP_COURSE_GROUPS = [
  {
    id: 'cea',
    category: 'CEA (College of Engineering & Architecture)',
    shortCategory: 'CEA',
    courses: [
      { name: 'BS in Architecture (BS Arch)', code: 'BS Arch' },
      { name: 'BS in Civil Engineering (BSCE)', code: 'BSCE' },
      { name: 'BS in Computer Engineering (BSCpE)', code: 'BSCpE' },
      { name: 'BS in Electrical Engineering (BSEE)', code: 'BSEE' },
      { name: 'BS in Geodetic Engineering (BSGE)', code: 'BSGE' },
      { name: 'BS in Mechanical Engineering (BSME)', code: 'BSME' },
    ],
  },
  {
    id: 'citc',
    category: 'CITC (College of Information Technology & Computing)',
    shortCategory: 'CITC',
    courses: [
      { name: 'BS in Information Technology (BSIT)', code: 'BSIT' },
      { name: 'BS in Computer Science (BSCS)', code: 'BSCS' },
      { name: 'BS in Technology Communication Management (BSTCM)', code: 'BSTCM' },
      { name: 'BS in Data Science (BSDS)', code: 'BSDS' },
    ],
  },
  {
    id: 'csm',
    category: 'CSM (College of Science & Mathematics)',
    shortCategory: 'CSM',
    courses: [
      { name: 'BS in Applied Mathematics', code: 'BSAM' },
      { name: 'BS in Applied Physics', code: 'BSAP' },
      { name: 'BS in Chemistry', code: 'BSChem' },
      { name: 'BS in Environmental Science', code: 'BSES' },
      { name: 'BS in Food Technology (BSFT)', code: 'BSFT' },
    ],
  },
  {
    id: 'cste',
    category: 'CSTE (College of Science & Technology Education)',
    shortCategory: 'CSTE',
    courses: [
      { name: 'Bachelor of Secondary Education (BSEd) - Major in Mathematics', code: 'BSEd-Math' },
      { name: 'Bachelor of Secondary Education (BSEd) - Major in Science', code: 'BSEd-Sci' },
      { name: 'Bachelor of Technical-Vocational Teacher Education (BTVTEd)', code: 'BTVTEd' },
      { name: 'Bachelor of Technology and Livelihood Education (BTLEd)', code: 'BTLEd' },
    ],
  },
  {
    id: 'cot',
    category: 'COT (College of Technology)',
    shortCategory: 'COT',
    courses: [
      { name: 'BET - Automotive Engineering Technology', code: 'BET-Auto' },
      { name: 'BET - Electrical Engineering Technology', code: 'BET-EET' },
      { name: 'BET - Electronics Engineering Technology', code: 'BET-ECT' },
      { name: 'BET - Mechanical & Manufacturing Engineering Technology', code: 'BET-MMET' },
      { name: 'BET - Civil Engineering Technology / Construction', code: 'BET-CET' },
      { name: 'BET - Heating, Ventilating, Air-Conditioning & Refrigeration (HVAC/R) Technology', code: 'BET-HVAC' },
      { name: 'BET - Mechatronics Engineering Technology', code: 'BET-MEC' },
      { name: 'BET - Electro-Mechanical Technology', code: 'BET-EMT' },
    ],
  },
];

export const USTP_COURSE_CODE_MAP = USTP_COURSE_GROUPS.reduce((acc, group) => {
  group.courses.forEach((c) => {
    acc[c.name] = c.code;
  });
  return acc;
}, {});

export default function CourseSelectDropdown({ value, onChange, required = false, disabled = false, allowClear = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openUpward, setOpenUpward] = useState(false);
  const [maxPopoverHeight, setMaxPopoverHeight] = useState(380);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keep dropdown within viewport (flip upward when space below is tight)
  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (!dropdownRef.current) return;
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const shouldOpenUp = spaceBelow < 320 && spaceAbove > spaceBelow;
      setOpenUpward(shouldOpenUp);
      const available = shouldOpenUp ? spaceAbove : spaceBelow;
      setMaxPopoverHeight(Math.max(200, Math.min(390, available)));
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setSelectedCategory('all');
    }
  }, [isOpen]);

  // Filtered courses based on search & category pill
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return USTP_COURSE_GROUPS.map((group) => {
      // Category filter
      if (selectedCategory !== 'all' && group.id !== selectedCategory) {
        return { ...group, courses: [] };
      }

      // Search query filter
      if (!q) {
        return group;
      }

      const matchingCourses = group.courses.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          group.category.toLowerCase().includes(q)
      );

      return {
        ...group,
        courses: matchingCourses,
      };
    }).filter((group) => group.courses.length > 0);
  }, [searchQuery, selectedCategory]);

  const selectedCourseObj = useMemo(() => {
    if (!value) return null;
    for (const group of USTP_COURSE_GROUPS) {
      const found = group.courses.find((c) => c.name === value || c.code === value);
      if (found) return found;
    }
    return { name: value, code: USTP_COURSE_CODE_MAP[value] || 'Course' };
  }, [value]);

  const handleSelect = (courseName) => {
    onChange(courseName);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full text-left bg-white border rounded-lg px-3.5 py-2.5 text-sm transition-all flex items-center justify-between gap-2 shadow-xs cursor-pointer ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
            : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
          </svg>

          {selectedCourseObj ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#0B0B36] text-[#F5B014] shrink-0">
                {selectedCourseObj.code}
              </span>
              <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate">
                {selectedCourseObj.name}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-xs sm:text-sm font-normal">
              Select Course / Program
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {allowClear && selectedCourseObj && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Clear selection"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Hidden input for HTML form validation */}
      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required
          tabIndex={-1}
          className="sr-only opacity-0 pointer-events-none absolute"
        />
      )}

      {/* Popover Dropdown Card */}
      {isOpen && (
        <div
          style={{ maxHeight: `${maxPopoverHeight}px` }}
          className={`absolute left-0 right-0 z-50 bg-white rounded-xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col animate-in fade-in duration-150 ${
            openUpward ? 'bottom-full mb-1.5 slide-in-from-bottom-1' : 'top-full mt-1.5 slide-in-from-top-1'
          }`}
        >
          {/* Search Header */}
          <div className="p-3 bg-slate-50 border-b border-slate-200/80 space-y-2.5">
            <div className="relative flex items-center">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search course or code (e.g. IT, Civil, BET, BSCE)..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-[#0B0B36] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Courses
              </button>
              {USTP_COURSE_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedCategory(group.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    selectedCategory === group.id
                      ? 'bg-[#0B0B36] text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {group.shortCategory}
                </button>
              ))}
            </div>
          </div>

          {/* Course Options List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 p-1.5">
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <div key={group.category} className="py-1">
                  {/* Category Header */}
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/70 rounded-md mb-1 flex items-center justify-between">
                    <span>{group.category}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({group.courses.length})</span>
                  </div>

                  {/* Course Items */}
                  <div className="space-y-0.5">
                    {group.courses.map((course) => {
                      const isSelected = value === course.name;

                      return (
                        <button
                          key={course.name}
                          type="button"
                          onClick={() => handleSelect(course.name)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200 shadow-xs'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span
                              className={`px-2 py-0.5 text-[10.5px] font-bold rounded shrink-0 font-mono ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {course.code}
                            </span>
                            <span className="truncate">{course.name}</span>
                          </div>

                          {isSelected && (
                            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                <p>No matching courses found for "{searchQuery}".</p>
                <p className="mt-1 text-[11px] text-slate-400">Try searching for "BSIT", "Civil", "Arch", or "BET".</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

