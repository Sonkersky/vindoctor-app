import Link from 'next/link';

// Zwykłe <Link> (realne <a href>), nie router.push z klienta — ten sam powód
// co przy PaginationBar: Google podąża za linkami, nie klika w JS-owe
// przyciski. Zachowuje aktualne filtry, resetuje tylko numer strony.
function buildHref(view, filtersQueryString) {
  const params = new URLSearchParams(filtersQueryString);
  params.delete('page');
  if (view === 'active') {
    params.set('view', 'active');
  } else {
    params.delete('view');
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

export default function ActiveArchiveToggle({ isActiveView, filtersQueryString }) {
  return (
    <div className="view-toggle">
      <Link
        href={buildHref('archive', filtersQueryString)}
        className={`view-toggle-btn ${!isActiveView ? 'active' : ''}`}
      >
        Archive
      </Link>
      <Link
        href={buildHref('active', filtersQueryString)}
        className={`view-toggle-btn ${isActiveView ? 'active' : ''}`}
      >
        Actual
      </Link>
    </div>
  );
}
