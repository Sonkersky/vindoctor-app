'use client';

import Link from 'next/link';
import { useLocale } from './i18n/LocaleContext';

// Wcześniej to były same <button onClick={router.push}> — Googlebot odkrywa
// nowe strony podążając za prawdziwymi linkami (<a href>), nie klikając w
// przyciski JS, więc paginacja była dla crawlera praktycznie niewidoczna
// poza tym, co i tak trafiało do sitemapy. <Link> renderuje realny <a href>
// (Next.js robi to niezależnie od tego, czy komponent jest 'use client'),
// nawigacja klient-side działa dalej tak samo, tylko Google ma czego się złapać.
function buildHref(page, filtersQueryString) {
  const params = new URLSearchParams(filtersQueryString);
  if (page > 1) {
    params.set('page', String(page));
  } else {
    params.delete('page');
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Odtwarza dokładnie tę samą logikę co oryginalny JS: okno 10 numerków stron
// przesuwające się wraz z bieżącą stroną, Next wyłączony gdy strona nie była pełna.
export default function PaginationBar({ currentPage, hasNextPage, filtersQueryString }) {
  const { t } = useLocale();
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
      {currentPage > 1 ? (
        <Link className="btn btn-secondary" href={buildHref(currentPage - 1, filtersQueryString)} onClick={scrollToTop}>
          {t('previous')}
        </Link>
      ) : (
        <button className="btn btn-secondary" disabled>
          {t('previous')}
        </button>
      )}
      <div className="page-numbers">
        {pageNumbers.map((num) => (
          <Link
            key={num}
            className={`page-btn ${num === currentPage ? 'active' : ''}`}
            href={buildHref(num, filtersQueryString)}
            onClick={scrollToTop}
          >
            {num}
          </Link>
        ))}
      </div>
      {hasNextPage ? (
        <Link className="btn btn-primary" href={buildHref(currentPage + 1, filtersQueryString)} onClick={scrollToTop}>
          {t('next')}
        </Link>
      ) : (
        <button className="btn btn-primary" disabled>
          {t('next')}
        </button>
      )}
    </div>
  );
}
