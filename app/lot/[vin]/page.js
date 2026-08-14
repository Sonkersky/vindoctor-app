import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import './lot.css';
import LotGallery from './LotGallery';
import ClaimModal from './ClaimModal';
import BuyLeadModal from './BuyLeadModal';
import MileageValue from '@/app/MileageValue';
import LandingCostCalculator from '@/app/LandingCostCalculator';
import { getCarByVin, getSimilarLots } from '@/lib/queries';
import { formatPrice, formatOdometer, formatDate } from '@/lib/format';
import { buildGalleryItems, getPhotoUrls } from '@/lib/gallery';
import { isDestructiveDocument, sellerDisplay, saleStatusPill, extraInfoFields } from '@/lib/lotHelpers';
import { getServerTranslator } from '@/lib/i18n/server';

// Włączone z powrotem: apicar.store rzeczywiście nie wypełnia sale_history
// (nadal puste, sprawdzone na żywo), ALE getCarByVin (lib/queries.js) teraz
// sam dokłada tu poprzedni wynik z "cars", gdy dany VIN wraca na aukcję po
// "Not sold"/"ON APPROVAL" (patrz active_lots) — to jedyny scenariusz, w
// którym ta sekcja realnie ma dziś co pokazać. Poniżej w JSX sekcja jest
// dodatkowo warunkowana na car.sale_history.length > 0 — pokazuje się
// TYLKO gdy faktycznie jest co pokazać (auto miało wcześniej jakiś wynik),
// zamiast zawsze z "No previous sale records found.".
const SHOW_SALES_HISTORY = true;

