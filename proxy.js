import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Zastępuje middleware.js (przestarzałe w tej wersji Next.js — patrz
// node_modules/next/dist/docs/.../proxy.md). Jedyne zadanie: odświeżyć token
// sesji Supabase na każde żądanie i zapisać go z powrotem do ciasteczek,
// zanim strona się wyrenderuje — bez tego użytkownicy wylogowywaliby się
// przy wygaśnięciu tokena mimo aktywnego korzystania ze strony.
export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Samo wywołanie odświeża token, jeśli trzeba — wynik nie jest tu
  // wykorzystywany bezpośrednio (ochrona konkretnych stron robimy osobno,
  // w miejscach, które tego wymagają).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Wszystko poza plikami statycznymi/obrazkami/API sync — te nie
    // potrzebują sesji użytkownika, a odpalanie proxy na nich to zbędny koszt.
    '/((?!_next/static|_next/image|favicon.ico|logo_2.png|api/sync|sitemap|robots.txt).*)',
  ],
};
