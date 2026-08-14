import Link from 'next/link';
import TileImageCarousel from './TileImageCarousel';
import FavoriteButton from './FavoriteButton';
import MileageValue from './MileageValue';
import AuctionCountdown from './AuctionCountdown';
import { formatPrice } from '@/lib/format';

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

function tileStatusPillClass(saleStatus) {
  const s = (saleStatus || '').toLowerCase();
  if (s.includes('not sold')) return 'status-not-sold';
  if (s.includes('sold')) return 'status-sold';
  return 'status-other';
}

export default function CarTile({ car, isActiveView, t }) {
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
          {/* Odliczanie do rozpoczęcia licytacji — tylko Actual, tylko gdy
              znamy datę (car.sale_date == auction_date dla active_lots,
              patrz activeRowToCar w lib/queries.js). */}
          {isActiveView && car.sale_date && (
            <div className="tile-countdown-row">
              <AuctionCountdown auctionDate={car.sale_date} />
            </div>
          )}
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
