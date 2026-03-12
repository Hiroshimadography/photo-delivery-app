import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

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

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Photo Delivery | Premium Photography",
  description: "Secure and elegant photo delivery for your special moments.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Replace middleware by doing auth checks at the root layout level
  // This bypasses Vercel's Edge function bundler which is crashing during 'Deploying outputs'
  const headersList = await headers();
  const currentPath = headersList.get("x-invoke-path") || "";

  if (currentPath.startsWith("/admin") && !currentPath.startsWith("/admin/login")) {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      redirect("/admin/login");
    }
  }

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
