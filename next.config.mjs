import { SITE_URL } from './lib/seo.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Zachowuje dokładnie dotychczasowy adres z GitHub Pages: lot.html?vin=...
      // (URL w pasku przeglądarki się nie zmienia), a treść serwuje nasza
      // nowa strona /lot/[vin].
      {
        source: '/lot.html',
        has: [{ type: 'query', key: 'vin', value: '(?<vin>.*)' }],
        destination: '/lot/:vin',
      },
    ];
  },
  async redirects() {
    return [
      // Docelowa domena to doctor.vin — każdy adres pod starą (domyślną)
      // domeną Vercela przekierowujemy 1:1 na ten sam adres pod doctor.vin,
      // żeby nie stracić pozycji w Google przy migracji (ten sam URL,
      // tylko inna domena — najbezpieczniejszy typ migracji SEO).
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'vindoctor-app.vercel.app' }],
        destination: `${SITE_URL}/:path*`,
        permanent: true,
      },
      // www -> apex (jedna kanoniczna wersja adresu, unika duplikacji treści)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.doctor.vin' }],
        destination: `${SITE_URL}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
