import Link from 'next/link';
import '../page.css';
import CarTile from '../CarTile';
import PaginationBar from '../PaginationBar';
import HomeGridAligner from '../HomeGridAligner';
import { listActiveLots } from '@/lib/queries';
import { getServerTranslator } from '@/lib/i18n/server';

export const metadata = {
  title: 'Buy Now Inventory | VINDOCTOR',
  description: 'Active auction lots available to purchase immediately with Buy Now.',
  alternates: { canonical: '/buy-now' },
};

export default async function BuyNowPage({ searchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ cars, hasNextPage, lastPageInWindow }, { t }] = await Promise.all([
    listActiveLots({ buyNowOnly: true }, page),
    getServerTranslator(),
  ]);

  return (
    <>
      <HomeGridAligner />
      <div className="container">
        <div className="header-logo">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_2.png" alt="DOCTOR.VIN" className="logo-img" />
          </Link>
        </div>

        <div className="main-layout" style={{ gridTemplateColumns: '1fr' }}>
          <main className="car-grid" style={{ maxWidth: '100%' }}>
            <div className="highlight-section-header" style={{ gridColumn: '1 / -1' }}>
              <h1 className="highlight-section-title">{t('buyNowInventory')}</h1>
              <Link href="/" className="highlight-section-see-all">
                {t('backToListings')}
              </Link>
            </div>

            {cars.length === 0 ? (
              <div id="noResults" style={{ display: 'block' }}>
                <h3>{t('noResultsTitle')}</h3>
              </div>
            ) : (
              cars.map((car) => <CarTile key={car.vin} car={car} isActiveView t={t} />)
            )}

            {cars.length > 0 && (
              <PaginationBar
                currentPage={page}
                hasNextPage={hasNextPage}
                filtersQueryString=""
                lastPageInWindow={lastPageInWindow}
                basePath="/buy-now"
              />
            )}
          </main>
        </div>
      </div>
    </>
  );
}
