"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Sparkles, Zap } from "lucide-react";

interface IdeaInputProps {
  onSubmit: (idea: string) => void;
  loading: boolean;
}

const EXAMPLE_IDEAS = [
  "面向高校学生的 AI 简历优化工具，针对不同岗位自动调整简历重点",
  "校园二手物品交易平台，支持拍照估价、同城即时配送的学生创业项目",
  "面向独居老人的智能健康监测手环，异常情况自动通知家属（学生民生方向 BP）",
];

export default function IdeaInput({ onSubmit, loading }: IdeaInputProps) {
  const [idea, setIdea] = useState("");
  const [focused, setFocused] = useState(false);
  const [polishing, setPolishing] = useState(false);

  const handleSubmit = () => {
    if (idea.trim() && !loading) {
      onSubmit(idea.trim());
    }
  };

  const handlePolish = async () => {
    if (!idea.trim() || polishing || loading) return;
    setPolishing(true);
    try {
      const res = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });
      if (!res.ok) throw new Error("Polish failed");
      const data = await res.json();
      setIdea(data.polished);
    } catch (err) {
      console.error("Failed to polish idea:", err);
    } finally {
      setPolishing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Textarea */}
      <div className="relative">
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="粘贴你的双创课 BP 项目想法（越具体越好：目标用户、痛点、解决方案、商业模式）..."
          className={`
            w-full h-24 sm:h-32 px-4 py-4 bg-[var(--bg-1)] rounded-2xl
            text-text-primary placeholder-text-muted resize-none
            focus:outline-none text-sm leading-relaxed
            transition-all duration-200 border
            ${
              focused
                ? "border-accent/40 ring-2 ring-accent/10 shadow-[0_0_0_4px_rgba(0,82,255,0.06)]"
                : "border-border hover:border-border-hover shadow-card"
            }
          `}
          maxLength={2000}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {/* AI Polish button */}
          <button
            onClick={handlePolish}
            disabled={!idea.trim() || polishing || loading}
            title="AI 润色"
            className={`
              flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium
              transition-all duration-200 cursor-pointer
              ${
                idea.trim() && !polishing && !loading
                  ? "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20"
                  : "bg-transparent text-text-muted/40 cursor-not-allowed"
              }
            `}
          >
            {polishing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            <span>{polishing ? "润色中" : "AI 润色"}</span>
          </button>
          <span className="text-[11px] text-text-muted font-mono tabular-nums">
            {idea.length}/2000
          </span>
        </div>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!idea.trim() || loading}
        className="w-full py-3.5 px-6 rounded-full text-sm btn-primary flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>正在召集评审团...</span>
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            <span>开始 AI 答辩教练</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Example ideas */}
      <div className="space-y-2.5 pt-2">
        <p className="text-xs text-text-muted font-medium">学生 BP 示例（可一键填入）</p>
        <div className="flex flex-col gap-2">
          {EXAMPLE_IDEAS.map((example, i) => (
            <motion.button
              key={i}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIdea(example)}
              className="text-left text-[13px] px-4 py-2.5 rounded-xl
                bg-[var(--bg-1)] text-text-secondary hover:text-text-primary
                border border-border hover:border-border-hover
                shadow-sm hover:shadow-md
                transition-all truncate cursor-pointer"
            >
              {example}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
