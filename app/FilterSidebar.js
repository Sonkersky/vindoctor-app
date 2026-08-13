'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useFavorites } from './FavoritesContext';
import { useLocale } from './i18n/LocaleContext';

const DAMAGE_OPTIONS = [
  ['Front End', 'Front End'],
  ['Rear End', 'Rear End'],
  ['Side', 'Side / Side Damage'],
  ['Hail', 'Hail'],
  ['Water/Flood', 'Water / Flood'],
  ['Rollover', 'Rollover'],
  ['Normal Wear', 'Normal Wear'],
];

const STATUS_OPTIONS = ['Run & Drive', 'Starts', 'Stationary'];

const SELLER_OPTIONS = [
  ['insurance', 'Insurance'],
  ['non-insurance', 'Non-insurance'],
];

const FUEL_OPTIONS = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Flexible Fuel', 'Other'];

const CYLINDERS_OPTIONS = ['2', '3', '4', '5', '6', '8', '10', '12'];

const VEHICLE_TYPE_OPTIONS = ['Automobile', 'Truck', 'Motorcycle', 'Bus', 'Trailers', 'Mobile Home', 'ATV'];

const YEAR_MIN = 1990;
const YEAR_MAX = 2027;
const MILEAGE_MIN = 0;
const MILEAGE_MAX = 300000;
const ENGINE_SIZE_MIN = 0;
const ENGINE_SIZE_MAX = 10;