export async function generateMetadata({ params }) {
  const { vin } = await params;
  const car = await getCarByVin(vin);
  if (!car) {
    return { title: 'Vehicle not found - VINDOCTOR' };
  }
  const title = car.title || `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();
  const site = car.base_site === 'iaai' ? 'IAAI' : 'Copart';
  const description =
    `${title} — VIN ${car.vin}. ${car.sale_status || 'Auction'} at ${site} for ${formatPrice(car)} ` +
    `on ${formatDate(car.sale_date)}. Odometer: ${formatOdometer(car)}. Damage: ${car.damage_pr || 'N/A'}.`;
  const image = (car.link_img_hd && car.link_img_hd[0]) || (car.link_img_small && car.link_img_small[0]);
  const canonicalPath = `/lot/${encodeURIComponent(car.vin)}`;

  return {
    title: `${title} - VINDOCTOR`,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: `${title} - VINDOCTOR`,
      description,
      url: canonicalPath,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} - VINDOCTOR`,
      description,
      images: image ? [image] : undefined,
    },
  };
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
  const [car, { t }] = await Promise.all([getCarByVin(vin), getServerTranslator()]);

  if (!car) {
    notFound();
  }

  const site = car.base_site === 'iaai' ? 'iaai' : 'copart';
  const title = car.title || `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();

  // Aktywny lot (jeszcze nie sprzedany, patrz getCarByVin w lib/queries.js)
  // nie ma sensownego "obecnego" statusu sprzedaży do pokazania — sale_status
  // jest wtedy null, a poprzedni wynik w sale_history[0] to HISTORIA (np.
  // "Not sold" sprzed powrotu na aukcję), nie stan bieżący — pokazanie go
  // jako głównej plakietki sugerowałoby, że aukcja już się zakończyła.
  const pill = car.isActiveLot
    ? { text: 'ACTIVE', className: 'sale-status-pill status-active' }
    : saleStatusPill(car.sale_status || (car.sale_history[0] && car.sale_history[0].sale_status));
  const isBuyNow = (car.sale_status || '').toLowerCase() === 'sold' && (car.sale_type || '').toLowerCase() === 'buynow';
  // Sprawdzamy razem document i document_detail — apicar.store często
  // trzyma ogólny kubełek ("Other") w document, a konkretną, stanową
  // kategorię tytułu (np. "IN - BILL OF SALE - PARTS ONLY") w
  // document_detail; samo document potrafi więc wyglądać niewinnie, mimo
  // że auto realnie nie nadaje się do ponownej rejestracji.
  const docDestructive = isDestructiveDocument(`${car.document || ''} ${car.document_detail || ''}`);
  const seller = sellerDisplay(car.seller, car.seller_type);
  const extraFields = extraInfoFields(car);

  const galleryItems = buildGalleryItems(car);
  const photoUrls = getPhotoUrls(car);

  // Dane strukturalne (schema.org) — pomagają Google zrozumieć, czym jest
  // strona (konkretny pojazd, VIN, marka/model itd.), niezależnie od tego
  // czy w wynikach pokaże się jakiś "rich result". Celowo NIE twierdzimy,
  // że auto jest dostępne do kupienia (availability: SoldOut) — to
  // zakończona aukcja, nie aktualna oferta, więc "InStock" byłoby
  // wprowadzające w błąd. Z tego samego powodu celowo NIE dodajemy
  // aggregateRating/review/hasMerchantReturnPolicy/shippingDetails, mimo że
  // Google Search Console zgłasza ich brak jako "problem niekrytyczny" —
  // to pola dla prawdziwych sklepów z realną polityką zwrotów/wysyłki i
  // ocenami klientów; my ich nie mamy, więc wymyślanie ich treści byłoby
  // wprowadzającymi w błąd danymi strukturalnymi (i ryzykiem manual action
  // od Google). "description" jest jednak prawdziwe i łatwe do dodania.
  const jsonLdDescription =
    `${title} — VIN ${car.vin}. ${car.sale_status || 'Auction'} at ${site === 'iaai' ? 'IAAI' : 'Copart'} for ` +
    `${formatPrice(car)}. Odometer: ${formatOdometer(car)}. Damage: ${car.damage_pr || 'N/A'}.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: title,
    description: jsonLdDescription,
    vehicleIdentificationNumber: car.vin,
    ...(car.make ? { brand: { '@type': 'Brand', name: car.make } } : {}),
    ...(car.model ? { model: car.model } : {}),
    ...(car.year ? { vehicleModelDate: String(car.year) } : {}),
    ...(car.color ? { color: car.color } : {}),
    ...(car.fuel ? { fuelType: car.fuel } : {}),
    ...(car.transmission ? { vehicleTransmission: car.transmission } : {}),
    ...(car.vehicle_type ? { bodyType: car.vehicle_type } : {}),
    ...(car.odometer != null
      ? {
          mileageFromOdometer: {
            '@type': 'QuantitativeValue',
            value: Number(car.odometer),
            unitCode: (car.odometer_index || '').toLowerCase() === 'km' ? 'KMT' : 'SMI',
          },
        }
      : {}),
    ...(photoUrls.length ? { image: photoUrls } : {}),
    url: `https://doctor.vin/lot/${encodeURIComponent(car.vin)}`,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: car.purchase_price != null ? Number(car.purchase_price) : undefined,
      // Aktywny lot = trwająca aukcja, nie zakończona sprzedaż — InStock jest
      // tu poprawniejsze niż SoldOut (patrz komentarz wyżej o "isActiveLot").
      availability: car.isActiveLot ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
    },
  };

  const similarLots = car.make && car.model ? await getSimilarLots(car.make, car.model, car.vin) : [];

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div className="lot-page-container">
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" strategy="afterInteractive" />

      {/* HEADER & LOGO */}
      <div className="header-logo">
        <Link href="/" className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_2.png" alt="DOCTOR.VIN" className="logo-img" />
        </Link>
      </div>

      {/* TOP BAR (BACK) */}
      <div className="top-bar">
        <Link href="/" className="back-link">
          {t('backToListings')}
        </Link>
      </div>

      {/* CAR HEADER */}
      <div className="car-header">
        <h1 className="car-title-main">{title}</h1>
        <div className="vin-row">
          <div className="vin-pill">VIN: {car.vin}</div>
          <span className={`auction-badge ${site}`}>{site.toUpperCase()}</span>
          <span className={pill.className}>{pill.text}</span>
          {isBuyNow && <span className="buynow-badge">⚡ Sold by BUY NOW</span>}
        </div>
      </div>

      {/* LAYOUT: GALLERY + SPECS */}
      <div className="details-layout">
        <LotGallery galleryItems={galleryItems} photoUrls={photoUrls} vin={car.vin} title={title} />

        {/* PRICE & SPECS */}
        <div className="info-section">
          {/* Tylko Archive — Actual (car.isActiveLot) jeszcze nie ma finalnej
              ceny/zakończonej aukcji, więc "zgłoś zakup" nie ma tu sensu. */}
          {!car.isActiveLot && <ClaimModal />}

          <div className="price-box">
            <div className="price-box-top">
              <div className="label-row">
                <div className="label">{car.isActiveLot ? t('currentBid') : t('finalBid')}</div>
              </div>
            </div>
            <div className="amount">
              {car.isActiveLot && !car.purchase_price ? t('noBidsYet') : formatPrice(car)}
            </div>
          </div>

          <BuyLeadModal car={car} />

          <LandingCostCalculator car={car} />

          <div className="specs-card">
            <h3>{t('vehicleSpecifications')}</h3>
            <div className="specs-list">
              <div className="spec-item">
                <span className="spec-label">{t('location')}</span>
                <span className="spec-value">{car.location || car.state || 'N/A'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">{t('saleDate')}</span>
                <span className="spec-value">{formatDate(car.sale_date)}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">{t('engineStatus')}</span>
                <span className="spec-value">{car.status || 'N/A'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">{t('primaryDamage')}</span>
                <span className="spec-value">{car.damage_pr || 'N/A'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">{t('saleDocument')}</span>
                <span className={`spec-value ${docDestructive ? 'doc-destructive' : ''}`}>{car.document || 'N/A'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">{t('odometer')}</span>
                <span className="spec-value">
                  <MileageValue
                    odometer={car.odometer}
                    unit={car.odometer_index}
                    suffix={car.odobrand ? ` (${car.odobrand.toUpperCase()})` : ''}
                  />
                </span>
              </div>
              <div className="spec-item">
                <span className="spec-label">{t('transmission')}</span>
                <span className="spec-value">{car.transmission || 'N/A'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">{t('sellerLabel')}</span>
                {seller.showTooltip ? (
                  <span className={`spec-value ${seller.className} seller-tooltip`}>
                    {seller.text}
                    <span className="seller-tooltip-popup">{t('sellerTooltipWarning')}</span>
                  </span>
                ) : (
                  <span className={`spec-value ${seller.className}`}>{seller.text}</span>
                )}
              </div>
            </div>
          </div>

          {extraFields.length > 0 && (
            <div className="specs-card">
              <h3>{t('additionalVehicleInfo')}</h3>
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
      {SHOW_SALES_HISTORY && car.sale_history.length > 0 && (
        <div className="history-section">
          <div className="history-title">
            {t('salesHistoryTitle')}
            <span className="history-badge-count">{t('recordsFound')} {car.sale_history.length}</span>
          </div>

          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>{t('auctionDate')}</th>
                  <th>{t('auctionHouse')}</th>
                  <th>{t('status')}</th>
                  <th>{t('finalPrice')}</th>
                </tr>
              </thead>
              <tbody>
                {car.sale_history.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{formatDate(entry.sale_date)}</td>
                    <td>{entry.base_site === 'iaai' ? 'IAAI' : 'COPART'}</td>
                    <td>{entry.sale_status || 'N/A'}</td>
                    <td className="price-past">{formatPrice({ purchase_price: entry.purchase_price })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SIMILAR LOTS */}
      {similarLots.length > 0 && (
        <div className="similar-lots-section">
          <div className="similar-lots-title">{t('similarLots')}</div>
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
        </div>

        <div className="footer-bottom">Ⓒ 2026 DOCTOR.VIN. {t('footerRights')}</div>
      </footer>
    </>
  );
}
