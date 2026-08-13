'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useFavorites } from './FavoritesContext';
import { formatDate } from '@/lib/format';
import { useLocale } from './i18n/LocaleContext';

function filterLabelKey(key) {
  return {
    site: 'historyLabelAuction',
    make: 'make',
    model: 'model',
    damage: 'damage',
    status: 'status',
    sellerCategory: 'seller',
    fuel: 'historyLabelFuel',
    cylinders: 'cylinders',
    vehicleType: 'historyLabelVehicleType',
    yearFrom: 'historyLabelYearFrom',
    yearTo: 'historyLabelYearTo',
    mileageFrom: 'historyLabelMileageFrom',
    mileageTo: 'historyLabelMileageTo',
    engineSizeFrom: 'historyLabelEngineSizeFrom',
    engineSizeTo: 'historyLabelEngineSizeTo',
  }[key];
}

function summarizeFilters(filters, t) {
  if (!filters) return t('filteredSearch');
  const parts = Object.entries(filters)
    .filter(([key]) => key !== 'page')
    .map(([key, value]) => `${t(filterLabelKey(key)) || key}: ${value}`);
  return parts.length ? parts.join(' · ') : t('allVehicles');
}

export default function SearchHistoryPanel({ onClose }) {
  const { user } = useFavorites();
  const { t } = useLocale();
  const [entries, setEntries] = useState([]);
  const [carsByVin, setCarsByVin] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('search_history')
      .select('id, search_type, query, filters, created_at')
      .order('created_at', { ascending: false })
      .limit(25)
      .then(async ({ data }) => {
        if (cancelled) return;
        const rows = data || [];
        setEntries(rows);
        setLoading(false);

        // Miniaturki tylko dla wpisów VIN — jedno wspólne zapytanie zamiast
        // osobnego na wpis.
        const vins = [...new Set(rows.filter((r) => r.search_type === 'vin').map((r) => r.query))];
        if (vins.length === 0) return;

        const { data: cars } = await supabase
          .from('cars')
          .select('vin, base_site, link_img_small, link_img_hd')
          .in('vin', vins);
        if (cancelled || !cars) return;

        setCarsByVin(Object.fromEntries(cars.map((c) => [c.vin, c])));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function removeEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const supabase = createClient();
    await supabase.from('search_history').delete().eq('id', id);
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const panel = (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal-content favorites-panel-content">
        <div className="favorites-panel-header">
          <h3>🕓 {t('searchHistory')}</h3>
          <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose}>
            {t('close')}
          </button>
        </div>

        {loading ? (
          <div className="modal-text">{t('loading')}</div>
        ) : entries.length === 0 ? (
          <div className="modal-text">{t('noSearchHistory')}</div>
        ) : (
          <div className="favorites-grid">
            {entries.map((entry) => {
              const car = entry.search_type === 'vin' ? carsByVin[entry.query] : null;
              const image =
                car && ((car.link_img_small && car.link_img_small[0]) || (car.link_img_hd && car.link_img_hd[0]));
              const site = car ? (car.base_site === 'iaai' ? 'iaai' : 'copart') : null;

              return (
                <div key={entry.id} className="history-item">
                  {entry.search_type === 'vin' && (
                    <div className="history-item-image">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={entry.query} />
                      ) : (
                        <div className="favorites-item-noimage" />
                      )}
                      {site && <span className={`auction-badge ${site}`}>{site.toUpperCase()}</span>}
                    </div>
                  )}
                  <div className="history-item-body">
                    {entry.search_type === 'vin' ? (
                      <Link href={`/lot/${encodeURIComponent(entry.query)}`} className="history-item-title" onClick={onClose}>
                        VIN: {entry.query}
                      </Link>
                    ) : (
                      <Link
                        href={`/?${new URLSearchParams(entry.filters || {}).toString()}`}
                        className="history-item-title"
                        onClick={onClose}
                      >
                        {summarizeFilters(entry.filters, t)}
                      </Link>
                    )}
                    <div className="history-item-meta">{formatDate(entry.created_at)}</div>
                  </div>
                  <button
                    type="button"
                    className="favorites-item-remove"
                    onClick={() => removeEntry(entry.id)}
                    aria-label="Remove from history"
                    title="Remove from history"
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
