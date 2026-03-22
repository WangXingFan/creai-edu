"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  Clock,
  ChevronRight,
  Loader2,
  Zap,
  AlertCircle,
  Inbox,
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

  useEffect(() => {
    fetch("/api/debates")
      .then((res) => res.json())
      .then((data) => {
        setDebates(data.debates ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
            {debates.map((debate, i) => {
              const score = getOverallScore(debate.final_scores);
              const scoreClass =
                score !== null
                  ? score >= 70 ? "score-good" : score >= 40 ? "score-warning" : "score-critical"
                  : "text-text-muted";

              return (
                <motion.a
                  key={debate.id}
                  href={debate.status === "completed" ? `/report/${debate.id}` : `/debate/${debate.id}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group block card px-4 py-3.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
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
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {getStatusBadge(debate.status)}
                      {score !== null && (
                        <span className={`text-xl font-display font-extrabold tabular-nums ${scoreClass}`}>
                          {score}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
