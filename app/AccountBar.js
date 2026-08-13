'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useFavorites } from './FavoritesContext';
import { useLocale } from './i18n/LocaleContext';
import FavoritesPanel from './FavoritesPanel';
import MySettingsPanel from './MySettingsPanel';
import SearchHistoryPanel from './SearchHistoryPanel';

const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: '#38bdf8',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconHeart() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.36 5.64l-1.77 1.77M7.41 16.59l-1.77 1.77M18.36 18.36l-1.77-1.77M7.41 7.41L5.64 5.64" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

// Skrzynka odbiorcza — dla ikony "Leads" (zgłoszenia z "Buy This Car"),
// widocznej tylko dla adminów.
function IconInbox() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 12h4.5l1.5 3h6l1.5-3H21" />
      <path d="M5.5 6h13l2.5 6v7a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19v-7z" />
    </svg>
  );
}

// Kłódka przy pozycjach menu niedostępnych dla gościa.
function IconLock() {
  return (
    <svg {...ICON_PROPS} width={12} height={12} stroke="#64748b">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 019 0v3.5" />
    </svg>
  );
}

// Strony, na których pigułka "topbar" się nie pokazuje:
// - "/" — tam jest wariant "sidebar" (nad filtrami), menu nie ma się
//   duplikować w dwóch miejscach naraz.
// - "/admin/leads" — admin i tak już tam jest, link "Leads" prowadzący do
//   samego siebie (i reszta menu) jest zbędna.
const HIDDEN_TOPBAR_PATHS = ['/', '/admin/leads'];

// Opcje dostępne po zalogowaniu (Favorites/My Settings/Search History/
// Leads dla admina/Log out). Dwa warianty:
// - "topbar" (domyślny): pozioma pigułka obok przełącznika PL/EN
//   (app/layout.js) — używana wszędzie poza stronami z HIDDEN_TOPBAR_PATHS.
// - "sidebar": pionowa lista nad panelem filtrów, w tym samym stylu co
//   .sidebar-filters — używana tylko na stronie głównej (app/page.js), bo
//   tylko tam jest ten panel filtrów, do którego ma "pasować".
//
// Dla gościa (niezalogowanego) menu i tak się pokazuje — Favorites/My
// Settings/Search History dostają kłódkę i podpowiedź "Requires login" po
// najechaniu; kliknięcie otwiera modal logowania (to samo zdarzenie
// 'open-auth-modal', na które nasłuchuje AuthWidget przy serduszku na
// kafelku). "Leads" (tylko dla admina) i "Log out" mają sens wyłącznie po
// zalogowaniu, więc dla gościa się nie pokazują.
export default function AccountBar({ variant = 'topbar' }) {
  const [mounted, setMounted] = useState(false);
  const { user, loadingUser, isAdmin } = useFavorites();
  const { t } = useLocale();
  const pathname = usePathname();
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  function requireLogin() {
    window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { tab: 'login' } }));
  }

  if (!mounted || loadingUser) return null;
  if (variant === 'topbar' && HIDDEN_TOPBAR_PATHS.includes(pathname)) return null;

  const loggedIn = Boolean(user);

  const items = [
    {
      key: 'favorites',
      label: t('favorites'),
      icon: <IconHeart />,
      onClick: loggedIn ? () => setShowFavorites(true) : requireLogin,
      locked: !loggedIn,
    },
    {
      key: 'settings',
      label: t('mySettings'),
      icon: <IconSettings />,
      onClick: loggedIn ? () => setShowSettings(true) : requireLogin,
      locked: !loggedIn,
    },
    {
      key: 'history',
      label: t('searchHistory'),
      icon: <IconClock />,
      onClick: loggedIn ? () => setShowHistory(true) : requireLogin,
      locked: !loggedIn,
    },
    ...(isAdmin ? [{ key: 'leads', label: t('leadsAdmin'), icon: <IconInbox />, href: '/admin/leads' }] : []),
  ];

  const panels = loggedIn && (
    <>
      {showFavorites && <FavoritesPanel onClose={() => setShowFavorites(false)} />}
      {showSettings && <MySettingsPanel onClose={() => setShowSettings(false)} />}
      {showHistory && <SearchHistoryPanel onClose={() => setShowHistory(false)} />}
    </>
  );

  if (variant === 'sidebar') {
    return (
      <div className="account-sidebar">
        <div className="account-sidebar-title">{t('accountMenuTitle')}</div>
        {items.map((item) =>
          item.href ? (
            <Link key={item.key} href={item.href} className="account-sidebar-item">
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ) : (
            <button key={item.key} type="button" className="account-sidebar-item" onClick={item.onClick}>
              {item.icon}
              <span>{item.label}</span>
              {item.locked && (
                <span className="account-sidebar-lock">
                  <IconLock />
                  <span className="account-sidebar-tooltip">{t('requiresLogin')}</span>
                </span>
              )}
            </button>
          )
        )}
        {loggedIn && (
          <>
            <span className="account-sidebar-divider" />
            <button type="button" className="account-sidebar-item account-sidebar-logout" onClick={handleLogout}>
              <IconLogout />
              <span>{t('logOut')}</span>
            </button>
          </>
        )}
        {panels}
      </div>
    );
  }

  return (
    <div className="account-bar">
      {items.map((item) =>
        item.href ? (
          <Link key={item.key} href={item.href} className="account-bar-btn" aria-label={item.label}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            className="account-bar-btn"
            onClick={item.onClick}
            aria-label={item.locked ? `${item.label} (${t('requiresLogin')})` : item.label}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.locked && (
              <span className="account-bar-lock">
                <IconLock />
                <span className="account-bar-tooltip">{t('requiresLogin')}</span>
              </span>
            )}
          </button>
        )
      )}
      {loggedIn && (
        <>
          <span className="account-bar-divider" />
          <button
            type="button"
            className="account-bar-btn account-bar-icon-only account-bar-logout"
            onClick={handleLogout}
            aria-label={t('logOut')}
          >
            <IconLogout />
            <span className="account-bar-tooltip">{`${t('logOut')} (${user.email})`}</span>
          </button>
        </>
      )}
      {panels}
    </div>
  );
}
