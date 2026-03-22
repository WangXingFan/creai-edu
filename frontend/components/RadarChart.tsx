"use client";

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

export default function RadarChart({ scores, size = "sm" }: RadarChartProps) {
  const data = Object.entries(DIMENSION_LABELS).map(([key, label]) => ({
    dimension: label,
    score: scores[key] ?? 0,
    fullMark: 100,
  }));

  const height = size === "lg" ? 360 : 220;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsRadar data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="#E2E8F0" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{
            fill: "#475569",
            fontSize: size === "lg" ? 12 : 10,
            fontWeight: 500,
          }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "#CBD5E1", fontSize: 9 }}
        />
        <Radar
          name="评分"
          dataKey="score"
          stroke="#0052FF"
          fill="url(#radarGradient)"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <defs>
          <linearGradient id="radarGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0052FF" />
            <stop offset="100%" stopColor="#4D7CFF" />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            color: "#0F172A",
            fontSize: "12px",
            fontWeight: 500,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          }}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  );
}
