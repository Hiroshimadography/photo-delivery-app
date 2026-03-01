import { LayoutDashboard, Users, MessageSquareText, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import React from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    // TODO: Add actual auth check. If not logged in, redirect to /admin/login.

    return (
        <div className="flex min-h-screen bg-stone-50 text-stone-900 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-stone-200 flex flex-col">
                <div className="p-6 border-b border-stone-200">
                    <h1 className="text-xl font-serif text-stone-800 tracking-wider">Photo Delivery Admin</h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/admin" className="flex items-center gap-3 px-4 py-3 text-stone-600 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors">
                        <LayoutDashboard size={20} />
                        <span className="font-medium">ダッシュボード</span>
                    </Link>
                    <Link href="/admin/template" className="flex items-center gap-3 px-4 py-3 text-stone-600 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors">
                        <MessageSquareText size={20} />
                        <span className="font-medium">案内文テンプレート</span>
                    </Link>
                    <Link href="/admin/settings" className="flex items-center gap-3 px-4 py-3 text-stone-600 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors">
                        <Settings size={20} />
                        <span className="font-medium">ブランド設定</span>
                    </Link>
                </nav>

                <div className="p-4 border-t border-stone-200">
                    <button className="flex w-full items-center gap-3 px-4 py-3 text-stone-500 hover:bg-stone-100 hover:text-red-600 rounded-lg transition-colors">
                        <LogOut size={20} />
                        <span className="font-medium">ログアウト</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                <div className="flex-1 p-8 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
