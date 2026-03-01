import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-8 max-w-2xl mx-auto">
        <h1 className="text-sm tracking-[0.4em] text-stone-400 uppercase font-medium">Lumière Photography</h1>
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
