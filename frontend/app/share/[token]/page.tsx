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
  Share2,
} from "lucide-react";
import RadarChart from "@/components/RadarChart";
import { formatBeijingTime } from "@/lib/datetime";
import { getDimensionLabel } from "@/lib/dimensions";
import { SkeletonReport } from "@/components/Skeleton";

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
  { color: string; label: string }
> = {
  high: { color: "text-danger", label: "高风险" },
  medium: { color: "text-warning", label: "中风险" },
  low: { color: "text-success", label: "低风险" },
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

export default function SharedReportPage() {
  const params = useParams();
  const token = params.token as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [token]);

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

  if (notFound || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-surface-0">
        <FileText className="h-8 w-8 text-text-muted" />
        <span className="text-text-muted">分享链接无效或已过期</span>
        <a href="/" className="text-sm text-accent hover:underline mt-2">
          返回首页
        </a>
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
        {/* Shared badge */}
        <div className="flex items-center justify-between mb-8">
          <a
            href="/"
            className="flex items-center gap-1.5 text-text-muted hover:text-text-secondary transition-colors cursor-pointer text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Startup Arena
          </a>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/6 border border-accent/12 text-accent text-xs font-semibold">
            <Share2 className="h-3 w-3" />
            分享报告
          </div>
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
            <div className={`text-6xl font-display font-extrabold tabular-nums ${scoreClass} mb-1`}>
              {overallScore}
            </div>
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
                      <div
                        className="progress-fill"
                        style={{ backgroundColor: barColor, width: `${score}%` }}
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
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <h2 className="text-base font-display font-bold text-text-primary">主要风险</h2>
            </div>
            <div className="space-y-2">
              {r.risks.map((risk, i) => {
                const config = SEVERITY_CONFIG[risk.severity] ?? SEVERITY_CONFIG.medium;
                return (
                  <div key={i} className="card px-4 py-3">
                    <span className={`text-[10px] font-bold mr-2 ${config.color}`}>
                      [{config.label}]
                    </span>
                    <span className="text-sm text-text-secondary">{risk.risk}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {r?.improvements && r.improvements.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-4 w-4 text-accent" />
              <h2 className="text-base font-display font-bold text-text-primary">改进建议</h2>
            </div>
            <div className="space-y-2">
              {r.improvements.map((item, i) => (
                <div key={i} className="flex gap-3 card px-4 py-3">
                  <span className="text-accent/60 font-bold shrink-0 text-sm font-mono tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm text-text-secondary">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {r?.highlights && r.highlights.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Quote className="h-4 w-4 text-accent" />
              <h2 className="text-base font-display font-bold text-text-primary">关键洞察</h2>
            </div>
            <div className="space-y-2.5">
              {r.highlights.map((h, i) => {
                const agentKey = h.agent.toLowerCase().replace(/\s+/g, "_");
                const agentColor = AGENT_COLOR_MAP[agentKey] ?? "#7C3AED";
                const agentLabel = AGENT_LABEL_MAP[agentKey] ?? h.agent;
                return (
                  <div
                    key={i}
                    className="card px-4 py-3"
                    style={{ borderLeftColor: `${agentColor}30`, borderLeftWidth: 3 }}
                  >
                    <span className="text-xs font-bold block mb-1" style={{ color: agentColor }}>
                      {agentLabel}
                    </span>
                    <p className="text-sm text-text-secondary leading-relaxed">{h.point}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-center pt-4 pb-12">
          <a href="/" className="inline-flex items-center gap-2 px-6 py-2.5 text-sm btn-primary cursor-pointer">
            <span>去 Startup Arena 继续评估</span>
          </a>
        </div>
      </div>
    </div>
  );
}
