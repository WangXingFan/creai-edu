"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  Lightbulb,
  Quote,
  Loader2,
  FileText,
} from "lucide-react";
import RadarChart from "@/components/RadarChart";
import { formatBeijingTime } from "@/lib/datetime";
import { getDimensionLabel } from "@/lib/dimensions";

interface Report {
  debate_id: string;
  idea: string;
  report: {
    overall_assessment?: string;
    dimension_scores?: Record<string, number>;
    risks?: Array<{ risk: string; severity: string }>;
    improvements?: string[];
    highlights?: Array<{ agent: string; point: string }>;
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

export default function ReportPage() {
  const params = useParams();
  const debateId = params.id as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/6 border border-accent/12">
          <Loader2 className="h-5 w-5 text-accent animate-spin" />
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

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto relative bg-surface-0">
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
          <span className="text-text-secondary font-medium">评估报告</span>
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
                      {h.agent}
                    </span>
                    <p className="text-sm text-text-secondary leading-relaxed">{h.point}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        <div className="flex gap-3 justify-center pt-4 pb-12">
          <a href="/" className="inline-flex items-center gap-2 px-6 py-2.5 text-sm btn-primary cursor-pointer">
            <span>评估新想法</span>
          </a>
          <a href="/history" className="px-5 py-2.5 text-sm btn-secondary cursor-pointer">
            历史记录
          </a>
        </div>
      </div>
    </div>
  );
}
