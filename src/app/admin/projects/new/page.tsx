"use client";

import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewProject() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [memo, setMemo] = useState("");
    const [expiryDays, setExpiryDays] = useState("30");

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // 簡単な入力チェック
        if (!name.trim()) return;

        // フォルダ名を名前から自動生成 (英数字やハイフン以外をのぞく等の処理)
        // 今回のシステムでは一意のタイムスタンプ等を付与する
        const generatedFolderName = `project-${Date.now()}`;

        setIsSaving(true);
        try {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(expiryDays));

            const { data, error } = await supabase
                .from('projects')
                .insert([
                    {
                        name: name,
                        folder_name: generatedFolderName,
                        password: password || null,
                        memo: memo || null,
                        expires_at: expiresAt.toISOString(),
                        status: 'active',
                        view_count: 0,
                        download_count: 0
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                router.push(`/admin/projects/${data.id}`);
            }
        } catch (error) {
            console.error('Error creating project:', error);
            alert("プロジェクトの作成に失敗しました: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsSaving(false);
        }
    };

    const generatePassword = () => {
        const chars = "abcdefghjkmnpqrstuvwxyz23456789";
        let pass = "";
        for (let i = 0; i < 8; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setPassword(pass);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/admin" className="p-2 -ml-2 text-stone-400 hover:text-stone-900 transition-colors rounded-lg hover:bg-stone-100">
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h2 className="text-3xl font-serif text-stone-800 tracking-wide">新規プロジェクト作成</h2>
                    <p className="text-stone-500 mt-1">お客様の基本情報と配信設定を入力してください</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 space-y-8">

                <div className="space-y-6">
                    <h3 className="text-lg font-medium text-stone-900 border-b border-stone-100 pb-2">基本情報</h3>

                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">プロジェクト名 / お客様名</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="例: 佐藤様 ウェディング"
                            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">
                            メモ <span className="text-stone-400 text-xs font-normal">（※お客様には表示されません）</span>
                        </label>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            placeholder="社内用メモなどを入力できます"
                            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all min-h-[100px]"
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-lg font-medium text-stone-900 border-b border-stone-100 pb-2">配信設定</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">有効期限</label>
                            <select
                                value={expiryDays}
                                onChange={(e) => setExpiryDays(e.target.value)}
                                className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all"
                            >
                                <option value="3">3日間</option>
                                <option value="7">7日間</option>
                                <option value="30">30日間</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">閲覧パスワード <span className="text-stone-400 text-xs font-normal">（空欄の場合はパスワードなし）</span></label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="任意のパスワード"
                                    className="w-full flex-1 px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={generatePassword}
                                    className="px-4 py-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors text-sm font-medium whitespace-nowrap"
                                >
                                    自動生成
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-md shadow-stone-200/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={20} />
                        <span>{isSaving ? "保存中..." : "保存して写真アップロードへ進む"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
