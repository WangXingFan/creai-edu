"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Zap } from "lucide-react";

interface IdeaInputProps {
  onSubmit: (idea: string) => void;
  loading: boolean;
}

const EXAMPLE_IDEAS = [
  "一个AI驱动的简历优化工具，帮应届生针对不同岗位自动调整简历",
  "校园二手物品交易平台，支持拍照估价和同城即时配送",
  "面向独居老人的智能健康监测手环，异常自动通知家属",
];

export default function IdeaInput({ onSubmit, loading }: IdeaInputProps) {
  const [idea, setIdea] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSubmit = () => {
    if (idea.trim() && !loading) {
      onSubmit(idea.trim());
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
          placeholder="描述你的创业想法，越详细越好..."
          className={`
            w-full h-32 px-4 py-4 bg-white rounded-2xl
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
        <div className="absolute bottom-3 right-3">
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
            <span>开始评估</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Example ideas */}
      <div className="space-y-2.5 pt-2">
        <p className="text-xs text-text-muted font-medium">试试这些想法</p>
        <div className="flex flex-col gap-2">
          {EXAMPLE_IDEAS.map((example, i) => (
            <motion.button
              key={i}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIdea(example)}
              className="text-left text-[13px] px-4 py-2.5 rounded-xl
                bg-white text-text-secondary hover:text-text-primary
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
