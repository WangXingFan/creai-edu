"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AGENT_COLORS, type DebateMessage } from "@/hooks/useDebateSocket";
import { getDimensionLabel } from "@/lib/dimensions";
import { AGENT_AVATARS } from "@/components/AgentAvatars";
import MarkdownContent from "@/components/MarkdownContent";

interface DebateStreamProps {
  messages: DebateMessage[];
  currentRound: number;
}

const COLLAPSE_THRESHOLD = 300;

const AGENT_ROLE_LABELS: Record<string, string> = {
  investor: "天使投资人",
  cto: "技术 CTO",
  user_rep: "目标用户",
  competitor: "竞品分析师",
  orchestrator: "裁判官",
};

function MessageCard({ msg }: { msg: DebateMessage }) {
  const color = AGENT_COLORS[msg.agent] ?? "#0052FF";
  const Avatar = AGENT_AVATARS[msg.agent];
  const isLong = msg.content.length > COLLAPSE_THRESHOLD && !msg.isStreaming;
  const [expanded, setExpanded] = useState(false);
  const isOrchestrator = msg.agent === "orchestrator";
  const isCollapsed = isLong && !expanded;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`
        group relative flex gap-3 p-4 rounded-2xl transition-colors
        ${isOrchestrator
          ? "bg-surface-2 border border-border"
          : `bg-[var(--bg-1)] border border-border shadow-sm agent-indicator-${msg.agent}`
        }
      `}
    >
      <div className="shrink-0 pt-0.5">
        {Avatar ? (
          <div className="relative">
            <Avatar size={36} />
            {msg.isStreaming && (
              <div
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-1)] animate-pulse-dot"
                style={{ backgroundColor: color }}
              />
            )}
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-surface-2 border border-border" />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-bold" style={{ color }}>
            {AGENT_ROLE_LABELS[msg.agent] || msg.agentName || msg.agent}
          </span>
          <span className="text-[10px] text-text-muted font-mono">R{msg.round}</span>
        </div>

        <div>
          {msg.isStreaming ? (
            <p className="text-[13px] leading-[1.7] text-text-secondary typing-cursor">
              {msg.content || "思考中..."}
            </p>
          ) : (
            <div className="relative">
              <div
                className={isCollapsed ? "overflow-hidden" : undefined}
                style={isCollapsed ? { maxHeight: "15rem" } : undefined}
              >
                <MarkdownContent>{msg.content}</MarkdownContent>
              </div>
              {isCollapsed && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--bg-1)] to-transparent" />
              )}
            </div>
          )}
        </div>

        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs flex items-center gap-1 text-text-muted hover:text-accent transition-colors cursor-pointer"
          >
            {expanded ? (
              <>收起 <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>展开全文 <ChevronDown className="h-3 w-3" /></>
            )}
          </button>
        )}

        {msg.scores && Object.keys(msg.scores).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-border">
            {Object.entries(msg.scores).map(([dim, score]) => {
              const scoreColor =
                score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
              return (
                <span
                  key={dim}
                  className="text-[11px] px-2 py-0.5 rounded-full font-mono font-medium border"
                  style={{
                    color: scoreColor,
                    borderColor: `${scoreColor}20`,
                    backgroundColor: `${scoreColor}08`,
                  }}
                >
                  {getDimensionLabel(dim)} {score}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function DebateStream({ messages, currentRound }: DebateStreamProps) {
  const rounds = new Map<number, DebateMessage[]>();
  for (const msg of messages) {
    const list = rounds.get(msg.round) ?? [];
    list.push(msg);
    rounds.set(msg.round, list);
  }

  return (
    <div>
      <AnimatePresence>
        {Array.from(rounds.entries()).map(([round, msgs]) => (
          <div key={round}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="round-divider"
            >
              <div className="round-badge">第 {round} 轮</div>
            </motion.div>
            <div className="space-y-3">
              {msgs.map((msg, i) => (
                <MessageCard key={`${msg.agent}-${msg.round}-${i}`} msg={msg} />
              ))}
            </div>
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
