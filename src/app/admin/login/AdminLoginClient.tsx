"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function AdminLoginClient({ brandName, logoUrl }: { brandName: string; logoUrl: string | null }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg("");

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        setLoading(false);

        if (error) {
            setErrorMsg("メールアドレスまたはパスワードが間違っています。");
            return;
        }

        router.push("/admin");
        router.refresh(); 
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-stone-200/50 p-8 border border-stone-100">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        {logoUrl ? (
                            <img src={logoUrl} alt={brandName} className="max-h-12 object-contain" />
                        ) : (
                            <div className="w-16 h-16 bg-stone-100 text-stone-600 rounded-full flex items-center justify-center">
                                <Lock size={32} />
                            </div>
                        )}
                    </div>
                    {logoUrl && <h1 className="text-xl font-serif text-stone-800 tracking-wider mb-2">{brandName}</h1>}
                    {!logoUrl && <h1 className="text-3xl font-serif text-stone-800 tracking-wider">Admin Login</h1>}
                    <p className="text-stone-500 mt-2">管理者ダッシュボードにログイン</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                            {errorMsg}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all"
                            placeholder="admin@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-stone-900 hover:bg-stone-800 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? "ログイン中..." : "ログイン"}
                    </button>
                </form>
            </div>
        </div>
    );
}
