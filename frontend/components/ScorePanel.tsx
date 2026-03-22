"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import RadarChart from "./RadarChart";
import { getDimensionLabel } from "@/lib/dimensions";

interface ScorePanelProps {
  scores: Record<string, number>;
  currentRound: number;
  maxRounds: number;
}

export default function ScorePanel({ scores, currentRound, maxRounds }: ScorePanelProps) {
  const values = Object.values(scores);
  const overallScore =
    values.length > 0
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : 0;

  const prevScore = useRef(overallScore);
  const [scoreChanged, setScoreChanged] = useState(false);
  const [scoreDelta, setScoreDelta] = useState(0);

  useEffect(() => {
    if (overallScore !== prevScore.current && overallScore > 0) {
      setScoreDelta(overallScore - prevScore.current);
      setScoreChanged(true);
      prevScore.current = overallScore;
      const timer = setTimeout(() => setScoreChanged(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [overallScore]);

  const scoreClass =
    overallScore >= 70
      ? "score-good"
      : overallScore >= 40
        ? "score-warning"
        : overallScore > 0
          ? "score-critical"
          : "text-text-muted";

  const progressPercent = Math.max((currentRound / maxRounds) * 100, 2);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-text-muted font-semibold">综合评分</span>
          <div className="flex gap-1.5">
            {Array.from({ length: maxRounds }, (_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  i < currentRound ? "bg-accent" : "bg-surface-2"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="text-center mb-4">
          <motion.div
            className={`text-5xl font-display font-extrabold tabular-nums transition-colors duration-300 ${scoreClass}`}
            animate={scoreChanged ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
          >
            {overallScore || "—"}
          </motion.div>

          <AnimatePresence>
            {scoreChanged && scoreDelta !== 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={`inline-flex items-center gap-1 text-xs font-bold mt-1.5 ${
                  scoreDelta > 0 ? "text-success" : "text-danger"
                }`}
              >
                {scoreDelta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {scoreDelta > 0 ? "+" : ""}{scoreDelta}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <RadarChart scores={scores} size="sm" />
      </div>

      <div className="card p-4">
        <div className="flex justify-between text-xs text-text-muted mb-2">
          <span className="font-semibold">评估进度</span>
          <span className="font-mono tabular-nums">{currentRound}/{maxRounds}</span>
        </div>
        <div className="progress-track">
          <motion.div
            className="progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: "linear-gradient(90deg, #0052FF, #4D7CFF)" }}
          />
        </div>
      </div>

      {values.length > 0 && (
        <div className="card p-4 space-y-3">
          <span className="text-xs text-text-muted font-semibold">维度评分</span>
          {Object.entries(scores).map(([dim, score]) => {
            const barColor = score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
            return (
              <div key={dim}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">{getDimensionLabel(dim)}</span>
                  <span className="text-xs font-bold font-mono tabular-nums" style={{ color: barColor }}>
                    {score}
                  </span>
                </div>
                <div className="progress-track">
                  <motion.div
                    className="progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ backgroundColor: barColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
