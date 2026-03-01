import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-sans-jp",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-serif-jp",
  weight: ["300", "400", "500", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Photo Delivery | Premium Photography",
  description: "Secure and elegant photo delivery for your special moments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${notoSansJP.variable} ${notoSerifJP.variable} antialiased bg-stone-50 text-stone-900 font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
