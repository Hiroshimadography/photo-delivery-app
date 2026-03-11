"use client";

import { useState, useCallback, use, useEffect, useRef } from "react";
import { ArrowLeft, UploadCloud, Image as ImageIcon, Trash2, Link as LinkIcon, Copy, Pause, Play } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

type Project = {
    id: string;
    name: string;
    folder_name: string;
    status: "active" | "expired";
    password: string | null;
    memo: string | null;
    created_at: string;
    expires_at: string | null;
    max_downloads: number;
    download_count: number;
};

type DownloadLog = {
    id: string;
    action: string;
    ip_address: string;
    created_at: string;
};

type Photo = {
    id: string;
    project_id: string;
    storage_path: string;
    url: string;
    created_at: string;
};

export default function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [project, setProject] = useState<Project | null>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [downloadLogs, setDownloadLogs] = useState<DownloadLog[]>([]);
    const [templateText, setTemplateText] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);

    const [isEditingMemo, setIsEditingMemo] = useState(false);
    const [memoInput, setMemoInput] = useState("");
    
    const [isEditingMaxDownloads, setIsEditingMaxDownloads] = useState(false);
    const [maxDownloadsInput, setMaxDownloadsInput] = useState("");

    // Upload state
    const [isDragActive, setIsDragActive] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(false);
    const [origin, setOrigin] = useState("");

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    // Initial Fetch
    useEffect(() => {
        fetchProjectData();
    }, [id]);

    const fetchProjectData = async () => {
        setIsLoading(true);
        try {
            // プロジェクト情報の取得
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', id)
                .single();

            if (projectError) throw projectError;
            setProject(projectData);
            setMemoInput(projectData.memo || "");
            setMaxDownloadsInput(projectData.max_downloads?.toString() || "5");

            // 紐づく写真一覧の取得
            const { data: photosData, error: photosError } = await supabase
                .from('photos')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: true });

            if (photosError) throw photosError;
            setPhotos(photosData || []);

            // カスタムテンプレートの取得
            const { data: templateData, error: templateError } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'delivery_template')
                .single();

            if (templateData && !templateError) {
                setTemplateText(templateData.value);
            } else {
                setTemplateText(`{{customer_name}} 様\n\n専用ページ：{{url}}\nパスワード：{{password}}`);
            }

            const { data: logsData } = await supabase
                .from('download_logs')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: false });
            setDownloadLogs(logsData || []);

        } catch (error) {
            console.error("Error fetching project data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveMemo = async () => {
        if (!project) return;
        try {
            const { error } = await supabase
                .from('projects')
                .update({ memo: memoInput })
                .eq('id', project.id);

            if (error) throw error;
            setProject({ ...project, memo: memoInput });
            setIsEditingMemo(false);
        } catch (error) {
            console.error("Error saving memo:", error);
            alert("メモの保存に失敗しました: " + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleSaveMaxDownloads = async () => {
        if (!project) return;
        try {
            const { error } = await supabase
                .from('projects')
                .update({ max_downloads: parseInt(maxDownloadsInput) })
                .eq('id', project.id);

            if (error) throw error;
            setProject({ ...project, max_downloads: parseInt(maxDownloadsInput) });
            setIsEditingMaxDownloads(false);
        } catch (error) {
            console.error("Error saving max downloads:", error);
            alert("ダウンロード上限の保存に失敗しました");
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
            const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
            setFiles(prev => [...prev, ...droppedFiles]);
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const handleUploadAll = async () => {
        if (!project || files.length === 0) return;

        setIsUploading(true);
        setIsPaused(false);
        isPausedRef.current = false;
        
        const queue = [...files];
        const concurrency = 4; // 同時アップロード数

        try {
            const processQueue = async () => {
                while (queue.length > 0) {
                    if (isPausedRef.current) break;

                    const file = queue.shift();
                    if (!file) continue;

                    const ext = file.name.split('.').pop() || 'jpg';
                    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
                    const storagePath = `${project.folder_name}/${uniqueFilename}`;

                    try {
                        const initRes = await fetch('/api/admin/upload/init', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ storagePath }),
                        });
                        if (!initRes.ok) throw new Error('Init API failed');
                        const initResult = await initRes.json();
                        const token = initResult.data?.token;
                        if (!token) throw new Error('No Signed URL Token');

                        const { error: uploadError } = await supabase.storage
                            .from('photos')
                            .uploadToSignedUrl(storagePath, token, file);
                        if (uploadError) throw new Error(uploadError.message);

                        const finRes = await fetch('/api/admin/upload/finalize', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectId: project.id, storagePath }),
                        });
                        if (!finRes.ok) throw new Error('Finalize API failed');

                        // 成功したファイルからUIリストを減らす
                        setFiles(prev => prev.filter(f => f !== file));
                    } catch (error) {
                        console.error("Upload error for file", file.name, error);
                    }
                }
            };

            const workers = [];
            for (let i = 0; i < concurrency; i++) {
                workers.push(processQueue());
            }

            await Promise.all(workers);
            await fetchProjectData();

            if (!isPausedRef.current) {
                if (files.length === 0 || queue.length === 0) {
                     alert("アップロード処理が完了いたしました。");
                }
            }
        } catch (error) {
            console.error("Upload Error:", error);
            alert("アップロード中にエラーが発生しました。");
        } finally {
            if (!isPausedRef.current) {
                setIsUploading(false);
            }
        }
    };

    const handlePause = () => {
        setIsPaused(true);
        isPausedRef.current = true;
    };

    const handleDeletePhoto = async (photoId: string, storagePath: string) => {
        if (!window.confirm("この写真を削除してもよろしいですか？")) return;

        try {
            // 1. Databaseから削除
            const { error: dbError } = await supabase
                .from('photos')
                .delete()
                .eq('id', photoId);

            if (dbError) throw dbError;

            // 2. Storageから削除
            const { error: storageError } = await supabase.storage
                .from('photos')
                .remove([storagePath]);

            if (storageError) throw storageError;

            // ローカルステートを更新
            setPhotos(photos.filter(p => p.id !== photoId));

        } catch (error) {
            console.error("Delete photo error:", error);
            alert("写真の削除に失敗しました: " + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleDeleteAllPhotos = async () => {
        if (!project || photos.length === 0) return;
        if (!window.confirm("アップロード済みのすべての写真を削除してもよろしいですか？\n※この操作は元に戻せません。")) return;

        setIsLoading(true);
        try {
            const storagePaths = photos.map(p => p.storage_path);
            const batchSize = 100;
            for (let i = 0; i < storagePaths.length; i += batchSize) {
                const batch = storagePaths.slice(i, i + batchSize);
                const { error: storageError } = await supabase.storage.from('photos').remove(batch);
                if (storageError) throw storageError;
            }

            const { error: dbError } = await supabase
                .from('photos')
                .delete()
                .eq('project_id', project.id);

            if (dbError) throw dbError;

            setPhotos([]);
            alert("すべての写真を削除しました。");
        } catch (error) {
            console.error("Delete all photos error:", error);
            alert("一括削除に失敗しました: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            fetchProjectData();
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-[50vh] text-stone-500">読み込み中...</div>;
    }

    if (!project) {
        return <div className="flex items-center justify-center min-h-[50vh] text-stone-500">プロジェクトが見つかりません。</div>;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="p-2 -ml-2 text-stone-400 hover:text-stone-900 transition-colors rounded-lg hover:bg-stone-100">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h2 className="text-3xl font-serif text-stone-800 tracking-wide">{project.name}</h2>
                        <p className="text-stone-500 mt-1 font-mono text-sm">/{project.folder_name}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Upload Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                        <h3 className="text-lg font-medium text-stone-900 mb-4">写真アップロード</h3>

                        <div
                            onDragEnter={handleDragEnter}
                            onDragOver={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${isDragActive ? "border-stone-500 bg-stone-50" : "border-stone-200 hover:border-stone-300"
                                }`}
                        >
                            <UploadCloud className={`mx-auto h-12 w-12 mb-4 ${isDragActive ? "text-stone-600" : "text-stone-400"}`} />
                            <p className="text-stone-600 font-medium mb-2">ここに写真をドラッグ＆ドロップ</p>
                            <p className="text-stone-400 text-sm mb-6">または、以下のボタンから選択してください（複数選択可JPG/PNG）</p>
                            <label className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium px-6 py-2.5 rounded-lg cursor-pointer transition-colors inline-block">
                                ファイルを選択
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                            </label>
                        </div>

                        {files.length > 0 && (
                            <div className="mt-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-medium text-stone-800">アップロード待機中 ({files.length}枚)</h4>
                                    <div className="flex gap-2">
                                        {isUploading && !isPaused && (
                                            <button
                                                onClick={handlePause}
                                                className="flex items-center gap-1 bg-stone-500 hover:bg-stone-600 text-white px-4 py-2 rounded-lg text-sm transition-colors font-medium border border-transparent shadow-sm"
                                            >
                                                <Pause size={16} />
                                                一時停止
                                            </button>
                                        )}
                                        <button
                                            onClick={handleUploadAll}
                                            disabled={isUploading && !isPaused}
                                            className="flex items-center gap-1 bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-lg text-sm transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                        >
                                            {isPaused ? <Play size={16} /> : <UploadCloud size={16} />}
                                            {isUploading && !isPaused ? `アップロード中...` : isPaused ? "再開" : "すべてアップロード"}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <AnimatePresence>
                                        {files.map((file, idx) => (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                key={`${file.name}-${idx}`}
                                                className="group relative aspect-square bg-stone-100 rounded-lg overflow-hidden border border-stone-200"
                                            >
                                                <div className="absolute inset-0 flex items-center justify-center p-4">
                                                    <ImageIcon className="text-stone-300 w-1/3 h-1/3" />
                                                </div>
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button
                                                        onClick={() => removeFile(idx)}
                                                        className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-all"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                                                    <p className="text-white text-xs truncate">{file.name}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4 text-center">
                        <h3 className="text-lg font-medium text-stone-900 border-b border-stone-100 pb-2">アップロード済み写真</h3>

                        {photos.length === 0 ? (
                            <div className="py-12 text-stone-400">まだ写真がアップロードされていません。</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-left">
                                <AnimatePresence>
                                    {photos.map((photo) => (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            key={photo.id}
                                            className="group relative aspect-square bg-stone-100 rounded-lg overflow-hidden border border-stone-200"
                                        >
                                            { }
                                            <img src={photo.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    onClick={() => handleDeletePhoto(photo.id, photo.storage_path)}
                                                    className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-all"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}

                        {photos.length > 0 && (
                            <div className="mt-8 pt-4 border-t border-stone-100 flex justify-end">
                                <button
                                    onClick={handleDeleteAllPhotos}
                                    className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Trash2 size={16} />
                                    <span>アップロード済み写真をすべて一括削除</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Project Info & Settings */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                        <h3 className="text-lg font-medium text-stone-900 mb-4 pb-2 border-b border-stone-100">配信情報</h3>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-stone-500 mb-1">公開URL</p>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={project ? `${origin || ""}/p/${project.folder_name}` : ""}
                                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 font-mono"
                                    />
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-stone-500 mb-1">パスワード</p>
                                <div className="font-mono bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 inline-block">
                                    {project.password ? project.password : <span className="text-stone-400 italic">なし</span>}
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm text-stone-500">メモ <span className="text-xs text-stone-400">（※お客様には非表示）</span></p>
                                    {!isEditingMemo && (
                                        <button
                                            onClick={() => setIsEditingMemo(true)}
                                            className="text-xs text-stone-500 hover:text-stone-900 underline"
                                        >
                                            編集
                                        </button>
                                    )}
                                </div>
                                {isEditingMemo ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={memoInput}
                                            onChange={(e) => setMemoInput(e.target.value)}
                                            className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-stone-400"
                                            placeholder="社内用メモなどを入力できます"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setIsEditingMemo(false);
                                                    setMemoInput(project.memo || "");
                                                }}
                                                className="text-xs px-3 py-1.5 text-stone-500 hover:bg-stone-100 rounded transition-colors"
                                            >
                                                キャンセル
                                            </button>
                                            <button
                                                onClick={handleSaveMemo}
                                                className="text-xs px-3 py-1.5 bg-stone-900 text-white hover:bg-stone-800 rounded shadow-sm transition-colors"
                                            >
                                                保存
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 whitespace-pre-wrap min-h-[40px]">
                                        {project.memo ? project.memo : <span className="text-stone-400 italic">なし</span>}
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className="text-sm text-stone-500 mb-1">有効期限</p>
                                <div className="text-stone-800 text-sm font-medium">
                                    {project.expires_at ? `${new Date(project.expires_at).toLocaleDateString('ja-JP')} 23:59まで` : '期限なし'}
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm text-stone-500">ダウンロード状況</p>
                                    {!isEditingMaxDownloads && (
                                        <button
                                            onClick={() => setIsEditingMaxDownloads(true)}
                                            className="text-xs text-stone-500 hover:text-stone-900 underline"
                                        >
                                            上限変更
                                        </button>
                                    )}
                                </div>
                                
                                {isEditingMaxDownloads ? (
                                    <div className="space-y-2 mt-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={maxDownloadsInput}
                                                onChange={(e) => setMaxDownloadsInput(e.target.value)}
                                                className="w-24 bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-700"
                                            />
                                            <span className="text-sm text-stone-500">回</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setIsEditingMaxDownloads(false);
                                                    setMaxDownloadsInput(project.max_downloads?.toString() || "5");
                                                }}
                                                className="text-xs px-3 py-1.5 text-stone-500 hover:bg-stone-100 rounded transition-colors"
                                            >
                                                キャンセル
                                            </button>
                                            <button
                                                onClick={handleSaveMaxDownloads}
                                                className="text-xs px-3 py-1.5 bg-stone-900 text-white hover:bg-stone-800 rounded shadow-sm transition-colors"
                                            >
                                                保存
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-stone-800 text-sm font-medium flex items-center gap-2">
                                        <span>{project.download_count} / {project.max_downloads} 回</span>
                                        {project.download_count >= project.max_downloads && (
                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">上限到達</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 pt-4 border-t border-stone-100 flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    if (project) {
                                        navigator.clipboard.writeText(`${origin}/p/${project.folder_name}`);
                                        alert("URLをコピーしました");
                                    }
                                }}
                                className="w-full flex justify-center items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors shadow-sm"
                            >
                                <LinkIcon size={16} />
                                <span>URLのみコピー</span>
                            </button>

                            <button
                                onClick={() => {
                                    const text = templateText
                                        .replace(/{{customer_name}}/g, project.name)
                                        .replace(/{{url}}/g, `${window.location.origin}/p/${project.folder_name}`)
                                        .replace(/{{password}}/g, project.password || '設定なし')
                                        .replace(/{{expiry_date}}/g, project.expires_at ? new Date(project.expires_at).toLocaleDateString('ja-JP') : '')
                                        .replace(/{{max_downloads}}/g, project.max_downloads?.toString() || '5');
                                    navigator.clipboard.writeText(text);
                                    alert('案内文をコピーしました');
                                }}
                                className="w-full flex justify-center items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-colors shadow-md shadow-stone-200/50"
                            >
                                <Copy size={16} />
                                <span>案内文をコピー</span>
                            </button>

                            <Link href="/admin/template" className="text-center text-xs text-stone-500 hover:text-stone-900 mt-2 block">
                                テンプレートを編集する
                            </Link>
                        </div>
                    </div>
                    
                    {/* Access Logs */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                        <h3 className="text-lg font-medium text-stone-900 mb-4 pb-2 border-b border-stone-100">ダウンロード履歴</h3>
                        {downloadLogs.length === 0 ? (
                            <p className="text-sm text-stone-400 text-center py-4">履歴はありません</p>
                        ) : (
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {downloadLogs.map(log => (
                                    <div key={log.id} className="text-sm border-b border-stone-100 pb-2 last:border-0 last:pb-0">
                                        <div className="flex justify-between items-center text-stone-500 mb-1">
                                            <span className="text-xs font-mono">{new Date(log.created_at).toLocaleString('ja-JP')}</span>
                                            <span className="text-xs bg-stone-100 px-2 py-0.5 rounded">{log.action === 'all' ? '一括保存' : '選択保存'}</span>
                                        </div>
                                        <div className="text-stone-800 font-mono text-xs">
                                            IP: {log.ip_address}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}
