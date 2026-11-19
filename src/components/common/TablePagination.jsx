import React from 'react';

/**
 * Shared numbered pagination bar for admin/staff data tables.
 * Displays item range on the left and `< Prev  1 2 3 ...  Next >` controls on the right.
 */
export default function TablePagination({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
  accentColor = 'blue',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  const buildPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    if (safePage > 3) pages.push('...');
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    if (safePage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const handlePageSelect = (e, nextPage) => {
    e.currentTarget.blur();
    const prevScrollY = window.scrollY;
    onPageChange(nextPage);
    requestAnimationFrame(() => {
      if (window.scrollY !== prevScrollY) {
        window.scrollTo(0, prevScrollY);
      }
    });
  };

  const activeBtnClass =
    accentColor === 'emerald'
      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
      : 'bg-[#0B0B36] text-white border-[#0B0B36] shadow-xs';

  return (
    <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
      <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
        Showing <span className="font-bold text-slate-700">{startItem}–{endItem}</span> of{' '}
        <span className="font-bold text-slate-700">{totalItems}</span>
      </p>

      <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={(e) => handlePageSelect(e, safePage - 1)}
          disabled={safePage === 1}
          className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          &lsaquo; Prev
        </button>

        {buildPageNumbers().map((item, idx) =>
          item === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-1 sm:px-1.5 text-[11px] sm:text-xs text-slate-400 select-none">
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={(e) => handlePageSelect(e, item)}
              aria-current={safePage === item ? 'page' : undefined}
              className={`min-w-[26px] sm:min-w-[30px] h-[26px] sm:h-[30px] px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-bold border transition-colors cursor-pointer ${
                safePage === item
                  ? activeBtnClass
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          onClick={(e) => handlePageSelect(e, safePage + 1)}
          disabled={safePage === totalPages}
          className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Next &rsaquo;
        </button>
      </div>
    </div>
  );
}
