"use client";

import { useState, use, useEffect } from "react";
import { Download, ChevronRight, Trash2, X, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

type Project = {
    id: string;
    name: string;
    folder_name: string;
    hasPassword?: boolean;
    expires_at?: string | null;
    status?: string;
};

type Photo = {
    id: string;
    url: string;
    thumbUrl?: string;
};

type BrandSettings = {
    brand_name: string;
    logo_url: string | null;
};

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: folder_name } = use(params);

    const [project, setProject] = useState<Project | null>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [settings, setSettings] = useState<BrandSettings | null>({ brand_name: "Hiroshimadography", logo_url: null });
    const [isLoading, setIsLoading] = useState(true); // 初期ロード中はローディング表示
    const [initialLoading, setInitialLoading] = useState(true); // 初回データ取得中フラグ

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [error, setError] = useState(false);

    useEffect(() => {
        fetchProjectData();

    }, [folder_name]);

    const fetchProjectData = async () => {
        setIsLoading(true);
        try {
            // 1. プロジェクト取得 (API経由)
            const res = await fetch(`/api/delivery/${folder_name}`);
            const data = await res.json();

            if (!data.success || !data.project) {
                console.error("Project not found");
                setIsLoading(false);
                return;
            }
            setProject(data.project);

            // パスワードなしの場合はTOPページにボタンを表示（自動認証しない）

            // 3. ブランド設定の反映
            if (data.settings && data.settings.brand_name) {
                setSettings({
                    brand_name: data.settings.brand_name,
                    logo_url: data.settings.logo_url
                });
            } else {
                setSettings({ brand_name: "Hiroshimadography", logo_url: null });
            }

        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
            setInitialLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await fetch(`/api/delivery/${folder_name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: passwordInput })
            });
            const data = await res.json();

            if (data.success) {
                setPhotos(data.photos);
                setIsAuthenticated(true);
                setError(false);
            } else {
                setError(true);
            }
        } catch (err) {
            console.error(err);
            setError(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEnterWithoutPassword = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/delivery/${folder_name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: '' })
            });
            const data = await res.json();
            if (data.success) {
                setPhotos(data.photos);
                setIsAuthenticated(true);
            }
        } catch (err) {
            console.error('Enter failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadStatus, setDownloadStatus] = useState<'preparing' | 'downloading'>('preparing');

    // Blob + <a> タグによるダウンロード（iOS Safari でファイルアプリに確実に保存される）
    const triggerBlobDownload = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        // iOS Safariではクリック後すぐにrevokeするとダウンロードが失敗するため遅延
        setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 5000);
    };

    // サーバーサイドでZIPを生成 → Blobダウンロード（iOS Safari完全対応）
    const downloadAll = async () => {
        setIsDownloading(true);
        setDownloadProgress(0);
        setDownloadStatus('preparing');
        try {
            setDownloadProgress(10);

            // サーバーにZIP生成をリクエスト
            const res = await fetch(`/api/delivery/${folder_name}/download-zip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'all' })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                alert(data?.message || 'ダウンロード中にエラーが発生しました。');
                return;
            }

            setDownloadProgress(50);
            setDownloadStatus('downloading');

            const zipFilename = `${folder_name}_all.zip`;

            // 署名付きURLからBlobとしてダウンロード → ファイルアプリに確実に保存
            try {
                const zipRes = await fetch(data.downloadUrl);
                if (!zipRes.ok) throw new Error('Download failed');

                const contentLength = zipRes.headers.get('Content-Length');
                const total = contentLength ? parseInt(contentLength, 10) : 0;

                // ReadableStreamが使える場合はプログレス追跡
                if (zipRes.body && total > 0) {
                    const reader = zipRes.body.getReader();
                    const chunks: Uint8Array[] = [];
                    let received = 0;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                        received += value.length;
                        // 50-95%の範囲でダウンロード進捗を表示
                        setDownloadProgress(50 + Math.floor((received / total) * 45));
                    }

                    const blob = new Blob(chunks as any, { type: 'application/zip' });
                    triggerBlobDownload(blob, zipFilename);
                } else {
                    // フォールバック: ReadableStream非対応 or Content-Length不明
                    const blob = await zipRes.blob();
                    triggerBlobDownload(blob, zipFilename);
                }

                setDownloadProgress(100);
            } catch (blobError) {
                // CORS等でfetchできない場合は<a>タグで直接ダウンロード（フォールバック）
                console.warn('Blob download failed, falling back to link download:', blobError);
                const a = document.createElement('a');
                a.href = data.downloadUrl;
                a.download = zipFilename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => document.body.removeChild(a), 1000);
                setDownloadProgress(100);
            }

        } catch (err) {
            console.error(err);
            alert("ダウンロード中にエラーが発生しました。");
        } finally {
            setTimeout(() => {
                setIsDownloading(false);
                setDownloadProgress(0);
                setDownloadStatus('preparing');
            }, 3000);
        }
    };

    const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);

    // 個別写真ダウンロード（JPEG/PNGを直接保存）
    const handleDownloadSingle = async (photoId: string, index: number) => {
        if (downloadingPhotoId) return;
        setDownloadingPhotoId(photoId);
        try {
            const res = await fetch(`/api/delivery/${folder_name}/download-single`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoId })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                alert(data?.message || 'ダウンロード中にエラーが発生しました。');
                return;
            }

            const filename = data.filename || `photo_${String(index + 1).padStart(3, '0')}.jpg`;

            try {
                const photoRes = await fetch(data.downloadUrl);
                if (!photoRes.ok) throw new Error('Download failed');
                const blob = await photoRes.blob();
                triggerBlobDownload(blob, filename);
            } catch {
                // CORS等でfetch失敗時は<a>タグで直接ダウンロード
                const a = document.createElement('a');
                a.href = data.downloadUrl;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => document.body.removeChild(a), 1000);
            }
        } catch (err) {
            console.error(err);
            alert('ダウンロード中にエラーが発生しました。');
        } finally {
            setDownloadingPhotoId(null);
        }
    };

    const handleDownloadAll = async () => {
        await downloadAll();
    };

    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [savedPhotoIds, setSavedPhotoIds] = useState<Set<string>>(new Set());

    // 長押し（コンテキストメニュー）で保存された写真をマーク（2秒遅延）
    const markPhotoAsSaved = (photoId: string) => {
        setTimeout(() => {
            setSavedPhotoIds(prev => {
                if (prev.has(photoId)) return prev;
                const next = new Set(prev);
                next.add(photoId);
                return next;
            });
        }, 2000);
    };

    const handlePrevPhoto = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (lightboxIndex !== null && lightboxIndex > 0) {
            setLightboxIndex(lightboxIndex - 1);
        }
    };

    const handleNextPhoto = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (lightboxIndex !== null && lightboxIndex < photos.length - 1) {
            setLightboxIndex(lightboxIndex + 1);
        }
    };

    // 背景スクロールロック
    useEffect(() => {
        if (lightboxIndex !== null) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [lightboxIndex]);

    const handleDeleteData = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/delivery/${folder_name}/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                alert(data?.message || 'データの削除中にエラーが発生しました。');
                return;
            }
            setIsDeleted(true);
            setShowDeleteConfirm(false);
        } catch (err) {
            console.error(err);
            alert('データの削除中にエラーが発生しました。');
        } finally {
            setIsDeleting(false);
        }
    };

    // 初期ロード中はローディング表示
    if (initialLoading) {
        return (
            <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                >
                    {settings?.logo_url ? (
                        <img src={settings.logo_url} alt={settings.brand_name} className="max-h-12 mx-auto mb-8 object-contain" />
                    ) : (
                        <h1 className="text-sm tracking-[0.3em] text-stone-400 mb-8 font-medium">{settings?.brand_name || "Hiroshimadography"}</h1>
                    )}
                    <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin mx-auto" />
                </motion.div>
            </div>
        );
    }

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
                    {settings?.logo_url ? (
                        <img src={settings.logo_url} alt={settings.brand_name} className="max-h-12 mx-auto mb-8 object-contain" />
                    ) : (
                        <h1 className="text-sm tracking-[0.3em] text-stone-400 mb-8 font-medium">{settings?.brand_name || "Hiroshimadography"}</h1>
                    )}

                    <h2 className="text-3xl font-serif text-stone-800 tracking-widest mb-2 leading-relaxed">
                        {project ? project.name : ""}
                    </h2>
                    <div className="w-12 h-px bg-stone-300 mx-auto my-6" />

                    {project?.hasPassword ? (
                        <>
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
                        </>
                    ) : (
                        <>
                            <p className="text-stone-500 mb-8 font-serif leading-loose text-sm">
                                お写真の閲覧・ダウンロードが<br />可能です
                            </p>

                            <button
                                onClick={handleEnterWithoutPassword}
                                disabled={isLoading}
                                className="w-full bg-stone-900 hover:bg-stone-800 text-white tracking-widest py-4 transition-colors text-sm flex items-center justify-center gap-2 group disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>写真はこちら</span>
                                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFCFB]">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#FDFCFB]/90 backdrop-blur-md border-b border-stone-200/50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    {settings?.logo_url ? (
                        <img src={settings.logo_url} alt={settings.brand_name} className="max-h-8 object-contain" />
                    ) : (
                        <div className="text-sm tracking-[0.2em] text-stone-900 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                            {settings?.brand_name || ""}
                        </div>
                    )}
                    <div className="text-stone-500 font-serif tracking-widest text-sm hidden md:block">
                        {project ? project.name : ""}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-12 md:py-20 relative">
                
                {/* Full Screen Loading Overlay for Download */}
                <AnimatePresence>
                    {isDownloading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md"
                        >
                            <div className="bg-white p-10 rounded-2xl shadow-2xl border border-stone-200 flex flex-col items-center text-center max-w-sm w-full mx-4">
                                <div className="w-16 h-16 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin mb-8" />
                                <h3 className="text-xl font-medium text-stone-800 mb-2 font-serif tracking-wider">
                                    {downloadStatus === 'preparing' ? 'データ準備中' : 'ダウンロード中'}
                                </h3>
                                <p className="text-stone-500 mb-6 text-sm">
                                    {downloadStatus === 'preparing' ? '写真のデータをまとめています...' : 'ファイルを保存しています...'}
                                </p>
                                
                                <div className="w-full bg-stone-100 rounded-full h-2.5 mb-2 overflow-hidden">
                                    <div 
                                        className="bg-stone-800 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                        style={{ width: `${downloadProgress}%` }}
                                    ></div>
                                </div>
                                <p className="text-stone-800 font-medium tracking-widest">{downloadProgress}%</p>
                                
                                <p className="mt-8 text-sm text-red-500 font-medium">※この画面を閉じたり、<br/>再読込しないでください</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
                <div className="sticky top-24 z-30 bg-white shadow-lg shadow-stone-200/20 border border-stone-200/60 rounded-xl p-4 md:p-5 mb-12 flex flex-col items-center justify-center gap-1.5 backdrop-blur-xl text-center">
                    <span className="text-stone-800 font-bold text-base md:text-lg w-full">
                        <span className="text-green-700">【保存方法】</span>
                        iPhone・Androidの方は写真をタップして拡大後、画像を長押しで１枚ずつ直接保存できます
                    </span>
                    <span className="text-stone-500 text-xs md:text-sm font-medium">※PC等からの一括保存（ZIP）はページ最下部のボタンをご利用ください</span>
                </div>

                {/* Gallery Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
                    {photos.map((photo, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            key={photo.id}
                            className="group relative aspect-[4/5] overflow-hidden bg-stone-100 cursor-pointer"
                            onClick={() => setLightboxIndex(i)}
                        >
                            <img
                                src={photo.thumbUrl || photo.url}
                                alt=""
                                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:opacity-90"
                                loading="lazy"
                                onError={(e) => {
                                    if (photo.url && e.currentTarget.src !== photo.url) {
                                        e.currentTarget.src = photo.url;
                                    }
                                }}
                            />

                            {savedPhotoIds.has(photo.id) && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-green-600/95 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg tracking-wider flex items-center gap-1.5 backdrop-blur-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                        保存済
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </main>

            {/* Lightbox Overlay */}
            <AnimatePresence>
                {lightboxIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
                        onClick={() => setLightboxIndex(null)}
                    >
                        {/* Close Button */}
                        <button 
                            className="absolute top-4 right-4 md:top-8 md:right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-20"
                            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
                        >
                            <X size={24} />
                        </button>
                        
                        {/* Instruction for Mobile */}
                        <div className="absolute top-4 left-0 right-0 mx-auto w-max max-w-[90%] md:top-8 bg-black/80 border border-white/20 text-white px-5 py-4 rounded-2xl backdrop-blur-md z-20 shadow-2xl text-center break-words">
                            <span className="font-bold text-green-400 block mb-2 text-sm md:text-base">【画像を直接保存できます】</span>
                            画像を<b className="text-white text-lg md:text-xl border-b-2 border-white mx-1">長押し</b>して<br className="md:hidden"/>「写真に追加」または<br className="md:hidden"/>「画像を保存（ダウンロード）」を<br className="md:hidden"/>選択してください
                        </div>

                        {/* Navigation Prev */}
                        {lightboxIndex > 0 && (
                            <button 
                                className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-20"
                                onClick={handlePrevPhoto}
                            >
                                <ChevronLeft size={32} />
                            </button>
                        )}

                        {/* Navigation Next */}
                        {lightboxIndex < photos.length - 1 && (
                            <button 
                                className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-20"
                                onClick={handleNextPhoto}
                            >
                                <ChevronRight size={32} />
                            </button>
                        )}

                        {/* Image Container */}
                        <motion.div
                            key={lightboxIndex}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="w-full h-full p-4 pt-32 md:p-12 flex items-center justify-center cursor-grab active:cursor-grabbing"
                            onClick={(e) => e.stopPropagation()}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.5}
                            onDragEnd={(e, { offset }) => {
                                if (offset.x > 50) {
                                    handlePrevPhoto();
                                } else if (offset.x < -50) {
                                    handleNextPhoto();
                                }
                            }}
                        >
                            <img
                                src={photos[lightboxIndex].url}
                                alt={`Photo ${lightboxIndex + 1}`}
                                className="max-w-full max-h-full object-contain rounded-sm shadow-2xl"
                                onContextMenu={() => markPhotoAsSaved(photos[lightboxIndex].id)}
                            />
                        </motion.div>
                        
                        {savedPhotoIds.has(photos[lightboxIndex].id) && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                                <div className="flex items-center gap-2 bg-green-600/95 text-white text-lg font-bold px-6 py-3 rounded-full shadow-2xl backdrop-blur-sm tracking-wider">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                    保存済
                                </div>
                            </div>
                        )}

                        <div className="absolute bottom-6 left-0 right-0 text-center text-white/50 text-sm font-medium tracking-widest z-20">
                            {lightboxIndex + 1} / {photos.length}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Action Bar */}
            <div className="max-w-7xl mx-auto px-6 mb-20">
                <div className="bg-white shadow-lg shadow-stone-200/20 border border-stone-200/60 rounded-xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-xl text-center md:text-left">
                    <div className="text-stone-600 text-sm font-medium">
                        PC環境の方やZIPファイルでの保存をご希望の場合は<br className="md:hidden"/>一括保存をご利用ください
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
                            onClick={handleDownloadAll}
                            disabled={isDownloading}
                            className="flex-1 sm:flex-none px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-md whitespace-nowrap"
                        >
                            <Download size={16} className={isDownloading ? "animate-bounce" : ""} />
                            {isDownloading ? "準備中..." : "一括保存 (ZIP / PC推奨)"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Deletion Section */}
            <div className="max-w-7xl mx-auto px-6 mb-20">
                <div className="border border-stone-200 rounded-xl p-6 md:p-8">
                    <div className="text-center max-w-lg mx-auto">
                        {isDeleted ? (
                            <div className="space-y-3">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M20 6 9 17l-5-5"/></svg>
                                </div>
                                <h3 className="text-lg font-medium text-stone-800 font-serif">データを削除しました</h3>
                                <p className="text-stone-500 text-sm leading-relaxed">
                                    このURL上の写真データはすべて削除されました。<br />
                                    既にダウンロード済みのデータには影響ありません。
                                </p>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-sm font-medium text-stone-500 mb-3">写真データの削除について</h3>
                                <p className="text-stone-400 text-xs leading-relaxed mb-6">
                                    ダウンロードがお済みの場合、このURL上に保存されている写真データを削除できます。<br />
                                    <span className="text-stone-500 font-medium">※既にダウンロードしたお手元に保存された写真は削除されません。</span><br />
                                    このURLからの閲覧・ダウンロードができなくなります。
                                </p>

                                {showDeleteConfirm ? (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-4">
                                        <p className="text-red-700 text-sm font-medium">
                                            本当にこのURL上の写真データを削除しますか？<br />
                                            この操作は取り消せません。
                                        </p>
                                        <div className="flex justify-center gap-3">
                                            <button
                                                onClick={() => setShowDeleteConfirm(false)}
                                                disabled={isDeleting}
                                                className="px-5 py-2 text-sm text-stone-600 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
                                            >
                                                キャンセル
                                            </button>
                                            <button
                                                onClick={handleDeleteData}
                                                disabled={isDeleting}
                                                className="px-5 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {isDeleting ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        削除中...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Trash2 size={14} />
                                                        削除する
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="text-stone-400 hover:text-red-500 text-xs underline underline-offset-2 transition-colors"
                                    >
                                        このURL上の写真データを削除する
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="py-12 text-center border-t border-stone-200">
                <p className="text-xs tracking-widest text-stone-400 uppercase">
                    © {new Date().getFullYear()} {settings?.brand_name || ""}
                </p>
            </footer>
        </div>
    );
}
