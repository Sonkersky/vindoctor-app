import { cookies } from "next/headers";
import "./globals.css";
import { SITE_URL } from "@/lib/seo";
import { LocaleProvider } from "./i18n/LocaleContext";
import LocaleToggle from "./i18n/LocaleToggle";
import FavoritesProvider from "./FavoritesProvider";
import AccountBar from "./AccountBar";
import AuthWidget from "./AuthWidget";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "VINDOCTOR - US Auto Auctions Search",
  description:
    "Search US car auction history by VIN. Photos, damage reports, sale prices and auction records from Copart and IAAI.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value === "pl" ? "pl" : "en";

  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <FavoritesProvider>
            <div className="top-right-bar">
              <AccountBar />
              <AuthWidget />
              <LocaleToggle />
            </div>
            {children}
          </FavoritesProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
