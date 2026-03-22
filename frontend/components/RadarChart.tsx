"use client";

import { useState, useEffect } from "react";
import {
  Radar,
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { DIMENSION_LABELS } from "@/lib/dimensions";

interface RadarChartProps {
  scores: Record<string, number>;
  size?: "sm" | "lg";
}

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export default function RadarChart({ scores, size = "sm" }: RadarChartProps) {
  const isDark = useIsDark();

  const data = Object.entries(DIMENSION_LABELS).map(([key, label]) => ({
    dimension: label,
    score: scores[key] ?? 0,
    fullMark: 100,
  }));

  const height = size === "lg" ? 360 : 220;

  const gridColor = isDark ? "#334155" : "#E2E8F0";
  const tickColor = isDark ? "#94A3B8" : "#475569";
  const radiusTickColor = isDark ? "#475569" : "#CBD5E1";
  const strokeColor = isDark ? "#4D7CFF" : "#0052FF";
  const tooltipBg = isDark ? "#1E293B" : "#FFFFFF";
  const tooltipBorder = isDark ? "#334155" : "#E2E8F0";
  const tooltipText = isDark ? "#F1F5F9" : "#0F172A";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsRadar data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke={gridColor} />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{
            fill: tickColor,
            fontSize: size === "lg" ? 12 : 10,
            fontWeight: 500,
          }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: radiusTickColor, fontSize: 9 }}
        />
        <Radar
          name="评分"
          dataKey="score"
          stroke={strokeColor}
          fill="url(#radarGradient)"
          fillOpacity={isDark ? 0.2 : 0.15}
          strokeWidth={2}
        />
        <defs>
          <linearGradient id="radarGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={strokeColor} />
            <stop offset="100%" stopColor={isDark ? "#7C9FFF" : "#4D7CFF"} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{
            background: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: "12px",
            color: tooltipText,
            fontSize: "12px",
            fontWeight: 500,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          }}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  );
}
