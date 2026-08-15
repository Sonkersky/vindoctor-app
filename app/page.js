import Link from 'next/link';
import './page.css';
import FilterSidebar from './FilterSidebar';
import ActiveArchiveToggle from './ActiveArchiveToggle';
import AccountBar from './AccountBar';
import PaginationBar from './PaginationBar';
import CarTile from './CarTile';
import VinSearchForm from './VinSearchForm';
import HomeGridAligner from './HomeGridAligner';
import HighlightSection from './HighlightSection';
import PopularMakes from './PopularMakes';
import {
  listCars,
  listActiveLots,
  getMakesAndModels,
  getLotCounts,
  getPriceStats,
  getActiveLotsPreview,
  getActiveLotCounts,
  getActiveLotMakes,
} from '@/lib/queries';
import { getServerTranslator } from '@/lib/i18n/server';

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
  const [
    { cars, hasNextPage, lastPageInWindow },
    makesModels,
    lotCounts,
    priceStats,
    { t },
    buyNowPreview,
    motorcyclesPreview,
    activeLotCounts,
    activeLotMakes,
  ] = await Promise.all([
    isActiveView ? listActiveLots(filters, page) : listCars(filters, page),
    getMakesAndModels(),
    getLotCounts(),
    filters.make ? getPriceStats(filters) : Promise.resolve({ min: null, max: null, avg: null, count: 0 }),
    getServerTranslator(),
    // Sekcje-zajawki pod listą — tylko w widoku Actual (patrz prośba
    // "na dole pod actual lots"), niezależne od bieżących filtrów.
    isActiveView ? getActiveLotsPreview({ buyNowOnly: true }, 4) : Promise.resolve([]),
    isActiveView ? getActiveLotsPreview({ vehicleType: 'Motorcycle' }, 4) : Promise.resolve([]),
    isActiveView ? getActiveLotCounts() : Promise.resolve({ buyNow: 0, motorcycles: 0 }),
    isActiveView ? getActiveLotMakes() : Promise.resolve({ Automobile: [], Motorcycle: [], ATV: [] }),
  ]);

  // "view" musi być częścią tego stringa (nie tylko filtry) — inaczej
  // PaginationBar (który go nie zna, tylko doklada "page") przy każdej
  // zmianie strony w Archive gubił ?view=archive i wracał na domyślne
  // Actual. ActiveArchiveToggle i tak sam nadpisuje/usuwa "view" w swoich
  // dwóch linkach, więc obecność go tutaj mu nie przeszkadza.
  const filtersQueryString = new URLSearchParams([
    ...Object.entries(filters).filter(([, v]) => v),
    ...(isActiveView ? [] : [['view', 'archive']]),
  ]).toString();

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

        {/* W .main-layout (grid-column: 2, patrz page.css), nie poza nim —
            inaczej te sekcje nie widzą kolumny sidebaru i wychodzą szersze/
            przesunięte względem car-grid nad nimi (zgłoszone: kafelki
            "nierówne"). Tu automatycznie dziedziczą tę samą szerokość
            kolumny i te same reguły .car-grid (max-width:90%, gap). */}
        {isActiveView && (
          <>
            <PopularMakes makes={activeLotMakes} />
            <HighlightSection
              title={t('buyNowInventory')}
              count={activeLotCounts.buyNow}
              cars={buyNowPreview}
              seeAllHref="/buy-now"
              t={t}
            />
            <HighlightSection
              title={t('motorcycles')}
              count={activeLotCounts.motorcycles}
              cars={motorcyclesPreview}
              seeAllHref="/motorcycles"
              t={t}
            />
          </>
        )}
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

        <div className="footer-bottom">Ⓒ 2026 DOCTOR.VIN. {t('footerRights')}</div>
      </footer>
    </>
  );
}
