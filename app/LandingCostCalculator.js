'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  VEHICLE_TYPE_OPTIONS,
  DUTY_RATE_OPTIONS,
  guessYardCity,
  findRoute,
  computeLandingCost,
  defaultCustomsValueEur,
} from '@/lib/calculator';
import { useLocale } from './i18n/LocaleContext';

// Ten sam styl co ikony na kafelkach/w panelu klienta (patrz ICON_PROPS w
// app/page.js i app/AuthWidget.js) — jednolita, minimalistyczna kreska.
const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: '#38bdf8',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconCalculator() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="11" x2="8" y2="11" />
      <line x1="12" y1="11" x2="12" y2="11" />
      <line x1="16" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="8" y2="15" />
      <line x1="12" y1="15" x2="12" y2="15" />
      <line x1="16" y1="15" x2="16" y2="15" />
      <line x1="8" y1="19" x2="8" y2="19" />
      <line x1="12" y1="19" x2="12" y2="19" />
    </svg>
  );
}

function IconChevron({ expanded }) {
  return (
    <svg {...ICON_PROPS} width={16} height={16} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function formatUsd(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}
function formatEur(value) {
  return `€${Math.round(value).toLocaleString('en-US')}`;
}

export default function LandingCostCalculator({ car }) {
  const { t } = useLocale();
  const auction = car.base_site === 'iaai' ? 'iaai' : 'copart';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [feeBrackets, setFeeBrackets] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [rates, setRates] = useState(null);

  const [bidAmount, setBidAmount] = useState(Math.round(car.purchase_price || 0));
  const [routeId, setRouteId] = useState('');
  const [vehicleType, setVehicleType] = useState('car_1_4');
  // Bez pól w UI (na życzenie klienta) — elektryk/hybryda nadal wykrywany
  // automatycznie z danych auta, "stan zamknięty" zawsze false (domyślne,
  // najczęstsze zachowanie).
  const [isEvHybrid] = useState(/electric|hybrid/i.test(car.fuel || ''));
  const [isClosedTitle] = useState(false);
  const [dutyRate, setDutyRate] = useState(DUTY_RATE_OPTIONS[0].value);
  const [customsValueEur, setCustomsValueEur] = useState(0);
  const [customsValueTouched, setCustomsValueTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      try {
        const [feesRes, routesRes, ratesRes] = await Promise.all([
          supabase.from('calc_auction_fees').select('*'),
          supabase.from('calc_shipping_routes').select('*'),
          fetch('/api/exchange-rates').then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (feesRes.error || routesRes.error || ratesRes.error) throw new Error('load failed');

        setFeeBrackets(feesRes.data || []);
        setRoutes(routesRes.data || []);
        setRates(ratesRes);

        const guessCity = guessYardCity(car);
        const matched = findRoute(auction, guessCity, routesRes.data || []);
        setRouteId(matched ? String(matched.id) : '');
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const route = useMemo(() => routes.find((r) => String(r.id) === routeId) || null, [routes, routeId]);
  const auctionRoutes = useMemo(() => routes.filter((r) => r.auction === auction), [routes, auction]);

  const result = useMemo(() => {
    if (!rates || feeBrackets.length === 0) return null;
    return computeLandingCost({
      auction,
      bidAmount: Number(bidAmount) || 0,
      route,
      vehicleType,
      isEvHybrid,
      isClosedTitle,
      dutyRate,
      customsValueEur: Number(customsValueEur) || 0,
      usdPlnRate: rates.usdPln,
      eurPlnRate: rates.eurPln,
      feeBrackets,
    });
  }, [rates, feeBrackets, auction, bidAmount, route, vehicleType, isEvHybrid, isClosedTitle, dutyRate, customsValueEur]);

  // Domyślna wartość odprawy dopasowuje się automatycznie do reszty
  // kalkulatora, dopóki użytkownik sam jej nie zmieni ręcznie.
  useEffect(() => {
    if (customsValueTouched || !result || !rates) return;
    setCustomsValueEur(defaultCustomsValueEur(result.stage1TotalUsd, rates.usdPln, rates.eurPln));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.stage1TotalUsd, rates, customsValueTouched]);

  if (loading) {
    return (
      <div className="calc-card">
        <div className="calc-header">
          <IconCalculator />
          <h3>{t('landingCostCalculator')}</h3>
          <span className="calc-badge">{t('estimated')}</span>
        </div>
        <div className="calc-loading">{t('loadingCalculator')}</div>
      </div>
    );
  }

  if (loadError || !result) {
    return null;
  }

  return (
    <div className="calc-card">
      <div className="calc-header">
        <IconCalculator />
        <h3>{t('landingCostCalculator')}</h3>
        <span className="calc-badge">{t('estimated')}</span>
      </div>

      <div className="calc-teaser">
        <span className="calc-teaser-label">{t('estimatedPriceAtHome')}</span>
        <span className="calc-teaser-value">{formatUsd(result.totalUsd)}</span>
      </div>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="calc-toggle" onClick={() => setExpanded((v) => !v)}>
        <span>{t('detailedCost')}</span>
        <IconChevron expanded={expanded} />
      </div>

      {expanded && (
        <div className="calc-details">
          <div className="calc-row">
            <span className="calc-label">{t('auctionPrice')}</span>
            <input
              type="number"
              className="calc-input"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
            />
          </div>

          <div className="calc-row">
            <span className="calc-label">{t('auctionFees')}</span>
            <span className="calc-value">{formatUsd(result.auctionFee)}</span>
          </div>

          <div className="calc-row">
            <span className="calc-label">{t('truckingToPort')}</span>
            <span className="calc-value">{formatUsd(result.landTransport)}</span>
          </div>

          <div className="calc-row calc-row-wrap">
            <span className="calc-label">{t('pickupYard')}</span>
            <select className="calc-select" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              <option value="">{t('selectPickupYard')}</option>
              {auctionRoutes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.yard_name}
                </option>
              ))}
            </select>
          </div>

          <div className="calc-row calc-row-wrap">
            <span className="calc-label">{t('freightToRotterdam')}</span>
            <select className="calc-select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {VEHICLE_TYPE_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            <span className="calc-value">{formatUsd(result.freight)}</span>
          </div>

          <div className="calc-subtotal">
            <span>{t('subtotalAuctionShipping')}</span>
            <span>{formatUsd(result.stage1TotalUsd)}</span>
          </div>

          <div className="calc-section-title">{t('customsClearanceEu')}</div>

          <div className="calc-row">
            <span className="calc-label">{t('customsValue')}</span>
            <input
              type="number"
              className="calc-input"
              value={customsValueEur}
              onChange={(e) => {
                setCustomsValueTouched(true);
                setCustomsValueEur(e.target.value);
              }}
            />
          </div>

          <div className="calc-row">
            <span className="calc-label">{t('duty')}</span>
            <select className="calc-select" value={dutyRate} onChange={(e) => setDutyRate(Number(e.target.value))}>
              {DUTY_RATE_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="calc-value">{formatEur(result.duty)}</span>
          </div>

          <div className="calc-row">
            <span className="calc-label">{t('vat')}</span>
            <span className="calc-value">{formatEur(result.vat)}</span>
          </div>

          <div className="calc-row">
            <span className="calc-label">{t('customsHandling')}</span>
            <span className="calc-value">{formatEur(result.customsHandlingFee)}</span>
          </div>

          <div className="calc-subtotal">
            <span>{t('customsClearanceTotal')}</span>
            <span>{formatEur(result.stage2TotalEur)}</span>
          </div>

          <div className="calc-total">
            <span>{t('estimatedPriceAtHome')}</span>
            <span>{formatUsd(result.totalUsd)}</span>
          </div>

          <p className="calc-disclaimer">{t('calcDisclaimer')}</p>
        </div>
      )}
    </div>
  );
}
