import Link from 'next/link';
import './page.css';
import FilterSidebar from './FilterSidebar';
import ActiveArchiveToggle from './ActiveArchiveToggle';
import AccountBar from './AccountBar';
import PaginationBar from './PaginationBar';
import TileImageCarousel from './TileImageCarousel';
import FavoriteButton from './FavoriteButton';
import MileageValue from './MileageValue';
import VinSearchForm from './VinSearchForm';
import HomeGridAligner from './HomeGridAligner';
import { listCars, listActiveLots, getMakesAndModels, getLotCounts, getPriceStats } from '@/lib/queries';
import { formatPrice } from '@/lib/format';
import { getServerTranslator } from '@/lib/i18n/server';

// Proste, jednokolorowe ikony (niebieskie, minimalistyczne) zamiast emoji —
// każda ma stały rozmiar/grubość kreski, żeby pasowały do siebie w rzędzie.
const ICON_PROPS = {
  width: 12,
  height: 12,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: '#38bdf8',
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconPin() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconGauge() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12l3.5-3.5" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="7" cy="15" r="3.5" />
      <path d="M10.3 11.7L20 2" />
      <path d="M16.5 5.5l3 3" />
      <path d="M14 8l2 2" />
    </svg>
  );
}

function IconWrench() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

// Ikonki dla banera "Lowest/Average/Highest Price" — stroke="currentColor",
// bo każda pozycja ma inny kolor kółka pod spodem (patrz .price-stats-icon-*
// w page.css), więc kolor ma przejmować z rodzica zamiast być na sztywno.
const STATS_ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconArrowDown() {
  return (
    <svg {...STATS_ICON_PROPS}>
      <path d="M12 4v14" />
      <path d="M6 13l6 6 6-6" />
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg {...STATS_ICON_PROPS}>
      <path d="M12 20V6" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

function IconBars() {
  return (
    <svg {...STATS_ICON_PROPS}>
      <path d="M6 20V11" />
      <path d="M12 20V4" />
      <path d="M18 20V15" />
    </svg>
  );
}

function tileStatusPillClass(saleStatus) {
  const s = (saleStatus || '').toLowerCase();
  if (s.includes('not sold')) return 'status-not-sold';
  if (s.includes('sold')) return 'status-sold';
  return 'status-other';
}

function CarTile({ car, isActiveView, t }) {
  const site = car.base_site === 'iaai' ? 'iaai' : 'copart';
  const images =
    car.link_img_small && car.link_img_small.length
      ? car.link_img_small
      : car.link_img_hd && car.link_img_hd.length
        ? car.link_img_hd
        : [];
  const title = car.title || `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();
  const isBuyNow = (car.sale_status || '').toLowerCase() === 'sold' && (car.sale_type || '').toLowerCase() === 'buynow';

  return (
    <div
      className="car-tile"
      data-make={(car.make || '').toLowerCase()}
      data-year={car.year || ''}
      data-auction={site}
      data-state={car.state || ''}
    >
      <div className="card-image-outer">
        <Link href={`/lot/${encodeURIComponent(car.vin)}`} className="card-image-wrapper">
          <TileImageCarousel images={images} alt={title} />
          <div className="tile-badges">
            {/* Widok "Actual" (active_lots) to loty jeszcze niesprzedane —
                nie mają statusu sprzedaży, więc nie ma czego tu pokazać. */}
            {isActiveView ? null : isBuyNow ? (
              <span className="tile-status-pill buynow-badge">⚡ Sold by BUY NOW</span>
            ) : (
              car.sale_status && (
                <span className={`tile-status-pill ${tileStatusPillClass(car.sale_status)}`}>{car.sale_status}</span>
              )
            )}
            <span className={`auction-badge ${site}`}>{site.toUpperCase()}</span>
          </div>
        </Link>
        {/* Poza <Link>, bo <button> zagnieżdżony w <a> jest niepoprawnym HTML-em
            i psuje nawigację — pozycjonowany absolutnie nad zdjęciem. */}
        <FavoriteButton vin={car.vin} />
      </div>
      <div className="card-body">
        <Link href={`/lot/${encodeURIComponent(car.vin)}`} className="car-title-link">
          <h2 className="car-title">{title}</h2>
        </Link>
        <div className="vin-number">VIN: {car.vin}</div>
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label"><IconPin /> {t('location')}</span>
            <span className="detail-value">{car.location || car.state || ''}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><IconGauge /> {t('odometer')}</span>
            <span className="detail-value">
              <MileageValue odometer={car.odometer} unit={car.odometer_index} />
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><IconKey /> {t('status')}</span>
            <span className="detail-value">{car.status || ''}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><IconWrench /> {t('damage')}</span>
            <span className="detail-value">{car.damage_pr || ''}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><IconDocument /> {t('saleDocument')}</span>
            <span className="detail-value">{car.document || 'N/A'}</span>
          </div>
        </div>
        <div className="card-footer">
          <div className="price-box-inner">
            <span className="price-label">{isActiveView ? t('currentBid') : t('finalPrice')}</span>
            <span className="price-value">
              {isActiveView && !car.purchase_price ? t('noBidsYet') : formatPrice(car)}
            </span>
          </div>
          <Link href={`/lot/${encodeURIComponent(car.vin)}`} className="view-lot-btn">
            {t('viewLot')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  description:
    'Browse thousands of sold US car auction records from Copart and IAAI. Search by VIN, make, model, year, mileage and damage type.',
  alternates: { canonical: '/' },
};

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;

  const filters = {
    site: sp.site || '',
    make: sp.make || '',
    model: sp.model || '',
    trim: sp.trim || '',
    damage: sp.damage || '',
    status: sp.status || '',
    sellerCategory: sp.sellerCategory || '',
    fuel: sp.fuel || '',
    cylinders: sp.cylinders || '',
    vehicleType: sp.vehicleType || '',
    yearFrom: sp.yearFrom || '',
    yearTo: sp.yearTo || '',
    mileageFrom: sp.mileageFrom || '',
    mileageTo: sp.mileageTo || '',
    engineSizeFrom: sp.engineSizeFrom || '',
    engineSizeTo: sp.engineSizeTo || '',
  };
  const page = Math.max(1, Number(sp.page) || 1);

  // "Actual" = jeszcze niesprzedane loty, zasilane z active_lots (patrz
  // app/api/sync-active/route.js + scripts/backfill-active.js) — osobna
  // tabela od "cars" (Archive), bo klucz naturalny to lot_id, nie VIN
  // (patrz komentarz w supabase/schema.sql). Domyślny widok (brak parametru
  // "view" w URL) to teraz Actual — trzeba jawnie wybrać ?view=archive.
  const isActiveView = sp.view !== 'archive';

  // Statystyki cenowe tylko po wybraniu marki — bez sensu (i bez potrzeby
  // odpytywania bazy) dla domyślnego, niefiltrowanego widoku. Zawsze liczone
  // z danych historycznych ("cars"), nawet w widoku Actual — pokazują, za ile
  // podobne auta faktycznie się sprzedawały, co jest przydatnym kontekstem
  // przy przeglądaniu jeszcze trwających aukcji.
  const [{ cars, hasNextPage, lastPageInWindow }, makesModels, lotCounts, priceStats, { t }] = await Promise.all([
    isActiveView ? listActiveLots(filters, page) : listCars(filters, page),
    getMakesAndModels(),
    getLotCounts(),
    filters.make ? getPriceStats(filters) : Promise.resolve({ min: null, max: null, avg: null, count: 0 }),
    getServerTranslator(),
  ]);

  const filtersQueryString = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v)
  ).toString();

  return (
    <>
    <HomeGridAligner />
    <div className="container">
      {/* LOGO */}
      <div className="header-logo">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_2.png" alt="DOCTOR.VIN" className="logo-img" />
        </Link>
      </div>

      {/* TOP SEARCH BAR */}
      <div className="top-search-row">
        <div className="top-search-section">
          <VinSearchForm />
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="main-layout">
        <div className="sidebar-column">
          <AccountBar variant="sidebar" />
          <ActiveArchiveToggle isActiveView={isActiveView} filtersQueryString={filtersQueryString} t={t} />
          <FilterSidebar makesModels={makesModels} initialFilters={{ ...filters, page: String(page) }} />
        </div>

        {/* VEHICLES GRID */}
        <main className="car-grid">
          {priceStats.count > 0 && (
            <div className="price-stats-banner">
              <div className="price-stats-item price-stats-item-low">
                <span className="price-stats-icon"><IconArrowDown /></span>
                <div className="price-stats-text">
                  <span className="price-stats-label">{t('low')}</span>
                  <span className="price-stats-value">${Math.round(priceStats.min).toLocaleString('en-US')}</span>
                </div>
              </div>
              <div className="price-stats-item price-stats-item-avg">
                <span className="price-stats-icon"><IconBars /></span>
                <div className="price-stats-text">
                  <span className="price-stats-label">{t('average')}</span>
                  <span className="price-stats-value">${Math.round(priceStats.avg).toLocaleString('en-US')}</span>
                </div>
              </div>
              <div className="price-stats-item price-stats-item-high">
                <span className="price-stats-icon"><IconArrowUp /></span>
                <div className="price-stats-text">
                  <span className="price-stats-label">{t('high')}</span>
                  <span className="price-stats-value">${Math.round(priceStats.max).toLocaleString('en-US')}</span>
                </div>
              </div>
            </div>
          )}

          {cars.length === 0 ? (
            <div id="noResults" style={{ display: 'block' }}>
              <h3>{t('noResultsTitle')}</h3>
              <p style={{ marginTop: '8px' }}>{t('noResultsHint')}</p>
            </div>
          ) : (
            cars.map((car) => <CarTile key={car.vin} car={car} isActiveView={isActiveView} t={t} />)
          )}

          {cars.length > 0 && (
            <PaginationBar
              currentPage={page}
              hasNextPage={hasNextPage}
              filtersQueryString={filtersQueryString}
              lastPageInWindow={lastPageInWindow}
            />
          )}
        </main>
      </div>
    </div>

      {/* STOPKA / FOOTER */}
      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-col">
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_2.png" alt="DOCTOR.VIN Logo" className="footer-logo" />
            </Link>
            <p className="footer-text">
              {t('footerContact')}
              <br />
              {t('footerContact2')}
              <br />
              <a href="mailto:contact@doctor.vin" className="footer-email">
                contact@doctor.vin
              </a>
            </p>
          </div>

          <div className="footer-col">
            <h4 className="footer-heading">{t('information')}</h4>
            <ul className="footer-links">
              <li>
                <a href="#">{t('termsConditions')}</a>
              </li>
              <li>
                <a href="#">{t('privacyPolicy')}</a>
              </li>
              <li>
                <a href="#">{t('vinFaq')}</a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-heading">{t('statistics')}</h4>
            <ul className="stats-list">
              <li>
                {t('lots')} <span>{lotCounts.total.toLocaleString('en-US')}</span>
              </li>
              <li>
                {t('copartLots')} <span>{lotCounts.copart.toLocaleString('en-US')}</span>
              </li>
              <li>
                {t('iaaiLots')} <span>{lotCounts.iaai.toLocaleString('en-US')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">Ⓒ 2026 VINDOCTOR. {t('footerRights')}</div>
      </footer>
    </>
  );
}
