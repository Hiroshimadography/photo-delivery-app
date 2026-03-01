"use client";

import { useState, useEffect } from "react";
import { FolderPlus, Search, MoreVertical, Eye, Download, Link as LinkIcon, Trash2, Plus } from "lucide-react";
import Link from "next/link";
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
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-serif text-stone-800 tracking-wide mb-2">Projects</h2>
                    <p className="text-stone-500">お客様の納品プロジェクト管理</p>
                </div>
                <Link
                    href="/admin/projects/new"
                    className="bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-md shadow-stone-200/50"
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

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-sm font-medium">
                                <th className="px-6 py-4">プロジェクト名 / 送信先</th>
                                <th className="px-6 py-4 text-center">ステータス</th>
                                <th className="px-6 py-4">作成日</th>
                                <th className="px-6 py-4">有効期限</th>
                                <th className="px-6 py-4 text-center">閲覧 / DL</th>
                                <th className="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {filteredProjects.map((project) => (
                                <motion.tr
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    key={project.id}
                                    className="hover:bg-stone-50 transition-colors group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-stone-900 tracking-wide">{project.name}</div>
                                        <div className="text-sm text-stone-500 font-mono mt-0.5">{project.folder_name}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${project.expires_at && new Date(project.expires_at) < new Date() ? 'bg-rose-50 text-rose-700 border border-rose-200/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                            }`}>
                                            {project.expires_at && new Date(project.expires_at) < new Date() ? '期限切れ' : '有効'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-stone-600 text-sm">
                                        {new Date(project.created_at).toLocaleDateString('ja-JP')}
                                    </td>
                                    <td className="px-6 py-4 text-stone-600 text-sm">
                                        {project.expires_at ? new Date(project.expires_at).toLocaleDateString('ja-JP') : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-4 text-stone-500 text-sm">
                                            <div className="flex items-center gap-1.5" title="閲覧回数">
                                                <Eye size={16} className="text-stone-400" />
                                                <span className="font-medium">{project.view_count}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5" title="ダウンロード回数">
                                                <Download size={16} className="text-stone-400" />
                                                <span className="font-medium">{project.download_count}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={`/admin/projects/${project.id}`}
                                            className="text-stone-400 hover:text-stone-900 p-2 inline-flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors"
                                        >
                                            <MoreVertical size={18} />
                                        </Link>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredProjects.length === 0 && (
                        <div className="p-16 text-center text-stone-500">
                            プロジェクトが見つかりませんでした。
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
