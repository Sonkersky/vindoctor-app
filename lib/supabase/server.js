import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Klient Supabase do użycia w Server Components / Route Handlers — czyta i
// (gdzie się da) zapisuje sesję przez ciasteczka. W samych Server Components
// zapis ciasteczek jest niemożliwy (Next.js to blokuje) — odświeżanie sesji
// tam obsługuje proxy.js, więc błąd przy setAll tutaj można bezpiecznie
// zignorować (patrz komentarz niżej).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Wywołane z Server Component (nie z Route Handlera ani Server
            // Function) — nie da się tam zapisać ciasteczka. Nieszkodliwe,
            // dopóki proxy.js odświeża sesję na każde żądanie.
          }
        },
      },
    }
  );
}
