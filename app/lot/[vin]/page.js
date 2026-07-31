import Link from 'next/link';
import Script from 'next/script';
import './lot.css';
import LotGallery from './LotGallery';
import ClaimModal from './ClaimModal';
import { getCarByVin, getSimilarLots } from '@/lib/queries';
import { formatPrice, formatDate } from '@/lib/format';
import { buildGalleryItems, getPhotoUrls } from '@/lib/gallery';
import { isDestructiveDocument, sellerColorClass, saleStatusPill, extraInfoFields } from '@/lib/lotHelpers';

export async function generateMetadata({ params }) {
  const { vin } = await params;
  const car = await getCarByVin(vin);
  if (!car) {
    return { title: 'Vehicle not found - VINDOCTOR' };
  }
  const title = car.title || `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();
  return { title: `${title} - VINDOCTOR` };
}

function similarLotCard(car) {
  const img =
    (car.link_img_small && car.link_img_small[0]) ||
    (car.link_img_hd && car.link_img_hd[0]) ||
    'https://placehold.co/400x300/1e293b/94a3b8?text=No+Image';
  const title = car.title || `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();
  const site = car.base_site === 'iaai' ? 'IAAI' : 'COPART';

  return (
    <Link href={`/lot/${encodeURIComponent(car.vin)}`} className="similar-lot-card" key={car.vin}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={title} className="similar-lot-img" loading="lazy" />
      <div className="similar-lot-body">
        <div className="similar-lot-title">{title}</div>
        <div className="similar-lot-meta">
          {site} · {car.location || car.state || ''}
        </div>
        <div className="similar-lot-price">{formatPrice(car)}</div>
      </div>
    </Link>
  );
}

export default async function LotPage({ params }) {
  const { vin } = await params;
  const car = await getCarByVin(vin);

  if (!car) {
    return (
      <div className="lot-page-container">
        <div className="header-logo">
          <Link href="/" className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_2.png" alt="VINDOCTOR" className="logo-img" />
          </Link>
        </div>
        <div className="top-bar">
          <Link href="/" className="back-link">
            ← Back to listings
          </Link>
        </div>
        <h1 className="car-title-main">Vehicle not found for this VIN.</h1>
      </div>
    );
  }

  const site = car.base_site === 'iaai' ? 'iaai' : 'copart';
  const title = car.title || `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();

  const pill = saleStatusPill(car.sale_status || (car.sale_history[0] && car.sale_history[0].sale_status));
  const isBuyNow = (car.sale_status || '').toLowerCase() === 'sold' && (car.sale_type || '').toLowerCase() === 'buynow';
  const docDestructive = isDestructiveDocument(car.document);
  const sellerClass = sellerColorClass(car.seller, car.seller_type);
  const extraFields = extraInfoFields(car);

  const odometerText =
    car.odometer != null
      ? `${Number(car.odometer).toLocaleString('en-US')} ${car.odobrand ? ` (${car.odobrand.toUpperCase()})` : ''}`
      : 'N/A';
  const odometerUnit = car.odometer_index || 'mi';

  const galleryItems = buildGalleryItems(car);
  const photoUrls = getPhotoUrls(car);

  const similarLots = car.make && car.model ? await getSimilarLots(car.make, car.model, car.vin) : [];

  return (
    <>
    <div className="lot-page-container">
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" strategy="afterInteractive" />

      {/* HEADER & LOGO */}
      <div className="header-logo">
        <Link href="/" className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_2.png" alt="VINDOCTOR" className="logo-img" />
        </Link>
      </div>

      {/* TOP BAR (BACK + CLAIM LOT) */}
      <div className="top-bar">
        <Link href="/" className="back-link">
          ← Back to listings
        </Link>
        <ClaimModal />
      </div>

      {/* CAR HEADER */}
      <div className="car-header">
        <div>
          <h1 className="car-title-main">{title}</h1>
          <div className="vin-row">
            <div className="vin-pill">VIN: {car.vin}</div>
            <span className={`auction-badge ${site}`}>{site.toUpperCase()}</span>
            <span className={pill.className}>{pill.text}</span>
            {isBuyNow && <span className="buynow-badge">⚡ Sold by BUY NOW</span>}
          </div>
        </div>
      </div>

      {/* LAYOUT: GALLERY + SPECS */}
      <div className="details-layout">
        <LotGallery galleryItems={galleryItems} photoUrls={photoUrls} vin={car.vin} />

        {/* PRICE & SPECS */}
        <div className="info-section">
          <div className="price-box">
            <div className="price-box-top">
              <div className="label-row">
                <div className="label">FINAL BID</div>
              </div>
            </div>
            <div className="amount">{formatPrice(car)}</div>
          </div>

          <div className="specs-card">
            <h3>Vehicle Specifications</h3>
            <div className="specs-list">
              <div className="spec-item">
                <span className="spec-label">Location</span>
                <span className="spec-value">{car.location || car.state || 'N/A'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Sale Date</span>
                <span className="spec-value">{formatDate(car.sale_date)}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Engine Status</span>
                <span className="spec-value">{car.status || 'N/A'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Primary Damage</span>
                <span className="spec-value">{car.damage_pr || 'N/A'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Sale Document</span>
                <span className={`spec-value ${docDestructive ? 'doc-destructive' : ''}`}>{car.document || 'N/A'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Odometer</span>
                <span className="spec-value">
                  {car.odometer != null ? `${Number(car.odometer).toLocaleString('en-US')} ${odometerUnit}${car.odobrand ? ` (${car.odobrand.toUpperCase()})` : ''}` : 'N/A'}
                </span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Transmission</span>
                <span className="spec-value">{car.transmission || 'N/A'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Seller</span>
                {car.seller ? (
                  <span className={`spec-value ${sellerClass}`}>{car.seller}</span>
                ) : (
                  <span className="spec-value seller-tooltip">
                    Non-insurance
                    <span className="seller-tooltip-popup">
                      The seller&apos;s reliability is uncertain. We recommend exercising caution before making a
                      purchase.
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {extraFields.length > 0 && (
            <div className="specs-card">
              <h3>Additional Vehicle Info</h3>
              <div className="specs-list">
                {extraFields.map((f) => (
                  <div className="spec-item" key={f.label}>
                    <span className="spec-label">{f.label}</span>
                    <span className="spec-value">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIN SALES HISTORY */}
      <div className="history-section">
        <div className="history-title">
          🕒 Sales History (VIN History)
          <span className="history-badge-count">Records found: {car.sale_history.length}</span>
        </div>

        <table className="history-table">
          <thead>
            <tr>
              <th>Auction Date</th>
              <th>Auction House</th>
              <th>Status</th>
              <th>Final Price</th>
            </tr>
          </thead>
          <tbody>
            {car.sale_history.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#64748b' }}>
                  No previous sale records found.
                </td>
              </tr>
            ) : (
              car.sale_history.map((entry, idx) => (
                <tr key={idx}>
                  <td>{formatDate(entry.sale_date)}</td>
                  <td>{entry.base_site === 'iaai' ? 'IAAI' : 'COPART'}</td>
                  <td>{entry.sale_status || 'N/A'}</td>
                  <td className="price-past">{formatPrice({ purchase_price: entry.purchase_price })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* SIMILAR LOTS */}
      {similarLots.length > 0 && (
        <div className="similar-lots-section">
          <div className="similar-lots-title">🚘 Similar Lots</div>
          <div className="similar-lots-grid">{similarLots.map(similarLotCard)}</div>
        </div>
      )}
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
        </div>

        <div className="footer-bottom">Ⓒ 2026 VINDOCTOR. All rights reserved</div>
      </footer>
    </>
  );
}
