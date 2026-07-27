import "./globals.css";

export const metadata = {
  title: "VINDOCTOR - US Auto Auctions Search",
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
