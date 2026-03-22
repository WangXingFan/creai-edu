"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  Clock,
  ChevronRight,
  Loader2,
  Zap,
  AlertCircle,
  Inbox,
  Trash2,
  X,
} from "lucide-react";
import { formatBeijingTime } from "@/lib/datetime";

interface DebateItem {
  id: string;
  idea: string;
  status: string;
  current_round: number;
  max_rounds: number;
  created_at: string;
  final_scores: Record<string, number> | null;
}

export default function HistoryPage() {
  const [debates, setDebates] = useState<DebateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/debates")
      .then((res) => res.json())
      .then((data) => {
        setDebates(data.debates ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/debate/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDebates((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { text: string; className: string; icon: React.ReactNode }> = {
      completed: {
        text: "已完成",
        className: "text-success bg-success/8 border-success/20",
        icon: <Trophy className="h-3 w-3" />,
      },
      in_progress: {
        text: "进行中",
        className: "text-accent bg-accent/6 border-accent/15",
        icon: <Zap className="h-3 w-3" />,
      },
      pending: {
        text: "等待中",
        className: "text-text-muted bg-surface-2 border-border",
        icon: <Clock className="h-3 w-3" />,
      },
      failed: {
        text: "失败",
        className: "text-danger bg-danger/6 border-danger/15",
        icon: <AlertCircle className="h-3 w-3" />,
      },
    };
    const s = map[status] ?? map.pending;
    return (
      <span className={`badge ${s.className}`}>
        {s.icon}
        {s.text}
      </span>
    );
  };

  const getOverallScore = (scores: Record<string, number> | null) => {
    if (!scores || Object.keys(scores).length === 0) return null;
    return Math.round(
      Object.values(scores).reduce((a, b) => a + b, 0) /
        Object.values(scores).length
    );
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto relative">
      <div className="arena-bg" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-8 text-sm">
          <a
            href="/"
            className="flex items-center gap-1.5 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            首页
          </a>
          <span className="text-border-hover">/</span>
          <span className="text-text-secondary font-medium">历史记录</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-display font-extrabold text-text-primary">历史评估</h1>
          {debates.length > 0 && (
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-accent/6 text-accent font-bold border border-accent/12 font-mono tabular-nums">
              {debates.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/6 border border-accent/12 mb-4">
              <Loader2 className="h-5 w-5 text-accent animate-spin" />
            </div>
            <p className="text-text-muted text-sm">加载中...</p>
          </div>
        ) : debates.length === 0 ? (
          <div className="text-center py-20 card p-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-2 border border-border mb-4">
              <Inbox className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-text-primary text-base font-semibold mb-2">还没有评估记录</p>
            <p className="text-sm text-text-muted mb-6">提交你的第一个创业想法</p>
            <a href="/" className="inline-flex items-center gap-2 px-6 py-2.5 text-sm btn-primary cursor-pointer">
              <span>开始评估</span>
            </a>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {debates.map((debate, i) => {
                const score = getOverallScore(debate.final_scores);
                const scoreClass =
                  score !== null
                    ? score >= 70 ? "score-good" : score >= 40 ? "score-warning" : "score-critical"
                    : "text-text-muted";
                const isConfirming = confirmId === debate.id;
                const isDeleting = deletingId === debate.id;

                return (
                  <motion.div
                    key={debate.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0, transition: { duration: 0.25 } }}
                    transition={{ delay: i * 0.03 }}
                    className="group relative card px-4 py-3.5"
                  >
                    {/* Delete confirmation overlay */}
                    <AnimatePresence>
                      {isConfirming && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-10 flex items-center justify-center gap-3 rounded-2xl bg-white/95 backdrop-blur-sm border border-danger/20"
                        >
                          <span className="text-sm text-text-secondary">确认删除？</span>
                          <button
                            onClick={() => handleDelete(debate.id)}
                            disabled={isDeleting}
                            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-danger rounded-full hover:bg-red-700 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            删除
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-text-secondary bg-surface-2 rounded-full hover:bg-surface-3 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <X className="h-3 w-3" />
                            取消
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex items-center justify-between gap-3">
                      {/* Content (clickable) */}
                      <a
                        href={debate.status === "completed" ? `/report/${debate.id}` : `/debate/${debate.id}`}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <p className="text-sm text-text-primary font-medium truncate group-hover:text-accent transition-colors">
                          {debate.idea}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-text-muted">{formatBeijingTime(debate.created_at)}</span>
                          {debate.status === "in_progress" && (
                            <span className="text-[11px] text-accent font-mono tabular-nums">
                              {debate.current_round}/{debate.max_rounds}
                            </span>
                          )}
                        </div>
                      </a>

                      {/* Right side: badge + score + delete + arrow */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {getStatusBadge(debate.status)}
                        {score !== null && (
                          <span className={`text-xl font-display font-extrabold tabular-nums ${scoreClass}`}>
                            {score}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setConfirmId(debate.id);
                          }}
                          className="p-1.5 rounded-lg text-text-muted/0 group-hover:text-text-muted hover:!text-danger hover:bg-danger/6 transition-all cursor-pointer"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={debate.status === "completed" ? `/report/${debate.id}` : `/debate/${debate.id}`}
                          className="cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
