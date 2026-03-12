import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = createAdminClient();
  let brandSettings = null;
  try {
    const { data } = await supabase
      .from('brand_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    brandSettings = data;
  } catch (err) {
    console.error("Fetch brand settings error in Home:", err);
  }

  const brandName = brandSettings?.brand_name || "Hiroshimadography";
  const logoUrl = brandSettings?.logo_url;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-8 max-w-2xl mx-auto">
        <div className="flex justify-center mb-4">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="max-h-16 object-contain" />
          ) : (
            <h1 className="text-sm tracking-[0.4em] text-stone-400 uppercase font-medium">{brandName}</h1>
          )}
        </div>
        <h2 className="text-4xl md:text-5xl font-serif text-stone-800 tracking-widest leading-tight">
          Timeless Moments,<br />Beautifully Delivered.
        </h2>
        <div className="w-16 h-px bg-stone-300 mx-auto" />
        <p className="text-stone-500 font-serif leading-loose tracking-wide">
          プロフェッショナル向け写真納品システム
        </p>

        <div className="pt-12">
          <Link
            href="/admin/login"
            className="inline-block bg-stone-900 hover:bg-stone-800 text-white px-8 py-3 rounded-lg text-sm font-medium tracking-widest uppercase transition-colors shadow-md"
          >
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  );
}
