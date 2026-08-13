'use client';

import { useEffect } from 'react';

// Ustawia --top-bar-right tak, żeby .top-right-bar (menu konta/logowania +
// przełącznik PL/EN, patrz app/layout.js — position:fixed, liczony od
// krawędzi viewportu) kończył się dokładnie nad prawą krawędzią ostatniego
// kafelka w .car-grid, a nie nad krawędzią viewportu — .car-grid jest teraz
// węższy niż kontener (patrz page.css, celowy odstęp po prawej), więc trzeba
// to zmierzyć w JS zamiast liczyć na sztywno w CSS.
// Renderowany tylko na stronie głównej (jedyne miejsce z .car-grid) — gdy
// komponent się odmontuje (np. przejście na stronę lota), zmienna wraca do
// wartości domyślnej (20px od krawędzi viewportu).
export default function HomeGridAligner() {
  useEffect(() => {
    function update() {
      const grid = document.querySelector('.car-grid');
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      // clientWidth (nie window.innerWidth!) — innerWidth liczy też szerokość
      // paska przewijania, a "right" na position:fixed odnosi się do
      // krawędzi BEZ paska przewijania. Różnica dawała ok. 15-17px przesunięcia.
      const inset = Math.max(0, Math.round(document.documentElement.clientWidth - rect.right));
      document.documentElement.style.setProperty('--top-bar-right', `${inset}px`);
    }

    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--top-bar-right');
    };
  }, []);

  return null;
}
