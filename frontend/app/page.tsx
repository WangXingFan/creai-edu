"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, Sparkles } from "lucide-react";
import {
  InvestorAvatar,
  CTOAvatar,
  UserAvatar,
  CompetitorAvatar,
} from "@/components/AgentAvatars";
import IdeaInput from "@/components/IdeaInput";
import ThemeToggle from "@/components/ThemeToggle";

const AGENTS = [
  {
    name: "天使投资人",
    focus: "商业模式 · 市场规模",
    Avatar: InvestorAvatar,
    color: "#D97706",
    lightBg: "rgba(217, 119, 6, 0.06)",
  },
  {
    name: "技术 CTO",
    focus: "可行性 · 技术壁垒",
    Avatar: CTOAvatar,
    color: "#0891B2",
    lightBg: "rgba(8, 145, 178, 0.06)",
  },
  {
    name: "目标用户",
    focus: "需求痛点 · 使用意愿",
    Avatar: UserAvatar,
    color: "#059669",
    lightBg: "rgba(5, 150, 105, 0.06)",
  },
  {
    name: "竞品分析师",
    focus: "竞争格局 · 差异化",
    Avatar: CompetitorAvatar,
    color: "#E11D48",
    lightBg: "rgba(225, 29, 72, 0.06)",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (idea: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/debate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, max_rounds: 3 }),
      });
      const data = await res.json();
      router.push(`/debate/${data.id}`);
    } catch (err) {
      console.error("Failed to start debate:", err);
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="arena-bg" />
      <div className="arena-glow-secondary" />

      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-30">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/6 border border-accent/12 text-accent text-xs font-semibold mb-6"
          >
            <Sparkles className="h-3 w-3" />
            Multi-Agent AI Evaluation
          </motion.div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
            <span className="gradient-text-hero">Startup Arena</span>
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-lg mx-auto">
            提交你的创业想法，4 位 AI 评审官 + 1 位 AI 主持人
            <br className="hidden sm:block" />
            从商业、技术、用户、竞争四大维度展开多轮深度辩论与评估
          </p>
        </motion.div>

        {/* Agent judges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10"
        >
          {AGENTS.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.08 }}
              className="agent-card group cursor-default"
            >
              <div className="relative z-10">
                <div className="flex justify-center mb-2.5">
                  <agent.Avatar size={44} />
                </div>
                <div
                  className="text-xs font-bold mb-0.5"
                  style={{ color: agent.color }}
                >
                  {agent.name}
                </div>
                <div className="text-[10px] text-text-muted leading-tight hidden sm:block">
                  {agent.focus}
                </div>
              </div>
              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300 w-0 group-hover:w-12"
                style={{ backgroundColor: agent.color }}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <IdeaInput onSubmit={handleSubmit} loading={loading} />
        </motion.div>

        {/* History link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-8"
        >
          <a
            href="/history"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          >
            <Clock className="h-3.5 w-3.5" />
            查看历史评估
          </a>
        </motion.div>
      </div>
    </main>
  );
}
