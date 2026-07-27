'use client';

import { useRouter } from 'next/navigation';

// Odtwarza dokładnie tę samą logikę co oryginalny JS: okno 10 numerków stron
// przesuwające się wraz z bieżącą stroną, Next wyłączony gdy strona nie była pełna.
export default function PaginationBar({ currentPage, hasNextPage, filtersQueryString }) {
  const router = useRouter();

  function goToPage(page) {
    if (page < 1) return;
    const params = new URLSearchParams(filtersQueryString);
    if (page > 1) {
      params.set('page', String(page));
    } else {
      params.delete('page');
    }
    router.push(`/?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const windowSize = 10;
  const windowStart = Math.max(1, currentPage - 4);
  const pageNumbers = Array.from({ length: windowSize }, (_, i) => windowStart + i);

  return (
    <div
      id="paginationBar"
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '14px',
        marginTop: '10px',
      }}
    >
      <button
        className="btn btn-secondary"
        disabled={currentPage <= 1}
        onClick={() => goToPage(currentPage - 1)}
      >
        ← Prev
      </button>
      <div className="page-numbers">
        {pageNumbers.map((num) => (
          <button
            key={num}
            className={`page-btn ${num === currentPage ? 'active' : ''}`}
            onClick={() => goToPage(num)}
          >
            {num}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" disabled={!hasNextPage} onClick={() => goToPage(currentPage + 1)}>
        Next →
      </button>
    </div>
  );
}
