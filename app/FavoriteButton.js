'use client';

import { useFavorites } from './FavoritesContext';

export default function FavoriteButton({ vin }) {
  const { favorites, loadingUser, toggleFavorite } = useFavorites();
  const isFav = favorites.has(vin);

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(vin);
  }

  if (loadingUser) return null;

  return (
    <button
      type="button"
      className={`favorite-btn ${isFav ? 'active' : ''}`}
      onClick={handleClick}
      data-tooltip={isFav ? 'Saved' : 'Watch'}
      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFav}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav ? '#f87171' : 'none'} stroke={isFav ? '#f87171' : '#f8fafc'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
      </svg>
    </button>
  );
}
