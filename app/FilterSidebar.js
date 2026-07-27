'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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

const STATE_OPTIONS = [
  ['FL', 'Florida (FL)'],
  ['CA', 'California (CA)'],
  ['TX', 'Texas (TX)'],
  ['GA', 'Georgia (GA)'],
  ['NY', 'New York (NY)'],
  ['CO', 'Colorado (CO)'],
  ['IL', 'Illinois (IL)'],
  ['NV', 'Nevada (NV)'],
];

const YEAR_MIN = 1990;
const YEAR_MAX = 2027;
const MILEAGE_MIN = 0;
const MILEAGE_MAX = 300000;

export default function FilterSidebar({ makesModels, initialFilters }) {
  const router = useRouter();

  const [auction, setAuction] = useState(initialFilters.site || '');
  const [make, setMake] = useState(initialFilters.make || '');
  const [model, setModel] = useState(initialFilters.model || '');
  const [damage, setDamage] = useState(initialFilters.damage || '');
  const [status, setStatus] = useState(initialFilters.status || '');
  const [state, setState] = useState(initialFilters.state || '');
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

  const models = useMemo(() => {
    const entry = makesModels.find((e) => e.make === make);
    return entry ? entry.models : [];
  }, [makesModels, make]);

  function handleMakeChange(e) {
    setMake(e.target.value);
    setModel('');
  }

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

  function buildParams({ resetPage } = { resetPage: true }) {
    const params = new URLSearchParams();
    if (auction) params.set('site', auction);
    if (make) params.set('make', make);
    if (model) params.set('model', model);
    if (damage) params.set('damage', damage);
    if (status) params.set('status', status);
    if (state) params.set('state', state);
    if (yearFrom > YEAR_MIN) params.set('yearFrom', String(yearFrom));
    if (yearTo < YEAR_MAX) params.set('yearTo', String(yearTo));
    if (mileageFrom > MILEAGE_MIN) params.set('mileageFrom', String(mileageFrom));
    if (mileageTo < MILEAGE_MAX) params.set('mileageTo', String(mileageTo));
    if (!resetPage && initialFilters.page && initialFilters.page !== '1') {
      params.set('page', initialFilters.page);
    }
    return params;
  }

  function applyFilters() {
    const params = buildParams({ resetPage: true });
    router.push(`/?${params.toString()}`);
  }

  function clearFilters() {
    setAuction('');
    setMake('');
    setModel('');
    setDamage('');
    setStatus('');
    setState('');
    setYearFrom(YEAR_MIN);
    setYearTo(YEAR_MAX);
    setMileageFrom(MILEAGE_MIN);
    setMileageTo(MILEAGE_MAX);
    router.push('/');
  }

  const yearMinPct = ((yearFrom - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const yearMaxPct = ((yearTo - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const mileageMinPct = ((mileageFrom - MILEAGE_MIN) / (MILEAGE_MAX - MILEAGE_MIN)) * 100;
  const mileageMaxPct = ((mileageTo - MILEAGE_MIN) / (MILEAGE_MAX - MILEAGE_MIN)) * 100;

  return (
    <aside className="sidebar-filters">
      <div className="filter-title">
        <span>Filters</span>
        <span style={{ fontSize: '0.8rem', color: '#38bdf8', cursor: 'pointer' }} onClick={clearFilters}>
          Reset
        </span>
      </div>

      <div className="filter-group">
        <label className="filter-label">Auction House</label>
        <select className="filter-select" value={auction} onChange={(e) => setAuction(e.target.value)}>
          <option value="">All (Copart & IAAI)</option>
          <option value="1">Copart</option>
          <option value="2">IAAI</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Make</label>
        <select className="filter-select" value={make} onChange={handleMakeChange}>
          <option value="">All Makes</option>
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
        <label className="filter-label">Model</label>
        <select
          className="filter-select"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={!make}
        >
          <option value="">{make ? 'All Models' : 'Select a make first'}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Primary Damage</label>
        <select className="filter-select" value={damage} onChange={(e) => setDamage(e.target.value)}>
          <option value="">All Damage Types</option>
          {DAMAGE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Vehicle Status</label>
        <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Year Range</label>
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
        <label className="filter-label">Mileage Range (mi)</label>
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
        <label className="filter-label">Location (State)</label>
        <select className="filter-select" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All States</option>
          {STATE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="sidebar-actions">
        <button className="btn btn-primary" onClick={applyFilters}>
          Apply Filters
        </button>
        <button className="btn btn-secondary" onClick={clearFilters}>
          Clear All
        </button>
      </div>
    </aside>
  );
}
