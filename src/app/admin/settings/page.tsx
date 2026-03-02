"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Save, UploadCloud, Image as ImageIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function BrandSettings() {
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [settingId, setSettingId] = useState<string | null>(null);

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const [brandName, setBrandName] = useState("Lumière Photography");

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('brand_settings')
                .select('*')
                .limit(1)
                .maybeSingle(); // Changed to maybeSingle to handle empty table gracefully

            if (data) {
                setSettingId(data.id);
                if (data.brand_name) setBrandName(data.brand_name);
                if (data.logo_url) setLogoPreviewUrl(data.logo_url);
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let finalLogoUrl = logoPreviewUrl;

            // 新しいファイルがアップロードされた場合
            if (logoFile) {
                const fileExt = logoFile.name.split('.').pop();
                const fileName = `logo-${Date.now()}.${fileExt}`;
                // storageへのアップロード
                const { error: uploadError } = await supabase.storage
                    .from('brand')
                    .upload(fileName, logoFile);

                if (uploadError) throw uploadError;

                // 公開URLを取得
                const { data: publicUrlData } = supabase.storage
                    .from('brand')
                    .getPublicUrl(fileName);

                finalLogoUrl = publicUrlData.publicUrl;
            }

            const upsertData: { brand_name: string; logo_url: string | null; updated_at: string; id?: string } = {
                brand_name: brandName,
                logo_url: finalLogoUrl,
                updated_at: new Date().toISOString()
            };

            // IDがある場合はUPDATE、無い場合は新規INSERT(Supabase側でUUID自動生成)
            if (settingId) {
                upsertData.id = settingId;
            }

            console.log("Upserting brand data:", upsertData);

            // Supabaseでは id なしで upsert するとエラーになることがあるため、
            // IDがない場合は insert を使う分岐に切り替え
            let response;
            if (settingId) {
                response = await supabase
                    .from('brand_settings')
                    .update(upsertData)
                    .eq('id', settingId)
                    .select()
                    .single();
            } else {
                response = await supabase
                    .from('brand_settings')
                    .insert(upsertData)
                    .select()
                    .single();
            }

            if (response.error) {
                console.error("Supabase Save Error:", response.error);
                throw response.error;
            }

            if (response.data && !settingId) {
                setSettingId(response.data.id);
            }

            setIsSaved(true);
            setLogoFile(null); // 一度保存したらFileオブジェクトはクリア
            if (finalLogoUrl) setLogoPreviewUrl(finalLogoUrl);

            setTimeout(() => setIsSaved(false), 3000);
        } catch (error) {
            console.error(error);
            alert("保存に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                setLogoFile(file);
                setLogoPreviewUrl(URL.createObjectURL(file));
            }
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.type.startsWith('image/')) {
                setLogoFile(file);
                setLogoPreviewUrl(URL.createObjectURL(file));
            }
        }
    };

    const removeLogo = () => {
        setLogoFile(null);
        if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
        setLogoPreviewUrl(null);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/admin" className="p-2 -ml-2 text-stone-400 hover:text-stone-900 transition-colors rounded-lg hover:bg-stone-100">
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h2 className="text-3xl font-serif text-stone-800 tracking-wide">ブランド設定</h2>
                    <p className="text-stone-500 mt-1">お客様ページに表示されるロゴやブランド名を設定します</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 space-y-10">

                {/* Brand Name */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-stone-900 border-b border-stone-100 pb-2">ブランド名</h3>
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">表示名（ロゴ画像がない場合はテキストで表示されます）</label>
                        <input
                            type="text"
                            required
                            value={brandName}
                            onChange={(e) => setBrandName(e.target.value)}
                            placeholder="例: Lumière Photography"
                            className="w-full max-w-md px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all"
                        />
                    </div>
                </div>

                {/* Logo Upload */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-stone-900 border-b border-stone-100 pb-2">ロゴ画像</h3>
                    <p className="text-sm text-stone-500 mb-4">
                        推奨サイズ: 幅400px以内、高さ100px以内 (透過PNG推奨)
                    </p>

                    {!logoPreviewUrl ? (
                        <div
                            onDragEnter={handleDragEnter}
                            onDragOver={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`max-w-xl border-2 border-dashed rounded-xl p-10 text-center transition-all ${isDragActive ? "border-stone-500 bg-stone-50" : "border-stone-200 hover:border-stone-300"
                                }`}
                        >
                            <UploadCloud className={`mx-auto h-10 w-10 mb-4 ${isDragActive ? "text-stone-600" : "text-stone-400"}`} />
                            <p className="text-stone-600 font-medium mb-1">ここにロゴ画像をドラッグ＆ドロップ</p>
                            <p className="text-stone-400 text-sm mb-6">または</p>
                            <label className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium px-6 py-2.5 rounded-lg cursor-pointer transition-colors inline-block text-sm">
                                ファイルを選択
                                <input type="file" accept="image/png, image/jpeg, image/svg+xml" className="hidden" onChange={handleFileSelect} />
                            </label>
                        </div>
                    ) : (
                        <div className="max-w-xl border border-stone-200 rounded-xl p-6 bg-stone-50 flex items-center justify-between">
                            <div className="flex-1 flex justify-center items-center bg-white p-4 rounded-lg border border-stone-100 mr-6 shadow-sm min-h-[100px]">
                                { }
                                <img src={logoPreviewUrl} alt="Logo Preview" className="max-h-16 max-w-full object-contain" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="bg-stone-900 hover:bg-stone-800 text-white font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm text-center">
                                    変更
                                    <input type="file" accept="image/png, image/jpeg, image/svg+xml" className="hidden" onChange={handleFileSelect} />
                                </label>
                                <button
                                    type="button"
                                    onClick={removeLogo}
                                    className="bg-red-50 hover:bg-red-100 text-red-600 font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-1"
                                >
                                    <Trash2 size={16} />
                                    削除
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Live Preview */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-stone-900 border-b border-stone-100 pb-2">実際の見え方（お客様画面）</h3>
                    <div className="max-w-xl border border-stone-200 rounded-xl overflow-hidden bg-[#FDFCFB]">
                        <header className="h-20 flex items-center justify-center border-b border-stone-200/50 bg-[#FDFCFB]/90 px-6">
                            {logoPreviewUrl ? (
                                 
                                <img src={logoPreviewUrl} alt={brandName} className="max-h-8 max-w-full object-contain" />
                            ) : (
                                <div className="text-sm tracking-[0.2em] text-stone-900 font-medium">
                                    {brandName || "BRAND NAME"}
                                </div>
                            )}
                        </header>
                    </div>
                </div>

                <div className="pt-6 flex justify-end border-t border-stone-100">
                    <button
                        type="submit"
                        disabled={isSaving || isLoading}
                        className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-md shadow-stone-200/50 disabled:opacity-50"
                    >
                        <Save size={20} className={isSaving ? "animate-pulse" : ""} />
                        <span>{isSaving ? "保存中..." : isSaved ? "保存しました" : "設定を保存"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
