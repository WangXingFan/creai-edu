"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ClipboardCopy,
  Inbox,
  Loader2,
  Lightbulb,
  Power,
  PowerOff,
  Trash2,
  Users,
  X,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { SkeletonCard } from "@/components/Skeleton";
import { formatBeijingTime } from "@/lib/datetime";
import { getDimensionLabel } from "@/lib/dimensions";
import {
  TeacherAuthError,
  teacherFetch,
} from "@/lib/teacherAuth";

interface Submission {
  id: string;
  idea: string;
  status: string;
  current_round: number;
  max_rounds: number;
  created_at: string;
  completed_at: string | null;
  final_scores: Record<string, number> | null;
  student_name: string | null;
  student_id_masked: string | null;
}

interface ClassDetail {
  id: string;
  code: string;
  name: string;
  teacher_name: string;
  description: string | null;
  created_at: string;
  is_active: boolean;
  student_count: number;
  completed_count: number;
  submissions: Submission[];
}

interface ClassSummary {
  class_id: string;
  class_name: string;
  total_submissions: number;
  completed_submissions: number;
  avg_dimension_scores: Record<string, number>;
  score_distribution: Record<string, number>;
  common_risks: { risk: string; count: number }[];
  top_improvements: { improvement: string; count: number }[];
}

const DISTRIBUTION_ORDER = ["<60", "60-69", "70-79", "80-89", "90+"] as const;

const DISTRIBUTION_COLORS: Record<string, string> = {
  "<60": "#DC2626",
  "60-69": "#F97316",
  "70-79": "#D97706",
  "80-89": "#0891B2",
  "90+": "#059669",
};

