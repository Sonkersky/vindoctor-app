'use client';

import { useEffect, useState } from 'react';

const ICON_PROPS = {
  width: 12,
  height: 12,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconStopwatch() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" />
      <path d="M9 2h6" />
      <path d="M12 2v3" />
    </svg>
  );
}

function formatCountdown(targetMs) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d:${hours}h:${minutes}m:${seconds}s`;
}

// Celowo BEZ startowego stanu zależnego od czasu (żeby nie było hydration
// mismatch — serwer i klient renderowałyby inny "teraz") — pierwszy render
// nic nie pokazuje, licznik startuje dopiero po zamontowaniu na kliencie.
export default function AuctionCountdown({ auctionDate }) {
  const [label, setLabel] = useState(null);

  useEffect(() => {
    if (!auctionDate) return undefined;
    const target = new Date(auctionDate).getTime();
    if (Number.isNaN(target)) return undefined;

    function tick() {
      setLabel(formatCountdown(target));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [auctionDate]);

  if (!label) return null;

  return (
    <span className="auction-countdown-badge">
      <IconStopwatch />
      {label}
    </span>
  );
}
