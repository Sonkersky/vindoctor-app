'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, formatOdometer } from '@/lib/format';
import { useFavorites } from './FavoritesContext';
import { useLocale } from './i18n/LocaleContext';

const SELECT_COLUMNS =
  'vin, title, year, make, model, base_site, sale_status, purchase_price, odometer, odometer_index, link_img_small, link_img_hd';

export default function FavoritesPanel({ onClose }) {
  const { favorites, toggleFavorite } = useFavorites();
  const { t } = useLocale();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const vins = Array.from(favorites);
    if (vins.length === 0) {
      setCars([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from('cars')
      .select(SELECT_COLUMNS)
      .in('vin', vins)
      .then(({ data }) => {
        if (cancelled) return;
        setCars(data || []);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [favorites]);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const panel = (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal-content favorites-panel-content">
        <div className="favorites-panel-header">
          <h3>⭐ {t('favorites')}</h3>
          <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose}>
            {t('close')}
          </button>
        </div>

        {loading ? (
          <div className="modal-text">{t('loading')}</div>
        ) : cars.length === 0 ? (
          <div className="modal-text">{t('noFavorites')}</div>
        ) : (
          <div className="favorites-grid">
            {cars.map((car) => {
              const site = car.base_site === 'iaai' ? 'iaai' : 'copart';
              const image =
                (car.link_img_small && car.link_img_small[0]) ||
                (car.link_img_hd && car.link_img_hd[0]) ||
                null;
              const title = car.title || `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();

              return (
                <div key={car.vin} className="favorites-item">
                  <Link href={`/lot/${encodeURIComponent(car.vin)}`} className="favorites-item-image" onClick={onClose}>
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt={title} />
                    ) : (
                      <div className="favorites-item-noimage" />
                    )}
                    <span className={`auction-badge ${site}`}>{site.toUpperCase()}</span>
                  </Link>
                  <div className="favorites-item-body">
                    <Link href={`/lot/${encodeURIComponent(car.vin)}`} className="favorites-item-title" onClick={onClose}>
                      {title}
                    </Link>
                    <div className="favorites-item-meta">
                      {formatOdometer(car)} · {formatPrice(car)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="favorites-item-remove"
                    onClick={() => toggleFavorite(car.vin)}
                    aria-label="Remove from favorites"
                    title="Remove from favorites"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
}
