"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  Lightbulb,
  Quote,
  FileText,
  Download,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import RadarChart from "@/components/RadarChart";
import { formatBeijingTime } from "@/lib/datetime";
import { getDimensionLabel } from "@/lib/dimensions";
import { SkeletonReport } from "@/components/Skeleton";
import ThemeToggle from "@/components/ThemeToggle";
import ShareButton from "@/components/ShareButton";

interface Report {
  debate_id: string;
  idea: string;
  evidence_board?: Array<{
    id: string;
    title: string;
    content: string;
    type: string;
    agent_name: string;
  }>;
  report: {
    overall_assessment?: string;
    dimension_scores?: Record<string, number>;
    risks?: Array<{ risk: string; severity: string }>;
    improvements?: string[];
    highlights?: Array<{ agent: string; point: string }>;
    evidence_chain?: Array<{
      claim: string;
      evidence_ids: string[];
      why_it_matters: string;
    }>;
  };
  final_scores: Record<string, number>;
  completed_at: string;
}

const SEVERITY_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  high: {
    color: "text-danger",
    bg: "bg-danger/5",
    border: "border-danger/20",
    label: "高风险",
  },
  medium: {
    color: "text-warning",
    bg: "bg-warning/5",
    border: "border-warning/20",
    label: "中风险",
  },
  low: {
    color: "text-success",
    bg: "bg-success/5",
    border: "border-success/20",
    label: "低风险",
  },
};

const AGENT_COLOR_MAP: Record<string, string> = {
  investor: "#D97706",
  cto: "#0891B2",
  user_rep: "#059669",
  competitor: "#E11D48",
  orchestrator: "#7C3AED",
};

const AGENT_LABEL_MAP: Record<string, string> = {
  investor: "天使投资人",
  cto: "技术 CTO",
  user_rep: "目标用户",
  competitor: "竞品分析师",
  orchestrator: "主持人",
};

