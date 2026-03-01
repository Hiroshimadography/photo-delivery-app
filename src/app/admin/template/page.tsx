"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Info } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

const DEFAULT_TEMPLATE = `{{customer_name}} 様
先日は撮影会にお越しいただき、本当にありがとうございました。
当日の温かい空気感や、皆様の素敵な表情を思い出しながら、心を込めてお写真を仕上げさせていただきました。

下記の専用ページより、大切なお写真をお受け取りください。

■お写真の確認・保存はこちら
{{url}}
パスワード：{{password}}
保存期限：{{expiry_date}} まで

■ダウンロード方法について
ページ内の『一括保存』または、お好きな写真を選んで保存いただけます。
※スマホ・パソコンどちらからでも操作可能です。

このお写真が、皆様にとってかけがえのない宝物になりますように。
またお会いできる日を楽しみにしております。`;

export default function TemplateEditor() {
    const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [settingId, setSettingId] = useState<string | null>(null);

    useEffect(() => {
        fetchTemplate();
    }, []);

    const fetchTemplate = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .eq('key', 'delivery_template')
                .single();

            if (data && !error) {
                setSettingId(data.id);
                if (data.value) setTemplate(data.value);
            }
        } catch (error) {
            console.error("Error fetching template:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const upsertData = {
                id: settingId || undefined,
                key: 'delivery_template',
                value: template,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('settings')
                .upsert([upsertData], { onConflict: 'key' })
                .select()
                .single();

            if (error) throw error;

            if (data && !settingId) {
                setSettingId(data.id);
            }

            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        } catch (error) {
            console.error(error);
            alert("保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/admin" className="p-2 -ml-2 text-stone-400 hover:text-stone-900 transition-colors rounded-lg hover:bg-stone-100">
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h2 className="text-3xl font-serif text-stone-800 tracking-wide">案内文テンプレート設定</h2>
                    <p className="text-stone-500 mt-1">お客様に送る納品メッセージのデフォルト文章を設定します</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
                            <span className="font-medium text-stone-700">メール本文</span>
                            <button
                                onClick={() => setTemplate(DEFAULT_TEMPLATE)}
                                className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
                            >
                                初期値に戻す
                            </button>
                        </div>
                        <textarea
                            value={template}
                            onChange={(e) => setTemplate(e.target.value)}
                            className="w-full h-[500px] p-6 focus:outline-none resize-none leading-relaxed text-stone-700"
                            placeholder="案内文を入力してください..."
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-md shadow-stone-200/50 disabled:opacity-50"
                        >
                            <Save size={20} className={isSaving ? "animate-pulse" : ""} />
                            <span>{isSaving ? "保存中..." : isSaved ? "保存しました" : "テンプレートを保存"}</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-800 font-medium mb-4">
                            <Info size={20} />
                            <h3>利用可能な変数</h3>
                        </div>
                        <p className="text-sm text-blue-800/80 mb-4">
                            以下のタグを文章内に入れると、プロジェクトごとの実際の内容に自動変換されて出力されます。
                        </p>
                        <ul className="space-y-3">
                            <li className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm shadow-blue-100/20">
                                <code className="text-blue-700 font-bold block mb-1">{"{{customer_name}}"}</code>
                                <span className="text-xs text-stone-600 block">お客様名 / プロジェクト名</span>
                            </li>
                            <li className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm shadow-blue-100/20">
                                <code className="text-blue-700 font-bold block mb-1">{"{{url}}"}</code>
                                <span className="text-xs text-stone-600 block">専用ページのURL</span>
                            </li>
                            <li className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm shadow-blue-100/20">
                                <code className="text-blue-700 font-bold block mb-1">{"{{password}}"}</code>
                                <span className="text-xs text-stone-600 block">閲覧パスワード</span>
                            </li>
                            <li className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm shadow-blue-100/20">
                                <code className="text-blue-700 font-bold block mb-1">{"{{expiry_date}}"}</code>
                                <span className="text-xs text-stone-600 block">有効期限 (例: 2026/03/31)</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
