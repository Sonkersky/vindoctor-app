import Link from 'next/link';
import CarTile from './CarTile';

// Sekcja-zajawka pod głównym grid-em ("Buy Now Inventory" / "Motorcycles" —
// patrz app/page.js) — tytuł + liczba + jeden rząd kafelków + "See all" na
// osobną podstronę (app/buy-now/page.js, app/motorcycles/page.js). Zawsze
// widok Actual (active_lots), więc isActiveView={true} na sztywno.
export default function HighlightSection({ title, count, cars, seeAllHref, t }) {
  if (cars.length === 0) return null;

  return (
    <section className="highlight-section">
      <div className="highlight-section-header">
        <h2 className="highlight-section-title">
          {title} <span className="highlight-section-count">{count.toLocaleString('en-US')}</span>
        </h2>
        <Link href={seeAllHref} className="highlight-section-see-all">
          {t('seeAll')}
        </Link>
      </div>
      <div className="highlight-section-row">
        {cars.map((car) => (
          <CarTile key={car.vin} car={car} isActiveView t={t} />
        ))}
      </div>
    </section>
  );
}
