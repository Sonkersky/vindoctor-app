import Link from 'next/link';

// stroke="currentColor" (nie na sztywno niebieski) — .view-toggle-btn.active
// ma ciemny tekst na jasnoniebieskim tle, więc ikonka ma automatycznie
// dopasować kolor do stanu aktywne/nieaktywne zamiast zostawać zawsze
// niebieska.
const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconArchive() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
      <path d="M4.5 8.5V18a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5V8.5" />
      <path d="M10 13h4" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M13 2L4 14h6.5L11 22l9-12h-6.5L13 2z" />
    </svg>
  );
}

// Zwykłe <Link> (realne <a href>), nie router.push z klienta — ten sam powód
// co przy PaginationBar: Google podąża za linkami, nie klika w JS-owe
// przyciski. Zachowuje aktualne filtry, resetuje tylko numer strony.
// Domyślny widok (brak parametru) to Actual — patrz isActiveView w
// app/page.js — więc to Archive teraz musi być jawnym parametrem w URL.
function buildHref(view, filtersQueryString) {
  const params = new URLSearchParams(filtersQueryString);
  params.delete('page');
  if (view === 'archive') {
    params.set('view', 'archive');
  } else {
    params.delete('view');
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

export default function ActiveArchiveToggle({ isActiveView, filtersQueryString, t }) {
  return (
    <div className="view-toggle">
      <Link
        href={buildHref('archive', filtersQueryString)}
        className={`view-toggle-btn ${!isActiveView ? 'active' : ''}`}
      >
        <IconArchive />
        {t('archive')}
      </Link>
      <Link
        href={buildHref('active', filtersQueryString)}
        className={`view-toggle-btn ${isActiveView ? 'active' : ''}`}
      >
        <IconBolt />
        {t('actual')}
      </Link>
    </div>
  );
}
