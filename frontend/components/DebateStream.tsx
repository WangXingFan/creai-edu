"use client";

import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BriefcaseBusiness,
  Calculator,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Gavel,
  Wrench,
  Workflow,
} from "lucide-react";
import {
  AGENT_COLORS,
  type DebateMessage,
  type DebateTimelineEntry,
} from "@/hooks/useDebateSocket";
import { getDimensionLabel } from "@/lib/dimensions";
import { AGENT_AVATARS } from "@/components/AgentAvatars";
import MarkdownContent from "@/components/MarkdownContent";

interface DebateStreamProps {
  messages: DebateMessage[];
  timeline: DebateTimelineEntry[];
  currentRound: number;
}

const COLLAPSE_THRESHOLD = 300;

const AGENT_ROLE_LABELS: Record<string, string> = {
  investor: "天使投资人",
  cto: "技术 CTO",
  user_rep: "目标用户",
  competitor: "竞品分析师",
  scheduler: "调度器",
  judge: "裁决器",
  orchestrator: "裁判官",
  system: "系统",
};

function normalizeInlineText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function shouldHideTimelineEntry(event: DebateTimelineEntry) {
  const isPreparationSearchDuplicate =
    event.round === 0 &&
    event.type === "evidence_posted" &&
    (
      event.evidence?.type === "market_context" ||
      (event.agent === "system" && event.title.includes("市场调研数据"))
    );

  return isPreparationSearchDuplicate;
}

function shouldShowTaskReason(event: DebateTimelineEntry) {
  if (event.type !== "task_assigned" || !event.task?.reason) {
    return false;
  }

  const reason = normalizeInlineText(event.task.reason);
  const detail = normalizeInlineText(event.detail);
  const focus = normalizeInlineText(event.task.focus);

  return Boolean(reason) && reason !== detail && reason !== focus;
}

function getTimelineIcon(type: string) {
  switch (type) {
    case "scheduler_decision":
      return Workflow;
    case "task_assigned":
      return BriefcaseBusiness;
    case "evidence_posted":
      return FileSearch;
    case "tool_call":
      return Wrench;
    case "tool_result":
      return Calculator;
    case "judge_decision":
    case "halted":
      return Gavel;
    default:
      return Workflow;
  }
}

function getTimelineColor(type: string) {
  switch (type) {
    case "scheduler_decision":
      return "#0369A1";
    case "task_assigned":
      return "#0F766E";
    case "evidence_posted":
      return "#D97706";
    case "tool_call":
      return "#2563EB";
    case "tool_result":
      return "#0F766E";
    case "judge_decision":
      return "#7C3AED";
    case "halted":
      return "#DC2626";
    default:
      return "#475569";
  }
}

