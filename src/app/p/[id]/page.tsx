"use client";

import { useState, use, useEffect } from "react";
import { Lock, Download, CheckSquare, Square, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

type Project = {
    id: string;
    name: string;
    folder_name: string;
    password: string | null;
    expires_at: string | null;
    status: string;
};

type Photo = {
    id: string;
    url: string;
};

type BrandSettings = {
    brand_name: string;
    logo_url: string | null;
};

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: folder_name } = use(params);

    const [project, setProject] = useState<Project | null>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [settings, setSettings] = useState<BrandSettings>({ brand_name: "Lumière Photography", logo_url: null });
    const [isLoading, setIsLoading] = useState(true);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [error, setError] = useState(false);

    useEffect(() => {
        fetchProjectData();

    }, [folder_name]);

    const fetchProjectData = async () => {
        setIsLoading(true);
        try {
            // 1. プロジェクト取得
            const { data: pData, error: pError } = await supabase
                .from('projects')
                .select('*')
                .eq('folder_name', folder_name)
                .single();

            if (pError || !pData) {
                console.error("Project not found", pError);
                setIsLoading(false);
                return;
            }
            setProject(pData);

            // パスワードが設定されていなければ最初から認証済みとする
            if (!pData.password) {
                setIsAuthenticated(true);
            }

            // 2. 写真取得
            const { data: photoData } = await supabase
                .from('photos')
                .select('*')
                .eq('project_id', pData.id)
                .order('created_at', { ascending: true });

            if (photoData) {
                setPhotos(photoData);
            }

            // 3. ブランド設定取得 (とりあえずID 1などを想定)
            const { data: sData, error: sError } = await supabase
                .from('brand_settings')
                .select('*')
                .limit(1)
                .single();

            if (!sError && sData) {
                setSettings({
                    brand_name: sData.brand_name || "Lumière Photography",
                    logo_url: sData.logo_url
                });
            }

            // 閲覧回数のカウントアップ (今回RPCは省略して簡易更新、もしくは作らない)
            // if (pData) { ... }

        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (project && (passwordInput === project.password || !project.password)) {
            setIsAuthenticated(true);
            setError(false);
        } else {
            setError(true);
        }
    };

    const togglePhotoSelection = (photoId: string) => {
        const newSet = new Set(selectedPhotos);
        if (newSet.has(photoId)) {
            newSet.delete(photoId);
        } else {
            newSet.add(photoId);
        }
        setSelectedPhotos(newSet);
    };

    const [isDownloading, setIsDownloading] = useState(false);

    // ユーティリティ: URLからBlobを取得する
    const fetchImageAsBlob = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        return await response.blob();
    };

    const handleDownloadSelected = async () => {
        if (selectedPhotos.size === 0) return;
        setIsDownloading(true);
        try {
            const JSZip = (await import("jszip")).default;
            const { saveAs } = (await import("file-saver")).default;
            const zip = new JSZip();

            const selectedArray = Array.from(selectedPhotos);

            // 全ての選択画像をBlobとして並列フェッチ
            const fetchPromises = selectedArray.map(async (photoId, index) => {
                const photo = photos.find(p => p.id === photoId);
                if (photo) {
                    const blob = await fetchImageAsBlob(photo.url);
                    // ファイル名を作成
                    zip.file(`photo-${index + 1}.jpg`, blob);
                }
            });

            await Promise.all(fetchPromises);

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${project?.folder_name || 'download'}_selected.zip`);

        } catch (err) {
            console.error(err);
            alert("ダウンロード中にエラーが発生しました。");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadAll = async () => {
        setIsDownloading(true);
        try {
            const JSZip = (await import("jszip")).default;
            const { saveAs } = (await import("file-saver")).default;
            const zip = new JSZip();

            // 全ての画像をフェッチ
            const fetchPromises = photos.map(async (photo, index) => {
                const blob = await fetchImageAsBlob(photo.url);
                zip.file(`img_${String(index + 1).padStart(3, '0')}.jpg`, blob);
            });

            await Promise.all(fetchPromises);

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${project?.folder_name || 'download'}_all.zip`);

        } catch (err) {
            console.error(err);
            alert("一括ダウンロード中にエラーが発生しました。");
        } finally {
            setIsDownloading(false);
        }
    };

    if (!isAuthenticated) {
        // もし写真があれば1枚目をカバー画像として使用（なければデフォルトの画像等）
        const coverImage = photos.length > 0 ? photos[0].url : "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop";

        return (
            <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center relative overflow-hidden">
                {/* Background Image with Overlay */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={coverImage}
                        alt="Cover"
                        className="w-full h-full object-cover object-center opacity-30 blur-sm"
                    />
                    <div className="absolute inset-0 bg-stone-50/80 backdrop-blur-md" />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="z-10 w-full max-w-md bg-white/80 backdrop-blur-xl p-10 rounded-2xl shadow-2xl border border-white/50 text-center"
                >
                    {settings.logo_url ? (

                        <img src={settings.logo_url} alt={settings.brand_name} className="max-h-12 mx-auto mb-8 object-contain" />
                    ) : (
                        <h1 className="text-sm tracking-[0.3em] text-stone-400 mb-8 font-medium">{settings.brand_name}</h1>
                    )}

                    <h2 className="text-3xl font-serif text-stone-800 tracking-widest mb-2 leading-relaxed">
                        {project ? project.name : ""}
                    </h2>
                    <div className="w-12 h-px bg-stone-300 mx-auto my-6" />

                    <p className="text-stone-500 mb-8 font-serif leading-loose text-sm">
                        パスワードを入力して<br />ギャラリーへお進みください
                    </p>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => { setPasswordInput(e.target.value); setError(false); }}
                                className={`w-full text-center tracking-widest px-4 py-3 bg-white/50 border-b-2 ${error ? 'border-red-300' : 'border-stone-300'} focus:outline-none focus:border-stone-600 transition-colors rounded-t-sm`}
                                placeholder="PASSWORD"
                            />
                            {error && <p className="text-red-400 text-xs mt-2 font-medium tracking-wider">パスワードが正しくありません</p>}
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-stone-900 hover:bg-stone-800 text-white tracking-widest py-4 transition-colors text-sm uppercase flex items-center justify-center gap-2 group"
                        >
                            <span>Enter Gallery</span>
                            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFCFB]">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#FDFCFB]/90 backdrop-blur-md border-b border-stone-200/50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    {settings.logo_url ? (

                        <img src={settings.logo_url} alt={settings.brand_name} className="max-h-8 object-contain" />
                    ) : (
                        <div className="text-sm tracking-[0.2em] text-stone-900 font-medium">
                            {settings.brand_name}
                        </div>
                    )}
                    <div className="text-stone-500 font-serif tracking-widest text-sm hidden md:block">
                        {project ? project.name : ""}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-12 md:py-20">
                {/* Intro */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1 }}
                    className="text-center max-w-2xl mx-auto mb-20 space-y-6"
                >
                    <h1 className="text-4xl md:text-5xl font-serif text-stone-800 tracking-widest leading-tight">
                        {project ? project.name : ""}
                    </h1>
                    <div className="w-16 h-px bg-stone-300 mx-auto" />
                    <p className="text-stone-500 font-serif leading-loose tracking-wide">
                        この度は撮影にお越しいただき誠にありがとうございました。<br />
                        皆様の素敵な瞬間を切り取ったお写真をお届けします。
                    </p>
                </motion.div>

                {/* Action Bar (Sticky) */}
                <div className="sticky top-24 z-30 bg-white shadow-lg shadow-stone-200/20 border border-stone-200/60 rounded-xl p-4 md:p-6 mb-12 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl">
                    <div className="text-stone-600 text-sm font-medium w-full sm:w-auto text-center sm:text-left">
                        {selectedPhotos.size > 0 ? `${selectedPhotos.size}枚の写真を選択中` : '写真を選択してダウンロード可能です'}
                    </div>

                    <div className="flex w-full sm:w-auto gap-3">
                        <button
                            onClick={handleDownloadSelected}
                            disabled={selectedPhotos.size === 0 || isDownloading}
                            className="flex-1 sm:flex-none px-6 py-3 border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Download size={16} className={isDownloading ? "animate-bounce" : ""} />
                            {isDownloading ? "準備中..." : `選択保存 (${selectedPhotos.size})`}
                        </button>
                        <button
                            onClick={handleDownloadAll}
                            disabled={isDownloading}
                            className="flex-1 sm:flex-none px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-md"
                        >
                            <Download size={16} className={isDownloading ? "animate-bounce" : ""} />
                            {isDownloading ? "準備中..." : "一括保存"}
                        </button>
                    </div>
                </div>

                {/* Gallery Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
                    {photos.map((photo, i) => {
                        const isSelected = selectedPhotos.has(photo.id);
                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: i * 0.05 }}
                                key={photo.id}
                                className="group relative aspect-[4/5] overflow-hidden bg-stone-100 cursor-pointer"
                                onClick={() => togglePhotoSelection(photo.id)}
                            >
                                <img
                                    src={photo.url}
                                    alt=""
                                    className={`w-full h-full object-cover transition-all duration-700 ${isSelected ? 'scale-105 opacity-90' : 'group-hover:scale-105 group-hover:opacity-90'}`}
                                    loading="lazy"
                                />

                                {/* Selection Overlay */}
                                <div className={`absolute inset-0 border-4 transition-colors duration-300 ${isSelected ? 'border-stone-900' : 'border-transparent group-hover:border-stone-200/50'}`}>
                                    <div className="absolute top-4 right-4">
                                        <div className={`w-6 h-6 rounded-full border border-white shadow-sm flex items-center justify-center transition-colors ${isSelected ? 'bg-stone-900 text-white' : 'bg-black/20 text-transparent'}`}>
                                            {isSelected && <CheckSquare size={14} className="text-white fill-white" />}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </main>

            {/* Bottom Action Bar */}
            <div className="max-w-7xl mx-auto px-6 mb-20">
                <div className="bg-white shadow-lg shadow-stone-200/20 border border-stone-200/60 rounded-xl p-4 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl">
                    <div className="text-stone-600 text-sm font-medium w-full sm:w-auto text-center sm:text-left">
                        {selectedPhotos.size > 0 ? `${selectedPhotos.size}枚の写真を選択中` : '写真を選択してダウンロード可能です'}
                    </div>

                    <div className="flex w-full sm:w-auto gap-3">
                        <button
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                            className="hidden sm:flex items-center justify-center px-4 py-3 border border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors"
                            title="ページトップへ"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                        </button>
                        <button
                            onClick={handleDownloadSelected}
                            disabled={selectedPhotos.size === 0 || isDownloading}
                            className="flex-1 sm:flex-none px-6 py-3 border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Download size={16} className={isDownloading ? "animate-bounce" : ""} />
                            {isDownloading ? "準備中..." : `選択保存 (${selectedPhotos.size})`}
                        </button>
                        <button
                            onClick={handleDownloadAll}
                            disabled={isDownloading}
                            className="flex-1 sm:flex-none px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-md"
                        >
                            <Download size={16} className={isDownloading ? "animate-bounce" : ""} />
                            {isDownloading ? "準備中..." : "一括保存"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="py-12 text-center border-t border-stone-200">
                <p className="text-xs tracking-widest text-stone-400 uppercase">
                    © {new Date().getFullYear()} Lumière Photography
                </p>
            </footer>
        </div>
    );
}
