"use client";

import { useState, useEffect } from "react";
import { FolderPlus, Search, Eye, Download, Link as LinkIcon, Trash2, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

type Project = {
    id: string;
    name: string;
    folder_name: string;
    status: "active" | "expired";
    created_at: string;
    expires_at: string | null;
    view_count: number;
    download_count: number;
};

export default function AdminDashboard() {
    const [searchQuery, setSearchQuery] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching projects:", error);
                // 仮対応: エラー時は空配列かモックを表示するフォールバック処理を入れることも可
            } else {
                setProjects(data as Project[] || []);
            }
        } catch (error) {
            console.error("Unexpected error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`${name} のプロジェクトを削除してもよろしいですか？\n※この操作は取り消せません`)) {
            // Delete from Supabase
            const { error } = await supabase.from('projects').delete().eq('id', id);

            if (error) {
                alert("削除に失敗しました: " + error.message);
            } else {
                // Remove from state
                setProjects(projects.filter(p => p.id !== id));
            }
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.folder_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-serif text-stone-800 tracking-wide mb-1 md:mb-2">Projects</h2>
                    <p className="text-sm md:text-base text-stone-500">お客様の納品プロジェクト管理</p>
                </div>
                <Link
                    href="/admin/projects/new"
                    className="bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium shadow-md shadow-stone-200/50 w-full md:w-auto"
                >
                    <Plus size={20} />
                    <span>新規作成</span>
                </Link>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="p-4 border-b border-stone-200 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input
                            type="text"
                            placeholder="プロジェクト名やフォルダ名で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all"
                        />
                    </div>
                </div>

                <div className="p-6">
                    {filteredProjects.length === 0 ? (
                        <div className="text-center text-stone-500 py-12">
                            プロジェクトが見つかりませんでした。
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredProjects.map((project) => {
                                const router = useRouter();
                                return (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        key={project.id}
                                        onClick={() => router.push(`/admin/projects/${project.id}`)}
                                        className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col hover:shadow-lg hover:border-stone-300 transition-all relative group cursor-pointer"
                                    >
                                        {/* Status Badge */}
                                        <div className="absolute top-5 right-5">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${project.expires_at && new Date(project.expires_at) < new Date() ? 'bg-rose-50 text-rose-700 border border-rose-200/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'}`}>
                                                {project.expires_at && new Date(project.expires_at) < new Date() ? '期限切れ' : '有効'}
                                            </span>
                                        </div>

                                        {/* Header Info */}
                                        <div className="pr-20 mb-4">
                                            <h3 className="font-medium text-lg text-stone-900 tracking-wide mb-1 leading-tight line-clamp-2 group-hover:text-stone-700 transition-colors">
                                                {project.name}
                                            </h3>
                                            <div className="text-sm text-stone-500 font-mono bg-stone-50 px-2 py-1 rounded inline-block">
                                                {project.folder_name}
                                            </div>
                                        </div>

                                        {/* Dates */}
                                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-stone-600 bg-stone-50 p-3 rounded-lg group-hover:bg-stone-100/50 transition-colors">
                                            <div>
                                                <span className="block text-stone-400 text-xs mb-0.5">作成日</span>
                                                {new Date(project.created_at).toLocaleDateString('ja-JP')}
                                            </div>
                                            <div>
                                                <span className="block text-stone-400 text-xs mb-0.5">有効期限</span>
                                                {project.expires_at ? new Date(project.expires_at).toLocaleDateString('ja-JP') : '-'}
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-4 border-t border-stone-100 flex items-center justify-between">
                                            {/* Stats */}
                                            <div className="flex items-center gap-4 text-stone-500 text-sm">
                                                <div className="flex items-center gap-1.5" title="閲覧回数">
                                                    <Eye size={16} className="text-stone-400" />
                                                    <span className="font-medium">{project.view_count}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5" title="ダウンロード回数">
                                                    <Download size={16} className="text-stone-400" />
                                                    <span className="font-medium">{project.download_count}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(project.id, project.name);
                                                    }}
                                                    className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
                                                    title="削除"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                                <div className="p-2 text-stone-300 group-hover:text-stone-900 transition-colors">
                                                    <ChevronRight size={18} />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
