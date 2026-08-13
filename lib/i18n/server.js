import { cookies } from 'next/headers';
import { getTranslator } from './translations';

// Ten sam sposób odczytu locale co w app/layout.js — dla Server Components,
// które renderują tekst UI i nie mogą użyć klienckiego useLocale().
export async function getServerLocale() {
  const cookieStore = await cookies();
  return cookieStore.get('locale')?.value === 'pl' ? 'pl' : 'en';
}

export async function getServerTranslator() {
  const locale = await getServerLocale();
  return { locale, t: getTranslator(locale) };
}
