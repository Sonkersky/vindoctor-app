import "./globals.css";
import { SITE_URL } from "@/lib/seo";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "VINDOCTOR - US Auto Auctions Search",
  description:
    "Search US car auction history by VIN. Photos, damage reports, sale prices and auction records from Copart and IAAI.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
