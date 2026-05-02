"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardCopy,
  Inbox,
  Loader2,
  LogOut,
  Plus,
  Users,
  X,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { SkeletonCard } from "@/components/Skeleton";
import { formatBeijingTime } from "@/lib/datetime";
import {
  TeacherAuthError,
  clearTeacherToken,
  teacherFetch,
} from "@/lib/teacherAuth";

interface ClassItem {
  id: string;
  code: string;
  name: string;
  teacher_name: string;
  description: string | null;
  created_at: string;
  is_active: boolean;
  student_count: number;
  completed_count: number;
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create modal
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createTeacher, setCreateTeacher] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<ClassItem | null>(null);

  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await teacherFetch("/api/teacher/classes");
      if (!res.ok) throw new Error("加载班级列表失败");
      const data = (await res.json()) as ClassItem[];
      setClasses(data);
    } catch (e) {
      if (e instanceof TeacherAuthError) {
        router.replace("/teacher");
        return;
      }
      setError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!copyNotice) return;
    const t = window.setTimeout(() => setCopyNotice(null), 2000);
    return () => window.clearTimeout(t);
  }, [copyNotice]);

  const handleLogout = () => {
    clearTeacherToken();
    router.replace("/teacher");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createName.trim() || !createTeacher.trim()) return;
    setCreating(true);
    try {
      const res = await teacherFetch("/api/teacher/classes", {
        method: "POST",
        body: JSON.stringify({
          name: createName.trim(),
          teacher_name: createTeacher.trim(),
          description: createDesc.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setCreateError(payload?.detail ?? "创建失败，请重试");
        return;
      }
      const created = (await res.json()) as ClassItem;
      setClasses((prev) => [created, ...prev]);
      setJustCreated(created);
      setCreateName("");
      setCreateTeacher("");
      setCreateDesc("");
      setShowCreate(false);
    } catch (e) {
      if (e instanceof TeacherAuthError) {
        router.replace("/teacher");
        return;
      }
      setCreateError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyNotice(`已复制班级码 ${code}`);
    } catch {
      setCopyNotice("复制失败，请手动选取");
    }
  };

  const handleCopyJoinLink = async (code: string) => {
    try {
      const url = `${window.location.origin}/join/${code}`;
      await navigator.clipboard.writeText(url);
      setCopyNotice(`已复制学生加入链接：${url}`);
    } catch {
      setCopyNotice("复制失败，请手动选取");
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto relative">
      <div className="arena-bg" />

      <div className="relative z-10">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 mb-8">
          <a
            href="/"
            className="flex items-center gap-1.5 text-text-muted hover:text-text-secondary transition-colors cursor-pointer text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            首页
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12px] text-text-muted hover:text-text-secondary hover:border-border-hover transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              退出登录
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-display font-extrabold text-text-primary">
              我的班级
            </h1>
            <p className="text-[12px] text-text-muted mt-1">
              管理双创课堂、查看学生 BP 提交、生成班级聚合分析
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm btn-primary cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            新建班级
          </button>
        </div>

        {/* Just-created class code card */}
        <AnimatePresence>
          {justCreated && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="card p-5 mb-4 border-accent/30 bg-accent/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-text-muted mb-1">班级已创建，请保存班级码</p>
                  <p className="text-sm font-bold text-text-primary mb-3">{justCreated.name}</p>
                  <div className="inline-flex items-center gap-3 rounded-2xl border border-accent/20 bg-[var(--bg-1)] px-4 py-2.5">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted">
                      班级码
                    </span>
                    <span className="font-mono text-2xl font-extrabold text-accent tracking-[0.3em]">
                      {justCreated.code}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleCopyCode(justCreated.code)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer"
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                      复制班级码
                    </button>
                    <button
                      onClick={() => handleCopyJoinLink(justCreated.code)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer"
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                      复制学生加入链接
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setJustCreated(null)}
                  className="text-text-muted hover:text-text-secondary cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {copyNotice && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 rounded-2xl border border-success/20 bg-success/6 px-4 py-2.5 text-sm text-success"
          >
            {copyNotice}
          </motion.div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/6 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-20 card p-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-2 border border-border mb-4">
              <Inbox className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-text-primary text-base font-semibold mb-2">还没有班级</p>
            <p className="text-sm text-text-muted mb-6">
              创建你的第一个双创课堂班级，把班级码分发给学生
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm btn-primary cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              新建班级
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {classes.map((cls) => (
              <a
                key={cls.id}
                href={`/teacher/class/${cls.id}`}
                className="block card px-4 py-3.5 group cursor-pointer hover:border-accent/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                        {cls.name}
                      </p>
                      {!cls.is_active && (
                        <span className="badge text-text-muted bg-surface-2 border-border">
                          已停用
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[10px] uppercase tracking-[0.2em]">码</span>
                        <span className="font-mono font-bold text-text-secondary tracking-[0.2em]">
                          {cls.code}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {cls.student_count} 份提交 · {cls.completed_count} 份已完成
                      </span>
                      <span>{formatBeijingTime(cls.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Create modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
              onClick={() => !creating && setShowCreate(false)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="card w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-display font-bold text-text-primary">
                    新建班级
                  </h2>
                  <button
                    onClick={() => !creating && setShowCreate(false)}
                    className="text-text-muted hover:text-text-secondary cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                      班级名称 <span className="text-danger">*</span>
                    </label>
                    <input
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="如「2024秋·创新创业基础·1班」"
                      maxLength={128}
                      autoFocus
                      className="w-full px-4 py-3 bg-[var(--bg-1)] rounded-xl text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 border border-border"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                      任课教师 <span className="text-danger">*</span>
                    </label>
                    <input
                      value={createTeacher}
                      onChange={(e) => setCreateTeacher(e.target.value)}
                      placeholder="姓名"
                      maxLength={64}
                      className="w-full px-4 py-3 bg-[var(--bg-1)] rounded-xl text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 border border-border"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                      简介 <span className="text-text-muted">（可选）</span>
                    </label>
                    <textarea
                      value={createDesc}
                      onChange={(e) => setCreateDesc(e.target.value)}
                      placeholder="班级描述、教学目标等"
                      maxLength={500}
                      rows={3}
                      className="w-full px-4 py-3 bg-[var(--bg-1)] rounded-xl text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 border border-border resize-none"
                    />
                  </div>

                  {createError && (
                    <div className="rounded-xl border border-danger/20 bg-danger/[0.04] px-3 py-2.5 text-[12px] text-danger">
                      {createError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => !creating && setShowCreate(false)}
                      className="flex-1 py-2.5 px-4 text-sm btn-secondary cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={!createName.trim() || !createTeacher.trim() || creating}
                      className="flex-1 py-2.5 px-4 text-sm btn-primary flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {creating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          创建
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
