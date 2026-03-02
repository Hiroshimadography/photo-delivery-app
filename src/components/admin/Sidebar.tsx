"use client";

import { LayoutDashboard, Users, MessageSquareText, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function Sidebar() {
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.refresh(); // Refresh to re-evaluate middleware and redirect to login
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 bg-white border-r border-stone-200 flex-col fixed inset-y-0 z-50">
                <div className="p-6 border-b border-stone-200">
                    <h1 className="text-xl font-serif text-stone-800 tracking-wider line-clamp-1">dography納品アプリ</h1>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <Link href="/admin" className="flex items-center gap-3 px-4 py-3 text-stone-600 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors group">
                        <LayoutDashboard size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">ダッシュボード</span>
                    </Link>
                    <Link href="/admin/template" className="flex items-center gap-3 px-4 py-3 text-stone-600 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors group">
                        <MessageSquareText size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">案内文テンプレート</span>
                    </Link>
                    <Link href="/admin/settings" className="flex items-center gap-3 px-4 py-3 text-stone-600 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors group">
                        <Settings size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">ブランド設定</span>
                    </Link>
                </nav>

                <div className="p-4 border-t border-stone-200">
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-3 text-stone-500 hover:bg-stone-100 hover:text-red-600 rounded-lg transition-colors group"
                    >
                        <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
                        <span className="font-medium">ログアウト</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50 px-2 py-2 flex items-center justify-around pb-safe">
                <Link href="/admin" className="flex flex-col items-center justify-center w-16 h-12 text-stone-500 hover:text-stone-900">
                    <LayoutDashboard size={24} />
                    <span className="text-[10px] mt-1 font-medium">ホーム</span>
                </Link>
                <Link href="/admin/template" className="flex flex-col items-center justify-center w-16 h-12 text-stone-500 hover:text-stone-900">
                    <MessageSquareText size={24} />
                    <span className="text-[10px] mt-1 font-medium">案内文</span>
                </Link>
                <Link href="/admin/settings" className="flex flex-col items-center justify-center w-16 h-12 text-stone-500 hover:text-stone-900">
                    <Settings size={24} />
                    <span className="text-[10px] mt-1 font-medium">設定</span>
                </Link>
                <button onClick={handleLogout} className="flex flex-col items-center justify-center w-16 h-12 text-stone-500 hover:text-red-500">
                    <LogOut size={24} />
                    <span className="text-[10px] mt-1 font-medium">終了</span>
                </button>
            </nav>
        </>
    );
}