function getOverallScore(scores: Record<string, number> | null): number | null {
  if (!scores || Object.keys(scores).length === 0) return null;
  const vals = Object.values(scores);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export default function ClassDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const classId = params?.id ?? "";

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const [detailRes, summaryRes] = await Promise.all([
        teacherFetch(`/api/teacher/classes/${classId}`),
        teacherFetch(`/api/teacher/classes/${classId}/summary`),
      ]);
      if (!detailRes.ok) {
        throw new Error(
          detailRes.status === 404 ? "班级不存在" : "加载班级详情失败",
        );
      }
      const detailData = (await detailRes.json()) as ClassDetail;
      setDetail(detailData);

      if (summaryRes.ok) {
        const summaryData = (await summaryRes.json()) as ClassSummary;
        setSummary(summaryData);
      }
    } catch (e) {
      if (e instanceof TeacherAuthError) {
        router.replace("/teacher");
        return;
      }
      setError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [classId, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!copyNotice) return;
    const t = window.setTimeout(() => setCopyNotice(null), 2000);
    return () => window.clearTimeout(t);
  }, [copyNotice]);

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
      setCopyNotice(`已复制学生加入链接`);
    } catch {
      setCopyNotice("复制失败，请手动选取");
    }
  };

  const handleToggleActive = async () => {
    if (!detail) return;
    setActing("toggle");
    try {
      const res = await teacherFetch(`/api/teacher/classes/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !detail.is_active }),
      });
      if (!res.ok) throw new Error("更新失败");
      await refresh();
    } catch (e) {
      if (e instanceof TeacherAuthError) {
        router.replace("/teacher");
        return;
      }
      setError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    setActing("delete");
    try {
      const res = await teacherFetch(`/api/teacher/classes/${detail.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      router.replace("/teacher/dashboard");
    } catch (e) {
      if (e instanceof TeacherAuthError) {
        router.replace("/teacher");
        return;
      }
      setError(e instanceof Error ? e.message : "未知错误");
      setActing(null);
    }
  };

  const submissions = detail?.submissions ?? [];
  const sortedDimensions = summary
    ? Object.keys(summary.avg_dimension_scores).sort()
    : [];

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto relative">
      <div className="arena-bg" />

      <div className="relative z-10">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 mb-8">
          <a
            href="/teacher/dashboard"
            className="flex items-center gap-1.5 text-text-muted hover:text-text-secondary transition-colors cursor-pointer text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            班级列表
          </a>
          <ThemeToggle />
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/6 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

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

        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : detail ? (
          <>
            {/* Class header */}
            <div className="card p-5 mb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h1 className="text-lg font-display font-extrabold text-text-primary">
                      {detail.name}
                    </h1>
                    {!detail.is_active && (
                      <span className="badge text-text-muted bg-surface-2 border-border">
                        已停用
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-text-muted">
                    任课教师：{detail.teacher_name} · 创建于 {formatBeijingTime(detail.created_at)}
                  </p>
                  {detail.description && (
                    <p className="mt-2 text-[13px] text-text-secondary leading-6">
                      {detail.description}
                    </p>
                  )}
                </div>

                <div className="inline-flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/[0.04] px-4 py-2.5 shrink-0">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted">
                    班级码
                  </span>
                  <span className="font-mono text-xl font-extrabold text-accent tracking-[0.3em]">
                    {detail.code}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleCopyCode(detail.code)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  复制班级码
                </button>
                <button
                  onClick={() => handleCopyJoinLink(detail.code)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  复制学生加入链接
                </button>
                <button
                  onClick={handleToggleActive}
                  disabled={acting === "toggle"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer"
                >
                  {acting === "toggle" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : detail.is_active ? (
                    <PowerOff className="h-3.5 w-3.5" />
                  ) : (
                    <Power className="h-3.5 w-3.5" />
                  )}
                  {detail.is_active ? "停用班级" : "启用班级"}
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-danger/20 bg-danger/[0.04] px-3 py-1.5 text-[12px] text-danger hover:bg-danger/[0.08] transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除班级
                </button>
              </div>
            </div>

            {/* Summary card */}
            {summary && (
              <div className="card p-5 mb-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-base font-display font-bold text-text-primary">
                    班级聚合分析
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent border border-accent/15">
                    AI 生成
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5">
                    <p className="text-[11px] text-text-muted mb-1">总提交</p>
                    <p className="text-xl font-display font-extrabold text-text-primary tabular-nums">
                      {summary.total_submissions}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5">
                    <p className="text-[11px] text-text-muted mb-1">已完成</p>
                    <p className="text-xl font-display font-extrabold text-success tabular-nums">
                      {summary.completed_submissions}
                    </p>
                  </div>
                  {sortedDimensions.slice(0, 2).map((dim) => (
                    <div
                      key={dim}
                      className="rounded-xl border border-border bg-surface-2 px-3 py-2.5"
                    >
                      <p className="text-[11px] text-text-muted mb-1">
                        {getDimensionLabel(dim)} 均分
                      </p>
                      <p className="text-xl font-display font-extrabold text-text-primary tabular-nums">
                        {summary.avg_dimension_scores[dim]?.toFixed(1) ?? "—"}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Score distribution */}
                {Object.values(summary.score_distribution).some((v) => v > 0) && (
                  <div className="mb-5">
                    <p className="text-[12px] font-medium text-text-secondary mb-2">
                      综合分数分布
                    </p>
                    <div className="space-y-1.5">
                      {DISTRIBUTION_ORDER.map((bucket) => {
                        const count = summary.score_distribution[bucket] ?? 0;
                        const max = Math.max(
                          ...Object.values(summary.score_distribution),
                        );
                        const pct = max > 0 ? (count / max) * 100 : 0;
                        return (
                          <div key={bucket} className="flex items-center gap-2">
                            <span className="text-[11px] text-text-muted w-12 text-right shrink-0 font-mono">
                              {bucket}
                            </span>
                            <div className="flex-1 progress-track">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: DISTRIBUTION_COLORS[bucket],
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-bold font-mono tabular-nums w-6 text-text-secondary">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Dimension averages */}
                {sortedDimensions.length > 0 && (
                  <div className="mb-5">
                    <p className="text-[12px] font-medium text-text-secondary mb-2">
                      六维均分
                    </p>
                    <div className="space-y-1.5">
                      {sortedDimensions.map((dim) => {
                        const score = summary.avg_dimension_scores[dim] ?? 0;
                        const color =
                          score >= 70
                            ? "#059669"
                            : score >= 40
                              ? "#D97706"
                              : "#DC2626";
                        return (
                          <div key={dim} className="flex items-center gap-2">
                            <span className="text-[11px] text-text-muted w-16 text-right shrink-0">
                              {getDimensionLabel(dim)}
                            </span>
                            <div className="flex-1 progress-track">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${Math.max(0, Math.min(100, score))}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                            <span
                              className="text-[11px] font-bold font-mono tabular-nums w-8"
                              style={{ color }}
                            >
                              {score.toFixed(1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Common risks & top improvements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {summary.common_risks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertCircle className="h-3.5 w-3.5 text-danger" />
                        <p className="text-[12px] font-medium text-text-secondary">
                          高频共性风险
                        </p>
                      </div>
                      <ul className="space-y-1.5">
                        {summary.common_risks.slice(0, 5).map((r, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-[13px] text-text-secondary leading-6"
                          >
                            <span className="text-[10px] font-mono text-text-muted shrink-0 mt-1.5">
                              ×{r.count}
                            </span>
                            <span className="min-w-0">{r.risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.top_improvements.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Lightbulb className="h-3.5 w-3.5 text-accent" />
                        <p className="text-[12px] font-medium text-text-secondary">
                          高频改进建议
                        </p>
                      </div>
                      <ul className="space-y-1.5">
                        {summary.top_improvements.slice(0, 5).map((imp, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-[13px] text-text-secondary leading-6"
                          >
                            <span className="text-[10px] font-mono text-text-muted shrink-0 mt-1.5">
                              ×{imp.count}
                            </span>
                            <span className="min-w-0">{imp.improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {summary.completed_submissions === 0 && (
                  <p className="text-[12px] text-text-muted leading-relaxed mt-3 pt-3 border-t border-border">
                    暂无已完成评估。等学生提交并完成 AI 答辩后，本面板会自动汇总六维均分、共性风险与高频改进建议。
                  </p>
                )}
              </div>
            )}

            {/* Submissions list */}
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-text-secondary" />
              <h2 className="text-base font-display font-bold text-text-primary">
                学生提交
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/6 text-accent font-bold border border-accent/12 font-mono tabular-nums">
                {submissions.length}
              </span>
            </div>

            {submissions.length === 0 ? (
              <div className="text-center py-12 card p-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-2 border border-border mb-3">
                  <Inbox className="h-5 w-5 text-text-muted" />
                </div>
                <p className="text-text-primary text-sm font-semibold mb-1">
                  暂无学生提交
                </p>
                <p className="text-[12px] text-text-muted">
                  把班级码 <span className="font-mono font-bold text-accent">{detail.code}</span> 或加入链接发给学生即可
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.map((s) => {
                  const score = getOverallScore(s.final_scores);
                  const scoreClass =
                    score !== null
                      ? score >= 70
                        ? "score-good"
                        : score >= 40
                          ? "score-warning"
                          : "score-critical"
                      : "text-text-muted";
                  const target =
                    s.status === "completed"
                      ? `/report/${s.id}`
                      : `/debate/${s.id}`;
                  return (
                    <a
                      key={s.id}
                      href={target}
                      className="block card px-4 py-3 group cursor-pointer hover:border-accent/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                            {s.idea}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                            {(s.student_name || s.student_id_masked) && (
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {s.student_name || "—"}
                                {s.student_id_masked
                                  ? ` · ${s.student_id_masked}`
                                  : ""}
                              </span>
                            )}
                            <span>{formatBeijingTime(s.created_at)}</span>
                            {s.status !== "completed" && (
                              <span className="text-accent font-mono">
                                {s.status} · {s.current_round}/{s.max_rounds}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {score !== null && (
                            <span
                              className={`text-lg font-display font-extrabold tabular-nums ${scoreClass}`}
                            >
                              {score}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        ) : null}

        {/* Delete confirm modal */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
              onClick={() => acting !== "delete" && setConfirmDelete(false)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="card w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-display font-bold text-text-primary">
                    确认删除班级？
                  </h2>
                  <button
                    onClick={() => acting !== "delete" && setConfirmDelete(false)}
                    className="text-text-muted hover:text-text-secondary cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[13px] text-text-secondary leading-6 mb-5">
                  删除后班级码立即失效，学生将无法继续以该班级码加入。
                  <br />
                  本班 <span className="font-bold text-text-primary">{detail?.student_count ?? 0}</span> 份学生提交将被解绑（保留在历史中，但不再归属任何班级）。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => acting !== "delete" && setConfirmDelete(false)}
                    className="flex-1 py-2.5 px-4 text-sm btn-secondary cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={acting === "delete"}
                    className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-danger rounded-full hover:bg-red-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {acting === "delete" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    确认删除
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
