const API_BASE = 'https://api.apicar.store/api';

function getApiKey() {
  const key = process.env.APICAR_API_KEY;
  if (!key) throw new Error('Brak APICAR_API_KEY w zmiennych środowiskowych.');
  return key;
}

async function apiGet(path, params = {}) {
  const query = new URLSearchParams(params);
  const res = await fetch(`${API_BASE}${path}?${query.toString()}`, {
    method: 'GET',
    headers: {
      'api-key': getApiKey(),
      accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`apicar.store ${path} responded with status ${res.status}`);
  }

  return res.json();
}

// Strona wyników /history-cars. Zwraca tablicę aut (może być pusta, gdy
// skończyły się wyniki — to jest sygnał do zatrzymania paginacji).
export async function fetchHistoryCarsPage({ page, size, saleStatusSold = true, auctionDateFrom } = {}) {
  const params = { page, size, sort: 'sale_date', direction: 'desc' };
  if (saleStatusSold) params.sale_status = 'sold';
  if (auctionDateFrom) params.auction_date_from = auctionDateFrom;

  const result = await apiGet('/history-cars', params);
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  return [];
}

// Pełne dane pojedynczego VIN-u (razem z sale_history[]).
export async function fetchCarByVinFromApi(vin) {
  const result = await apiGet('/history-cars/vin', { vin });
  if (Array.isArray(result)) return result[0] || null;
  if (Array.isArray(result.data)) return result.data[0] || null;
  if (result.data) return result.data;
  return result;
}

// Specjalny endpoint z płatnego planu ($300/mc) — zwraca w JEDNYM zapytaniu
// pełne dane aut (razem z lot_info i sale_history), zaktualizowane w danym
// okresie. Max size=3000 na zapytanie (limit narzucony przez apicar.store).
// Zwraca { size, page, pages, count, data: [...] }.
export async function fetchUpdatedHistoryLots({ dateFrom, dateTo, page = 1, size = 3000 } = {}) {
  const params = { page, size };
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  return apiGet('/history-cars/updbd', params);
}
