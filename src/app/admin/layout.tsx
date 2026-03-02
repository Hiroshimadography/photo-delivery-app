import React from "react";
import { Sidebar } from "@/components/admin/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    // Auth check is now handled by middleware.ts

    return (
        <div className="flex min-h-screen bg-stone-50 text-stone-900 font-sans">
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                <div className="flex-1 p-8 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
