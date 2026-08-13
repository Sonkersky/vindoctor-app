'use client';

import { createContext, useContext } from 'react';

export const FavoritesContext = createContext({
  user: null,
  loadingUser: true,
  favorites: new Set(),
  toggleFavorite: async () => {},
  mileageUnit: 'mi',
  updateMileageUnit: async () => {},
});

export function useFavorites() {
  return useContext(FavoritesContext);
}