export default function ReportPage() {
  const params = useParams();
  const debateId = params.id as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "image" | null>(null);

  useEffect(() => {
    fetch(`/api/debate/${debateId}/report`)
      .then((res) => res.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [debateId]);

  if (loading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto bg-surface-0">
        <div className="arena-bg" />
        <div className="relative z-10 pt-12">
          <SkeletonReport />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-surface-0">
        <FileText className="h-8 w-8 text-text-muted" />
        <span className="text-text-muted">报告未找到</span>
      </div>
    );
  }

  const r = report.report;
  const overallScore = report.final_scores
    ? Math.round(
        Object.values(report.final_scores).reduce((a, b) => a + b, 0) /
          Object.values(report.final_scores).length
      )
    : 0;

  const scoreClass =
    overallScore >= 70 ? "score-good" : overallScore >= 40 ? "score-warning" : "score-critical";
  const imageRisks = (r?.risks ?? []).slice(0, 3);
  const imageImprovements = (r?.improvements ?? []).slice(0, 4);
  const imageHighlights = (r?.highlights ?? []).slice(0, 3);
  const imageSummary = (r?.overall_assessment ?? "").trim();
  const evidenceLookup = new Map((report.evidence_board ?? []).map((item) => [item.id, item]));
  const evidenceChain = r?.evidence_chain ?? [];

  const handleExport = async (kind: "image" | "pdf") => {
    try {
      setExporting(kind);
      const exporter = await import("@/lib/exportReport");
      if (kind === "image") {
        await exporter.exportAsImage("report-image-export-content", `startup-arena-${debateId}`);
      } else {
        await exporter.exportAsPDF("report-pdf-export-content", `startup-arena-${debateId}`);
      }
    } catch (error) {
      console.error(`Failed to export ${kind}:`, error);
      window.alert(`导出${kind === "pdf" ? " PDF" : "图片"}失败，请重试。`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto relative bg-surface-0">
      <div className="arena-bg" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-8 text-sm" data-export-hidden="true">
          <a
            href="/"
            className="flex items-center gap-1.5 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            首页
          </a>
          <span className="text-border-hover">/</span>
          <span className="text-text-secondary font-medium">评估报告</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div
          id="report-image-export-content"
          className="fixed top-0 left-[-200vw] pointer-events-none"
          style={{ width: 1120 }}
        >
          <div className="min-h-screen bg-surface-0 p-8">
            <div className="rounded-[28px] border border-border bg-[var(--bg-1)] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted font-semibold mb-2">
                    双创智辩 · CreAI Edu
                  </p>
                  <p className="text-xs text-text-muted">{formatBeijingTime(report.completed_at)}</p>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-accent/8 border border-accent/15 text-accent text-xs font-semibold">
                  双创课 BP 评估分享图 · AI 生成
                </div>
              </div>

              <div className="mb-8">
                <h1 className="text-[34px] leading-[1.25] font-display font-extrabold text-text-primary mb-3">
                  {report.idea}
                </h1>
                {imageSummary && (
                  <p className="text-[15px] leading-7 text-text-secondary max-w-[920px]">
                    {imageSummary}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-[1.15fr_0.85fr] gap-5 mb-8">
                <div className="card p-7">
                  <div className="flex items-start gap-5 mb-6">
                    <div className="w-[176px] shrink-0">
                      <div
                        className={`text-[88px] leading-[1] font-display font-extrabold tabular-nums pb-2 ${scoreClass}`}
                      >
                        {overallScore}
                      </div>
                      <div className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-surface-2 px-4 text-[13px] text-text-secondary font-semibold mt-5 text-center whitespace-nowrap">
                        <span className="leading-none -translate-y-2">综合评分</span>
                      </div>
                    </div>
                    <div className="w-fit shrink-0 self-center rounded-2xl border border-border bg-surface-2 px-5 py-3">
                      <div className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] text-text-muted leading-5 text-center">
                        <div className="whitespace-nowrap">维度均分来自多角色评审结果</div>
                        <div className="whitespace-nowrap">适合快速分享结论，不替代完整报告</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(report.final_scores ?? {}).map(([dim, score]) => {
                      const barColor = score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
                      return (
                        <div key={dim} className="flex items-center gap-3">
                          <span className="text-[13px] text-text-secondary w-20 shrink-0">
                            {getDimensionLabel(dim)}
                          </span>
                          <div className="flex-1 progress-track h-2.5">
                            <div
                              className="progress-fill h-2.5"
                              style={{ backgroundColor: barColor, width: `${score}%` }}
                            />
                          </div>
                          <span
                            className="text-[13px] font-bold font-mono tabular-nums w-10 text-right"
                            style={{ color: barColor }}
                          >
                            {score}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card p-6">
                  <h3 className="text-sm text-text-muted font-semibold mb-3">维度雷达</h3>
                  <RadarChart scores={report.final_scores ?? {}} size="lg" />
                </div>
              </div>

              {imageRisks.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-4 w-4 text-danger" />
                    <h2 className="text-lg font-display font-bold text-text-primary">3 个核心风险</h2>
                  </div>
                  <div className="space-y-2.5">
                    {imageRisks.map((risk, index) => {
                      const config = SEVERITY_CONFIG[risk.severity] ?? SEVERITY_CONFIG.medium;
                      return (
                        <div
                          key={`${risk.risk}-${index}`}
                          className="card px-4 py-3"
                          style={{ borderLeftColor: "rgba(239,68,68,0.16)", borderLeftWidth: 3 }}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`text-[11px] font-bold ${config.color} shrink-0`}>
                              {config.label}
                            </span>
                            <p className="text-[14px] leading-6 text-text-secondary">{risk.risk}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                {imageImprovements.length > 0 && (
                  <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="h-4 w-4 text-accent" />
                      <h2 className="text-lg font-display font-bold text-text-primary">改进建议</h2>
                    </div>
                    <div className="space-y-3">
                      {imageImprovements.map((item, index) => (
                        <div key={`${item}-${index}`} className="flex gap-3">
                          <span className="text-accent/60 font-bold shrink-0 text-sm font-mono tabular-nums">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <p className="text-[14px] leading-6 text-text-secondary">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {imageHighlights.length > 0 && (
                  <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Quote className="h-4 w-4 text-accent" />
                      <h2 className="text-lg font-display font-bold text-text-primary">评审金句</h2>
                    </div>
                    <div className="space-y-3">
                      {imageHighlights.map((highlight, index) => {
                        const agentKey = highlight.agent.toLowerCase().replace(/\s+/g, "_");
                        const agentColor = AGENT_COLOR_MAP[agentKey] ?? "#7C3AED";
                        const agentLabel = AGENT_LABEL_MAP[agentKey] ?? highlight.agent;
                        return (
                          <div
                            key={`${highlight.point}-${index}`}
                            className="rounded-2xl border border-border bg-surface-2 px-4 py-3"
                          >
                            <div className="text-xs font-bold mb-1" style={{ color: agentColor }}>
                              {agentLabel}
                            </div>
                            <p className="text-[14px] leading-6 text-text-secondary">{highlight.point}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* AI generation disclaimer footer for PNG export */}
              <div className="mt-8 rounded-2xl border border-border bg-surface-2 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 inline-flex items-center justify-center rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent">
                    AI 生成
                  </div>
                  <p className="text-[12px] leading-6 text-text-secondary">
                    本报告由「双创智辩 · CreAI Edu」生成式人工智能工具产出，由国产大模型 DeepSeek / GLM / Qwen / Kimi / 文心 协同生成。仅作为高校创新创业教育（双创课）课堂教学参考，不构成投资建议。教学使用须经教师人工核验，遵守《生成式人工智能服务管理暂行办法》。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* On-screen AI 生成 banner */}
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] px-4 py-3 flex items-start gap-3">
            <div className="shrink-0 inline-flex items-center justify-center rounded-full bg-accent/12 px-2.5 py-1 text-[10px] font-bold text-accent">
              AI 生成
            </div>
            <p className="text-[12px] leading-6 text-text-secondary">
              本评估报告由「双创智辩」多智能体（国产大模型）协同生成，作为双创课堂教学参考。请教师在引入课堂使用前进行人工核验。
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <p className="text-xs text-text-muted mb-2">{formatBeijingTime(report.completed_at)}</p>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-text-primary leading-tight">
              {report.idea}
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
          >
            <div className="card p-6 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5, type: "spring", stiffness: 150 }}
                className={`text-6xl font-display font-extrabold tabular-nums ${scoreClass} mb-1`}
              >
                {overallScore}
              </motion.div>
              <div className="text-xs text-text-muted font-semibold mb-6">综合评分</div>

              <div className="space-y-2.5">
                {Object.entries(report.final_scores ?? {}).map(([dim, score]) => {
                  const barColor = score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
                  return (
                    <div key={dim} className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-16 text-right shrink-0">
                        {getDimensionLabel(dim)}
                      </span>
                      <div className="flex-1 progress-track">
                        <motion.div
                          className="progress-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                          style={{ backgroundColor: barColor }}
                        />
                      </div>
                      <span
                        className="text-[11px] font-bold font-mono tabular-nums w-6"
                        style={{ color: barColor }}
                      >
                        {score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-xs text-text-muted font-semibold mb-2">维度雷达</h3>
              <RadarChart scores={report.final_scores ?? {}} size="lg" />
              {r?.overall_assessment && (
                <div className="mt-4 p-3 rounded-xl bg-surface-2 border border-border">
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    {r.overall_assessment}
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {r?.risks && r.risks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <h2 className="text-base font-display font-bold text-text-primary">风险评估</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-danger/6 text-danger font-bold border border-danger/15 font-mono tabular-nums">
                  {r.risks.length}
                </span>
              </div>
              <div className="space-y-2">
                {r.risks.map((risk, i) => {
                  const config = SEVERITY_CONFIG[risk.severity] ?? SEVERITY_CONFIG.medium;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.04 }}
                      className={`card px-4 py-3 !${config.border}`}
                    >
                      <span className={`text-[10px] font-bold mr-2 ${config.color}`}>
                        [{config.label}]
                      </span>
                      <span className="text-sm text-text-secondary">{risk.risk}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {r?.improvements && r.improvements.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-4 w-4 text-accent" />
                <h2 className="text-base font-display font-bold text-text-primary">改进建议</h2>
              </div>
              <div className="space-y-2">
                {r.improvements.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.04 }}
                    className="flex gap-3 card px-4 py-3"
                  >
                    <span className="text-accent/60 font-bold shrink-0 text-sm font-mono tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm text-text-secondary">{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {r?.highlights && r.highlights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <Quote className="h-4 w-4 text-accent" />
                <h2 className="text-base font-display font-bold text-text-primary">评审观点</h2>
              </div>
              <div className="space-y-2.5">
                {r.highlights.map((h, i) => {
                  const agentKey = h.agent.toLowerCase().replace(/\s+/g, "_");
                  const agentColor = AGENT_COLOR_MAP[agentKey] ?? "#7C3AED";
                  const agentLabel = AGENT_LABEL_MAP[agentKey] ?? h.agent;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 + i * 0.04 }}
                      className="card px-4 py-3"
                      style={{ borderLeftColor: `${agentColor}30`, borderLeftWidth: 3 }}
                    >
                      <span className="text-xs font-bold block mb-1" style={{ color: agentColor }}>
                        {agentLabel}
                      </span>
                      <p className="text-sm text-text-secondary leading-relaxed">{h.point}</p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {evidenceChain.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-accent" />
                <h2 className="text-base font-display font-bold text-text-primary">证据链</h2>
              </div>
              <div className="space-y-3">
                {evidenceChain.map((item, i) => (
                  <motion.div
                    key={`${item.claim}-${i}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.04 }}
                    className="card px-4 py-4"
                  >
                    <div className="text-[11px] font-bold text-accent mb-2 font-mono tabular-nums">
                      CLAIM {String(i + 1).padStart(2, "0")}
                    </div>
                    <p className="text-sm text-text-primary font-semibold leading-relaxed mb-2">
                      {item.claim}
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed">{item.why_it_matters}</p>
                    {item.evidence_ids.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {item.evidence_ids.map((evidenceId) => {
                          const evidence = evidenceLookup.get(evidenceId);
                          return (
                            <span
                              key={evidenceId}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-text-secondary"
                            >
                              <span className="font-mono text-text-muted">{evidenceId.slice(-4)}</span>
                              <span>{evidence?.title ?? evidenceId}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div
          id="report-pdf-export-content"
          className="fixed top-0 left-[-200vw] pointer-events-none"
          style={{ width: 1120 }}
        >
          <div className="min-h-screen bg-surface-0 p-8">
            <div className="rounded-[28px] border border-border bg-[var(--bg-1)] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] space-y-8">
          {/* PDF brand + AI 生成 header band */}
          <div
            className="flex items-center justify-between mb-2 pb-4 border-b border-border"
            data-export-block="true"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted font-semibold mb-1">
                双创智辩 · CreAI Edu
              </p>
              <p className="text-[12px] text-text-secondary">高校双创课堂多智能体答辩教练 · 评估报告</p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent border border-accent/20">
              AI 生成
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
            data-export-block="true"
          >
            <p className="text-xs text-text-muted mb-2">{formatBeijingTime(report.completed_at)}</p>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-text-primary leading-tight">
              {report.idea}
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-4 mb-8"
            data-export-block="true"
          >
            <div className="card p-6">
              <div className="flex items-start gap-5 mb-6">
                <div className="w-[176px] shrink-0">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, type: "spring", stiffness: 150 }}
                    className={`text-[88px] leading-[1] font-display font-extrabold tabular-nums pb-2 ${scoreClass}`}
                  >
                    {overallScore}
                  </motion.div>
                  <div className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-surface-2 px-4 text-[13px] text-text-secondary font-semibold mt-5 text-center whitespace-nowrap">
                    <span className="leading-none -translate-y-2">综合评分</span>
                  </div>
                </div>
                <div className="w-fit shrink-0 self-center rounded-2xl border border-border bg-surface-2 px-5 py-3">
                  <div className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] text-text-muted leading-5 text-center">
                    <div className="whitespace-nowrap">维度均分来自多角色评审结果</div>
                    <div className="whitespace-nowrap">适合快速分享结论，不替代完整报告</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {Object.entries(report.final_scores ?? {}).map(([dim, score]) => {
                  const barColor = score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
                  return (
                    <div key={dim} className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-16 text-right shrink-0">
                        {getDimensionLabel(dim)}
                      </span>
                      <div className="flex-1 progress-track">
                        <motion.div
                          className="progress-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                          style={{ backgroundColor: barColor }}
                        />
                      </div>
                      <span
                        className="text-[11px] font-bold font-mono tabular-nums w-6"
                        style={{ color: barColor }}
                      >
                        {score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-xs text-text-muted font-semibold mb-2">维度雷达</h3>
              <RadarChart scores={report.final_scores ?? {}} size="lg" />
              {r?.overall_assessment && (
                <div className="mt-4 p-3 rounded-xl bg-surface-2 border border-border">
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    {r.overall_assessment}
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {r?.risks && r.risks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-4" data-export-block="true">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <h2 className="text-base font-display font-bold text-text-primary">风险评估</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-danger/6 text-danger font-bold border border-danger/15 font-mono tabular-nums">
                  {r.risks.length}
                </span>
              </div>
              <div className="space-y-2">
                {r.risks.map((risk, i) => {
                  const config = SEVERITY_CONFIG[risk.severity] ?? SEVERITY_CONFIG.medium;
                  return (
                    <motion.div
                      key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.04 }}
                    className={`card px-4 py-3 !${config.border}`}
                    data-export-block="true"
                  >
                      <span className={`text-[10px] font-bold mr-2 ${config.color}`}>
                        [{config.label}]
                      </span>
                      <span className="text-sm text-text-secondary">{risk.risk}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {r?.improvements && r.improvements.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-4" data-export-block="true">
                <Lightbulb className="h-4 w-4 text-accent" />
                <h2 className="text-base font-display font-bold text-text-primary">改进建议</h2>
              </div>
              <div className="space-y-2">
                {r.improvements.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.04 }}
                    className="flex gap-3 card px-4 py-3"
                    data-export-block="true"
                  >
                    <span className="text-accent/60 font-bold shrink-0 text-sm font-mono tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm text-text-secondary">{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {r?.highlights && r.highlights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-4" data-export-block="true">
                <Quote className="h-4 w-4 text-accent" />
                <h2 className="text-base font-display font-bold text-text-primary">评审观点</h2>
              </div>
              <div className="space-y-2.5">
                {r.highlights.map((h, i) => {
                  const agentKey = h.agent.toLowerCase().replace(/\s+/g, "_");
                  const agentColor = AGENT_COLOR_MAP[agentKey] ?? "#7C3AED";
                  const agentLabel = AGENT_LABEL_MAP[agentKey] ?? h.agent;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 + i * 0.04 }}
                      className="card px-4 py-3"
                      style={{ borderLeftColor: `${agentColor}30`, borderLeftWidth: 3 }}
                      data-export-block="true"
                    >
                      <span className="text-xs font-bold block mb-1" style={{ color: agentColor }}>
                        {agentLabel}
                      </span>
                      <p className="text-sm text-text-secondary leading-relaxed">{h.point}</p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* PDF AI generation footer disclaimer */}
          <div
            className="mt-8 rounded-2xl border border-border bg-surface-2 px-5 py-4"
            data-export-block="true"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 inline-flex items-center justify-center rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent">
                AI 生成
              </div>
              <p className="text-[12px] leading-6 text-text-secondary">
                本报告由「双创智辩 · CreAI Edu」生成式人工智能工具产出，由国产大模型 DeepSeek / GLM / Qwen / Kimi / 文心 协同生成。仅作为高校创新创业教育（双创课）课堂教学参考，不构成投资建议。教师在用于课堂评价前须进行人工核验，遵守《生成式人工智能服务管理暂行办法》。
              </p>
            </div>
          </div>
        </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center pt-4 pb-12" data-export-hidden="true">
          <a href="/" className="inline-flex items-center gap-2 px-6 py-2.5 text-sm btn-primary cursor-pointer">
            <span>评估新想法</span>
          </a>
          <a href="/history" className="px-5 py-2.5 text-sm btn-secondary cursor-pointer">
            历史记录
          </a>
          <ShareButton debateId={debateId} />
          <button
            onClick={() => handleExport("image")}
            disabled={!!exporting}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm btn-secondary cursor-pointer"
          >
            {exporting === "image" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
            导出图片
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={!!exporting}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm btn-secondary cursor-pointer"
          >
            {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            导出 PDF
          </button>
        </div>
      </div>
    </div>
  );
}
