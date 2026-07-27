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
};

export default nextConfig;
