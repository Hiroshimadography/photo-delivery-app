import React from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import type { Metadata } from 'next';

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    // Auth check is now handled by middleware.ts

    return (
        <div className="flex min-h-screen bg-stone-50 text-stone-900 font-sans">
            <Sidebar />

            {/* Mobile Header */}
            <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-stone-200 z-40 px-4 flex items-center justify-between">
                <h1 className="text-lg font-serif text-stone-800 tracking-wider">dography</h1>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col w-full md:pl-64 pt-14 md:pt-0 pb-16 md:pb-0 min-h-screen">
                <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-[100vw]">
                    {children}
                </div>
            </main>
        </div>
    );
}