const TimelineCard = memo(function TimelineCard({ event }: { event: DebateTimelineEntry }) {
  const Icon = getTimelineIcon(event.type);
  const color = getTimelineColor(event.type);
  const actorLabel =
    AGENT_ROLE_LABELS[event.agent ?? ""] || event.agent_name || "系统";
  const showTaskDetails = event.type === "task_assigned" && !!event.task;
  const showTaskReason = shouldShowTaskReason(event);
  const [expandedEvidence, setExpandedEvidence] = useState(false);
  const fullEvidenceDetail =
    event.type === "evidence_posted"
      ? event.evidence?.content?.trim() || ""
      : "";
  const detailText = event.detail ?? "";
  const canExpandEvidence =
    event.type === "evidence_posted" &&
    Boolean(fullEvidenceDetail) &&
    normalizeInlineText(detailText) !== normalizeInlineText(fullEvidenceDetail);
  const visibleDetail = canExpandEvidence && expandedEvidence
    ? fullEvidenceDetail
    : detailText;
  const shouldShowDecisionReason =
    Boolean(event.decision?.reason) &&
    normalizeInlineText(event.decision?.reason) !== normalizeInlineText(visibleDetail);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-border bg-surface-0 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}12`, color }}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold" style={{ color }}>
              {event.title}
            </span>
            <span className="text-[10px] font-mono text-text-muted">
              S{event.step}
            </span>
            <span className="text-[10px] text-text-muted">{actorLabel}</span>
          </div>

          {showTaskDetails && event.task && (
            <div className="mt-1.5 rounded-xl border border-border bg-[var(--bg-1)] px-3 py-2">
              <MarkdownContent className="text-[11px] font-medium text-text-primary [&_p]:mb-0">
                {event.task.focus}
              </MarkdownContent>
              {showTaskReason && (
                <MarkdownContent className="mt-1 text-[11px] leading-5 text-text-muted [&_p]:mb-0">
                  {event.task.reason}
                </MarkdownContent>
              )}
            </div>
          )}

          {(!showTaskDetails && visibleDetail) && (
            <MarkdownContent className="mt-1.5 text-[12px] leading-5 text-text-secondary [&_p]:mb-0 [&_ul]:mb-0 [&_ol]:mb-0">
              {visibleDetail}
            </MarkdownContent>
          )}

          {canExpandEvidence && (
            <button
              type="button"
              onClick={() => setExpandedEvidence((value) => !value)}
              className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent"
            >
              {expandedEvidence ? (
                <>
                  收起摘要 <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  展开完整摘要 <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}

          {shouldShowDecisionReason && event.decision?.reason && (
            <MarkdownContent className="mt-2 text-[11px] leading-5 text-text-muted [&_p]:mb-0 [&_ul]:mb-0 [&_ol]:mb-0">
              {event.decision.reason}
            </MarkdownContent>
          )}
        </div>
      </div>
    </motion.div>
  );
});

const MessageCard = memo(function MessageCard({ msg }: { msg: DebateMessage }) {
  const color = AGENT_COLORS[msg.agent] ?? "#0052FF";
  const Avatar = AGENT_AVATARS[msg.agent];
  const isLong = msg.content.length > COLLAPSE_THRESHOLD && !msg.isStreaming;
  const [expanded, setExpanded] = useState(false);
  const isOrchestrator = msg.agent === "orchestrator";
  const isCollapsed = isLong && !expanded;
  const displayContent = msg.content || (msg.isStreaming ? "思考中..." : "> 调用已中断");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`
        group relative flex gap-3 rounded-2xl border p-4 transition-colors
        ${isOrchestrator
          ? "bg-surface-2 border-border"
          : `bg-[var(--bg-1)] border-border shadow-sm agent-indicator-${msg.agent}`
        }
      `}
    >
      <div className="shrink-0 pt-0.5">
        {Avatar ? (
          <div className="relative">
            <Avatar size={36} />
            {msg.isStreaming && (
              <div
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-1)] animate-pulse-dot"
                style={{ backgroundColor: color }}
              />
            )}
          </div>
        ) : (
          <div className="h-9 w-9 rounded-xl border border-border bg-surface-2" />
        )}
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold" style={{ color }}>
            {AGENT_ROLE_LABELS[msg.agent] || msg.agentName || msg.agent}
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            R{msg.round}
          </span>
          {typeof msg.step === "number" && (
            <span className="text-[10px] font-mono text-text-muted">
              S{msg.step}
            </span>
          )}
        </div>

        {msg.task && (
          <div className="mb-3 rounded-xl border border-border bg-surface-0 px-3 py-2">
            <p className="text-[11px] font-semibold text-text-primary">
              {msg.task.title}
            </p>
            <MarkdownContent className="mt-1 text-[11px] leading-5 text-text-muted [&_p]:mb-0">
              {msg.task.focus}
            </MarkdownContent>
          </div>
        )}

        <div>
          <div className="relative">
            <div
              className={isCollapsed ? "overflow-hidden" : undefined}
              style={isCollapsed ? { maxHeight: "15rem" } : undefined}
            >
              <MarkdownContent className={msg.isStreaming ? "typing-cursor" : undefined}>
                {displayContent}
              </MarkdownContent>
            </div>
            {isCollapsed && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--bg-1)] to-transparent" />
            )}
          </div>
        </div>

        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="mt-2 flex cursor-pointer items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent"
          >
            {expanded ? (
              <>
                收起 <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                展开全文 <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}

        {msg.scores && Object.keys(msg.scores).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2">
            {Object.entries(msg.scores).map(([dim, score]) => {
              const scoreColor =
                score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
              return (
                <span
                  key={dim}
                  className="rounded-full border px-2 py-0.5 text-[11px] font-medium font-mono"
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
});

export default function DebateStream({
  messages,
  timeline,
  currentRound,
}: DebateStreamProps) {
  const visibleTimeline = timeline.filter((entry) => !shouldHideTimelineEntry(entry));
  const rounds = new Set<number>([
    ...messages.map((msg) => msg.round),
    ...visibleTimeline
      .filter((entry) => entry.type !== "action_emitted")
      .map((entry) => entry.round),
    currentRound,
  ]);

  const orderedRounds = Array.from(rounds)
    .filter((round) => round >= 0)
    .sort((a, b) => a - b);

  return (
    <div>
      <AnimatePresence>
        {orderedRounds.map((round) => {
          const roundTimeline = visibleTimeline.filter(
            (entry) => entry.round === round && entry.type !== "action_emitted"
          );
          const roundMessages = messages.filter((msg) => msg.round === round);
          if (!roundTimeline.length && !roundMessages.length) {
            return null;
          }

          return (
            <div key={round}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="round-divider"
              >
                <div className="round-badge">
                  {round === 0 ? "准备阶段" : `第 ${round} 轮`}
                </div>
              </motion.div>

              {roundTimeline.length > 0 && (
                <div className="mb-3 space-y-2">
                  {roundTimeline.map((event, index) => (
                    <TimelineCard
                      key={event.id ?? `${event.type}-${round}-${event.step}-${index}`}
                      event={event}
                    />
                  ))}
                </div>
              )}

              {roundMessages.length > 0 && (
                <div className="space-y-3">
                  {roundMessages.map((msg, index) => (
                    <MessageCard
                      key={`${msg.agent}-${msg.round}-${msg.step ?? 0}-${index}`}
                      msg={msg}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