export default function FilterSidebar({ makesModels, initialFilters }) {
  const router = useRouter();
  const { user } = useFavorites();
  const { t } = useLocale();

  const [auction, setAuction] = useState(initialFilters.site || '');
  const [make, setMake] = useState(initialFilters.make || '');
  const [model, setModel] = useState(initialFilters.model || '');
  const [trim, setTrim] = useState(initialFilters.trim || '');
  const [trimOptions, setTrimOptions] = useState([]);
  const [damage, setDamage] = useState(initialFilters.damage || '');
  const [status, setStatus] = useState(initialFilters.status || '');
  const [sellerCategory, setSellerCategory] = useState(initialFilters.sellerCategory || '');
  const [fuel, setFuel] = useState(initialFilters.fuel || '');
  const [cylinders, setCylinders] = useState(initialFilters.cylinders || '');
  const [vehicleType, setVehicleType] = useState(initialFilters.vehicleType || 'Automobile');
  const [yearFrom, setYearFrom] = useState(
    initialFilters.yearFrom ? Number(initialFilters.yearFrom) : YEAR_MIN
  );
  const [yearTo, setYearTo] = useState(
    initialFilters.yearTo ? Number(initialFilters.yearTo) : YEAR_MAX
  );
  const [mileageFrom, setMileageFrom] = useState(
    initialFilters.mileageFrom ? Number(initialFilters.mileageFrom) : MILEAGE_MIN
  );
  const [mileageTo, setMileageTo] = useState(
    initialFilters.mileageTo ? Number(initialFilters.mileageTo) : MILEAGE_MAX
  );
  const [engineSizeFrom, setEngineSizeFrom] = useState(
    initialFilters.engineSizeFrom ? Number(initialFilters.engineSizeFrom) : ENGINE_SIZE_MIN
  );
  const [engineSizeTo, setEngineSizeTo] = useState(
    initialFilters.engineSizeTo ? Number(initialFilters.engineSizeTo) : ENGINE_SIZE_MAX
  );

  // "More Filters" domyślnie zwinięte, żeby przycisk "Apply Filters" był
  // widoczny bez przewijania — rozwija się tylko, gdy ktoś doda filtr
  // schowany w środku (albo kliknie ręcznie).
  const [showMore, setShowMore] = useState(
    Boolean(auction || damage || status || fuel || cylinders)
  );

  const models = useMemo(() => {
    const entry = makesModels.find((e) => e.make === make);
    return entry ? entry.models : [];
  }, [makesModels, make]);

  function handleMakeChange(e) {
    setMake(e.target.value);
    setModel('');
    setTrim('');
  }

  function handleModelChange(e) {
    setModel(e.target.value);
    setTrim('');
  }

  // Trim (kolumna "series" w bazie, np. Limited/Select/Touring) zależy od
  // konkretnej marki+modelu — dociągane na żądanie zamiast trzymane w
  // makesModels (kombinacji make+model+trim byłoby zbyt dużo, żeby ładować
  // to z góry na każde wejście na stronę).
  useEffect(() => {
    if (!make || !model) {
      setTrimOptions([]);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('cars')
      .select('series')
      .eq('sale_status', 'Sold')
      .eq('make', make)
      .eq('model', model)
      .not('series', 'is', null)
      .limit(1000)
      .then(({ data }) => {
        if (cancelled) return;
        const unique = [...new Set((data || []).map((r) => r.series).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b)
        );
        setTrimOptions(unique);
      });
    return () => {
      cancelled = true;
    };
  }, [make, model]);

  function handleYearFromChange(e) {
    const v = Math.min(Number(e.target.value), yearTo);
    setYearFrom(v);
  }
  function handleYearToChange(e) {
    const v = Math.max(Number(e.target.value), yearFrom);
    setYearTo(v);
  }
  function handleMileageFromChange(e) {
    const v = Math.min(Number(e.target.value), mileageTo);
    setMileageFrom(v);
  }
  function handleMileageToChange(e) {
    const v = Math.max(Number(e.target.value), mileageFrom);
    setMileageTo(v);
  }
  function handleEngineSizeFromChange(e) {
    const v = Math.min(Number(e.target.value), engineSizeTo);
    setEngineSizeFrom(v);
  }
  function handleEngineSizeToChange(e) {
    const v = Math.max(Number(e.target.value), engineSizeFrom);
    setEngineSizeTo(v);
  }

  function buildParams({ resetPage } = { resetPage: true }) {
    const params = new URLSearchParams();
    if (auction) params.set('site', auction);
    if (make) params.set('make', make);
    if (model) params.set('model', model);
    if (trim) params.set('trim', trim);
    if (damage) params.set('damage', damage);
    if (status) params.set('status', status);
    if (sellerCategory) params.set('sellerCategory', sellerCategory);
    if (fuel) params.set('fuel', fuel);
    if (cylinders) params.set('cylinders', cylinders);
    // "Automobile" to domyślny filtr (patrz lib/queries.js) — nie wpisujemy
    // go do URL-a, żeby zwykły link do strony głównej wyglądał czysto.
    if (vehicleType && vehicleType !== 'Automobile') params.set('vehicleType', vehicleType);
    if (yearFrom > YEAR_MIN) params.set('yearFrom', String(yearFrom));
    if (yearTo < YEAR_MAX) params.set('yearTo', String(yearTo));
    if (mileageFrom > MILEAGE_MIN) params.set('mileageFrom', String(mileageFrom));
    if (mileageTo < MILEAGE_MAX) params.set('mileageTo', String(mileageTo));
    if (engineSizeFrom > ENGINE_SIZE_MIN) params.set('engineSizeFrom', String(engineSizeFrom));
    if (engineSizeTo < ENGINE_SIZE_MAX) params.set('engineSizeTo', String(engineSizeTo));
    if (!resetPage && initialFilters.page && initialFilters.page !== '1') {
      params.set('page', initialFilters.page);
    }
    return params;
  }

  function applyFilters() {
    const params = buildParams({ resetPage: true });

    // Logujemy tylko realne wyszukiwania (co najmniej jeden filtr) — kliknięcie
    // "Apply Filters" bez żadnych ustawionych filtrów to w praktyce "pokaż
    // wszystko", nie jest warte zapamiętania w historii.
    if (user && params.toString()) {
      const supabase = createClient();
      supabase
        .from('search_history')
        .insert({ user_id: user.id, search_type: 'filters', filters: Object.fromEntries(params.entries()) })
        .then(() => {});
    }

    router.push(`/?${params.toString()}`);
  }

  function clearFilters() {
    setAuction('');
    setMake('');
    setModel('');
    setTrim('');
    setDamage('');
    setStatus('');
    setSellerCategory('');
    setFuel('');
    setCylinders('');
    setVehicleType('Automobile');
    setYearFrom(YEAR_MIN);
    setYearTo(YEAR_MAX);
    setMileageFrom(MILEAGE_MIN);
    setMileageTo(MILEAGE_MAX);
    setEngineSizeFrom(ENGINE_SIZE_MIN);
    setEngineSizeTo(ENGINE_SIZE_MAX);
    router.push('/');
  }

  const yearMinPct = ((yearFrom - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const yearMaxPct = ((yearTo - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const mileageMinPct = ((mileageFrom - MILEAGE_MIN) / (MILEAGE_MAX - MILEAGE_MIN)) * 100;
  const mileageMaxPct = ((mileageTo - MILEAGE_MIN) / (MILEAGE_MAX - MILEAGE_MIN)) * 100;
  const engineSizeMinPct = ((engineSizeFrom - ENGINE_SIZE_MIN) / (ENGINE_SIZE_MAX - ENGINE_SIZE_MIN)) * 100;
  const engineSizeMaxPct = ((engineSizeTo - ENGINE_SIZE_MIN) / (ENGINE_SIZE_MAX - ENGINE_SIZE_MIN)) * 100;

  return (
    <aside className="sidebar-filters">
      <div className="filter-title">
        <span>{t('filters')}</span>
        <span style={{ fontSize: '0.8rem', color: '#38bdf8', cursor: 'pointer' }} onClick={clearFilters}>
          {t('reset')}
        </span>
      </div>

      <div className="filter-group">
        <label className="filter-label">{t('vehicleType')}</label>
        <select className="filter-select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
          <option value="all">{t('allTypes')}</option>
          {VEHICLE_TYPE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">{t('seller')}</label>
        <select className="filter-select" value={sellerCategory} onChange={(e) => setSellerCategory(e.target.value)}>
          <option value="">{t('allSellers')}</option>
          {SELLER_OPTIONS.map(([value]) => (
            <option key={value} value={value}>
              {value === 'insurance' ? t('insurance') : t('nonInsurance')}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">{t('make')}</label>
        <select className="filter-select" value={make} onChange={handleMakeChange}>
          <option value="">{t('allMakes')}</option>
          {[...makesModels]
            .sort((a, b) => a.make.localeCompare(b.make))
            .map((entry) => (
              <option key={entry.make} value={entry.make}>
                {entry.make}
              </option>
            ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">{t('model')}</label>
        <select
          className="filter-select"
          value={model}
          onChange={handleModelChange}
          disabled={!make}
        >
          <option value="">{make ? t('allModels') : t('selectMakeFirst')}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">{t('trim')}</label>
        <select
          className="filter-select"
          value={trim}
          onChange={(e) => setTrim(e.target.value)}
          disabled={!model}
        >
          <option value="">{model ? t('allTrims') : t('selectModelFirst')}</option>
          {trimOptions.map((trimValue) => (
            <option key={trimValue} value={trimValue}>
              {trimValue}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">{t('yearRange')}</label>
        <div className="slider-values">
          <span>{yearFrom}</span>
          <span>{yearTo}</span>
        </div>
        <div className="dual-range-slider">
          <div className="slider-track"></div>
          <div
            className="slider-range"
            style={{ left: `${yearMinPct}%`, right: `${100 - yearMaxPct}%` }}
          ></div>
          <input
            type="range"
            className="range-slider"
            min={YEAR_MIN}
            max={YEAR_MAX}
            step={1}
            value={yearFrom}
            onChange={handleYearFromChange}
          />
          <input
            type="range"
            className="range-slider"
            min={YEAR_MIN}
            max={YEAR_MAX}
            step={1}
            value={yearTo}
            onChange={handleYearToChange}
          />
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-label">{t('mileageRange')}</label>
        <div className="slider-values">
          <span>{mileageFrom.toLocaleString('en-US')} mi</span>
          <span>
            {mileageTo >= MILEAGE_MAX
              ? `${mileageTo.toLocaleString('en-US')}+ mi`
              : `${mileageTo.toLocaleString('en-US')} mi`}
          </span>
        </div>
        <div className="dual-range-slider">
          <div className="slider-track"></div>
          <div
            className="slider-range"
            style={{ left: `${mileageMinPct}%`, right: `${100 - mileageMaxPct}%` }}
          ></div>
          <input
            type="range"
            className="range-slider"
            min={MILEAGE_MIN}
            max={MILEAGE_MAX}
            step={1000}
            value={mileageFrom}
            onChange={handleMileageFromChange}
          />
          <input
            type="range"
            className="range-slider"
            min={MILEAGE_MIN}
            max={MILEAGE_MAX}
            step={1000}
            value={mileageTo}
            onChange={handleMileageToChange}
          />
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-label">{t('engineSize')}</label>
        <div className="slider-values">
          <span>{engineSizeFrom.toFixed(1)}L</span>
          <span>{engineSizeTo >= ENGINE_SIZE_MAX ? `${ENGINE_SIZE_MAX.toFixed(1)}L+` : `${engineSizeTo.toFixed(1)}L`}</span>
        </div>
        <div className="dual-range-slider">
          <div className="slider-track"></div>
          <div
            className="slider-range"
            style={{ left: `${engineSizeMinPct}%`, right: `${100 - engineSizeMaxPct}%` }}
          ></div>
          <input
            type="range"
            className="range-slider"
            min={ENGINE_SIZE_MIN}
            max={ENGINE_SIZE_MAX}
            step={0.1}
            value={engineSizeFrom}
            onChange={handleEngineSizeFromChange}
          />
          <input
            type="range"
            className="range-slider"
            min={ENGINE_SIZE_MIN}
            max={ENGINE_SIZE_MAX}
            step={0.1}
            value={engineSizeTo}
            onChange={handleEngineSizeToChange}
          />
        </div>
      </div>

      <button type="button" className="more-filters-toggle" onClick={() => setShowMore((v) => !v)}>
        {showMore ? t('fewerFilters') : t('moreFilters')}
      </button>

      {showMore && (
        <div className="more-filters-panel">
          <div className="filter-group">
            <label className="filter-label">{t('auctionHouse')}</label>
            <select className="filter-select" value={auction} onChange={(e) => setAuction(e.target.value)}>
              <option value="">{t('allAuctions')}</option>
              <option value="1">Copart</option>
              <option value="2">IAAI</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">{t('primaryDamage')}</label>
            <select className="filter-select" value={damage} onChange={(e) => setDamage(e.target.value)}>
              <option value="">{t('allDamageTypes')}</option>
              {DAMAGE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">{t('vehicleStatus')}</label>
            <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('allStatuses')}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">{t('engineType')}</label>
            <select className="filter-select" value={fuel} onChange={(e) => setFuel(e.target.value)}>
              <option value="">{t('allEngineTypes')}</option>
              {FUEL_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">{t('cylinders')}</label>
            <select className="filter-select" value={cylinders} onChange={(e) => setCylinders(e.target.value)}>
              <option value="">{t('any')}</option>
              {CYLINDERS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="sidebar-actions">
        <button className="btn btn-primary" onClick={applyFilters}>
          {t('applyFilters')}
        </button>
        <button className="btn btn-secondary" onClick={clearFilters}>
          {t('clearAll')}
        </button>
      </div>
    </aside>
  );
}
