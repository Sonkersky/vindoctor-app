import Link from 'next/link';
import './page.css';
import FilterSidebar from './FilterSidebar';
import PaginationBar from './PaginationBar';
import TileImageCarousel from './TileImageCarousel';
import { listCars, getMakesAndModels, getLotCounts } from '@/lib/queries';
import { formatPrice, formatOdometer } from '@/lib/format';

function tileStatusPillClass(saleStatus) {
  const s = (saleStatus || '').toLowerCase();
  if (s.includes('not sold')) return 'status-not-sold';
  if (s.includes('sold')) return 'status-sold';
  return 'status-other';
}

function CarTile({ car }) {
  const site = car.base_site === 'iaai' ? 'iaai' : 'copart';
  const images =
    car.link_img_small && car.link_img_small.length
      ? car.link_img_small
      : car.link_img_hd && car.link_img_hd.length
        ? car.link_img_hd
        : [];
  const title = car.title || `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();

  return (
    <div
      className="car-tile"
      data-make={(car.make || '').toLowerCase()}
      data-year={car.year || ''}
      data-auction={site}
      data-state={car.state || ''}
    >
      <Link href={`/lot/${encodeURIComponent(car.vin)}`} className="card-image-wrapper">
        <TileImageCarousel images={images} alt={title} />
        <div className="tile-badges">
          {car.sale_status && (
            <span className={`tile-status-pill ${tileStatusPillClass(car.sale_status)}`}>{car.sale_status}</span>
          )}
          <span className={`auction-badge ${site}`}>{site.toUpperCase()}</span>
        </div>
      </Link>
      <div className="card-body">
        <Link href={`/lot/${encodeURIComponent(car.vin)}`} className="car-title-link">
          <h2 className="car-title">{title}</h2>
        </Link>
        <div className="vin-number">VIN: {car.vin}</div>
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label">📍 Location</span>
            <span className="detail-value">{car.location || car.state || ''}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">🛣 Odometer</span>
            <span className="detail-value">{formatOdometer(car)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">🗝 Status</span>
            <span className="detail-value">{car.status || ''}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">🛠 Damage</span>
            <span className="detail-value">{car.damage_pr || ''}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">📄 Sale Document</span>
            <span className="detail-value">{car.document || 'N/A'}</span>
          </div>
        </div>
        <div className="card-footer">
          <div className="price-box-inner">
            <span className="price-label">Final Price:</span>
            <span className="price-value">{formatPrice(car)}</span>
          </div>
          <Link href={`/lot/${encodeURIComponent(car.vin)}`} className="view-lot-btn">
            VIEW LOT
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;

  const filters = {
    site: sp.site || '',
    make: sp.make || '',
    model: sp.model || '',
    damage: sp.damage || '',
    status: sp.status || '',
    state: sp.state || '',
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

  const [{ cars, hasNextPage }, makesModels, lotCounts] = await Promise.all([
    listCars(filters, page),
    getMakesAndModels(),
    getLotCounts(),
  ]);

  const filtersQueryString = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v)
  ).toString();

  return (
    <>
    <div className="container">
      {/* LOGO */}
      <div className="header-logo">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_2.png" alt="VINDOCTOR" className="logo-img" />
        </Link>
      </div>

      {/* TOP SEARCH BAR */}
      <div className="top-search-section">
        <form className="top-search-form" action="/lot.html" method="GET">
          <input
            type="text"
            name="vin"
            className="top-search-input"
            placeholder="Enter VIN number (e.g. 1FA6P8CF5M5123456)"
            required
          />
          <button type="submit" className="btn btn-primary">
            Search VIN
          </button>
        </form>
      </div>

      {/* MAIN LAYOUT */}
      <div className="main-layout">
        <FilterSidebar makesModels={makesModels} initialFilters={{ ...filters, page: String(page) }} />

        {/* VEHICLES GRID */}
        <main className="car-grid">
          {cars.length === 0 ? (
            <div id="noResults" style={{ display: 'block' }}>
              <h3>No vehicles match your search criteria.</h3>
              <p style={{ marginTop: '8px' }}>Try clearing filters to see all available cars.</p>
            </div>
          ) : (
            cars.map((car) => <CarTile key={car.vin} car={car} />)
          )}

          {cars.length > 0 && (
            <PaginationBar currentPage={page} hasNextPage={hasNextPage} filtersQueryString={filtersQueryString} />
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
              <img src="/logo_2.png" alt="VINDOCTOR Logo" className="footer-logo" />
            </Link>
            <p className="footer-text">
              Got any questions?
              <br />
              Feel free to contact
              <br />
              <a href="mailto:info@vindoctor.com" className="footer-email">
                info@vindoctor.com
              </a>
            </p>
          </div>

          <div className="footer-col">
            <h4 className="footer-heading">Information</h4>
            <ul className="footer-links">
              <li>
                <a href="#">Terms &amp; Conditions</a>
              </li>
              <li>
                <a href="#">Privacy Policy</a>
              </li>
              <li>
                <a href="#">VIN Lookup FAQ</a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-heading">Statistics</h4>
            <ul className="stats-list">
              <li>
                Lots: <span>{lotCounts.total.toLocaleString('en-US')}</span>
              </li>
              <li>
                Copart Lots: <span>{lotCounts.copart.toLocaleString('en-US')}</span>
              </li>
              <li>
                IAAI Lots: <span>{lotCounts.iaai.toLocaleString('en-US')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">Ⓒ 2026 VINDOCTOR. All rights reserved</div>
      </footer>
    </>
  );
}
