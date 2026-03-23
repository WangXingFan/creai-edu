"use client";

import { useParams } from "next/navigation";
import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Target,
  Handshake,
  AlertTriangle,
  Radio,
  Search,
} from "lucide-react";
import { useDebateSocket } from "@/hooks/useDebateSocket";
import DebateStream from "@/components/DebateStream";
import ScorePanel from "@/components/ScorePanel";
import ConnectionToast from "@/components/ConnectionToast";
import ThemeToggle from "@/components/ThemeToggle";
import BottomSheet from "@/components/BottomSheet";
import { SkeletonMessage } from "@/components/Skeleton";
import MarkdownContent from "@/components/MarkdownContent";

export default function DebatePage() {
  const params = useParams();
  const debateId = params.id as string;
  const streamEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const prevMsgCount = useRef(0);

  const {
    messages,
    scores,
    currentRound,
    maxRounds,
    convergenceRound,
    summarizingRound,
    isGeneratingReport,
    status,
    report,
    summaries,
    connectionState,
    searchResult,
    searchProviderLabel,
    sendMessage,
  } = useDebateSocket(debateId);

  useEffect(() => {
    const newCount = messages.length;
    const isNewMessage = newCount > prevMsgCount.current;
    prevMsgCount.current = newCount;

    if (isNewMessage && !userScrolledUp.current) {
      streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  useEffect(() => {
    if (!userScrolledUp.current) {
      streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [summaries.length, summarizingRound, isGeneratingReport, status]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUp.current = distanceFromBottom > 150;
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-0 relative">
      <div className="arena-bg" />
      <ConnectionToast state={connectionState} />

      {/* Header */}
      <header className="border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between bg-[var(--bg-1)]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer p-1 -ml-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <h1 className="text-sm font-display font-bold gradient-text">
            Startup Arena
          </h1>
        </div>

          <div className="flex items-center gap-3">
          {status === "debating" && (
            <div className="hidden sm:flex items-center gap-1.5">
              {Array.from({ length: maxRounds }, (_, i) => (
                <div
                  key={i}
                  className={`w-5 h-1 rounded-full transition-all duration-500 ${
                    i < currentRound
                      ? "bg-accent"
                      : "bg-surface-2"
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-1)] border border-border shadow-sm">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                status === "debating"
                  ? "bg-accent animate-pulse-dot"
                  : status === "completed"
                    ? "bg-success"
                    : status === "error"
                      ? "bg-danger"
                      : "bg-warning animate-pulse-dot"
              }`}
            />
            <span className="text-xs text-text-secondary font-medium">
              {status === "connecting" && "连接中..."}
              {status === "searching" && "搜索市场数据..."}
              {status === "debating" && isGeneratingReport && "最终报告生成中"}
              {status === "debating" && !isGeneratingReport && summarizingRound !== null && `第 ${summarizingRound} 轮 · 总结中`}
              {status === "debating" && !isGeneratingReport && summarizingRound === null && `第 ${currentRound} 轮 · 进行中`}
              {status === "completed" && "评估完成"}
              {status === "error" && "连接中断"}
            </span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex relative">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6"
        >
          {status === "connecting" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3 py-4"
            >
              <div className="text-center mb-6">
                <p className="text-sm text-text-muted">正在召集评审团...</p>
              </div>
              {[1, 2, 3].map((i) => (
                <SkeletonMessage key={i} />
              ))}
            </motion.div>
          )}

          {(status === "searching" || searchResult) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4 mb-4"
              style={{ borderLeft: "3px solid var(--accent)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Search className={`h-3.5 w-3.5 text-accent ${status === "searching" ? "animate-pulse" : ""}`} />
                <span className="text-xs font-bold text-accent">市场调研数据</span>
                <span className="text-[10px] text-text-muted font-mono">via {searchProviderLabel}</span>
                {status === "searching" && (
                  <span className="text-[10px] text-accent animate-pulse">搜索中...</span>
                )}
              </div>
              <MarkdownContent className={status === "searching" ? "typing-cursor" : undefined}>
                {searchResult || ""}
              </MarkdownContent>
            </motion.div>
          )}

          <DebateStream messages={messages} currentRound={currentRound} />

          {summarizingRound !== null && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="my-6 card p-4"
            >
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 text-accent animate-spin shrink-0" />
                <span>主持人正在汇总第 {summarizingRound} 轮观点与分歧...</span>
              </div>
            </motion.div>
          )}

          {summaries.map((s) => (
            <motion.div
              key={s.round}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="my-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-text-muted px-2">
                  第 {s.round} 轮小结
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {s.consensus.length > 0 && (
                  <div className="card p-4">
                    <span className="text-xs text-success font-semibold flex items-center gap-1.5 mb-2">
                      <Handshake className="h-3.5 w-3.5" />
                      共识
                    </span>
                    <ul className="text-[13px] text-text-secondary space-y-1">
                      {s.consensus.map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-success/50 mt-1.5 text-[6px]">●</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {s.disputes.length > 0 && (
                  <div className="card p-4">
                    <span className="text-xs text-danger font-semibold flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      分歧
                    </span>
                    <ul className="text-[13px] text-text-secondary space-y-1">
                      {s.disputes.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-danger/50 mt-1.5 text-[6px]">●</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {s.nextFocus && s.round < maxRounds && status !== "completed" && convergenceRound === null && (
                <div className="mt-3 flex items-center gap-2 text-[13px] px-4 py-2.5 card">
                  <Target className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="text-text-secondary">
                    <span className="text-accent font-semibold">下一轮焦点：</span>
                    {s.nextFocus}
                  </span>
                </div>
              )}
            </motion.div>
          ))}

          {convergenceRound !== null && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="my-6 card p-4 !border-success/30"
            >
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>第 {convergenceRound} 轮达成收敛 — 评审团意见趋于一致</span>
              </div>
            </motion.div>
          )}

          {isGeneratingReport && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 mb-2"
            >
              <div className="card p-4 !border-accent/25">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Loader2 className="h-4 w-4 text-accent animate-spin shrink-0" />
                  <span>主持人正在生成最终评估报告，风险、建议和评审观点即将整理完成...</span>
                </div>
              </div>
            </motion.div>
          )}

          {status === "completed" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-success/8 border border-success/15 mb-4">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <p className="text-text-primary text-lg font-display font-bold mb-1">评估完成</p>
              <p className="text-sm text-text-muted mb-6">评审团已达成最终判定</p>
              <a
                href={`/report/${debateId}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm btn-primary cursor-pointer"
              >
                <span>查看评估报告</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>
          )}

          <div ref={streamEndRef} />
        </div>

        <div className="hidden lg:block w-80 border-l border-border p-4 overflow-y-auto bg-surface-0">
          <ScorePanel scores={scores} currentRound={currentRound} maxRounds={maxRounds} />
        </div>
      </div>

      {/* Mobile bottom sheet for ScorePanel */}
      <BottomSheet label="评分面板">
        <ScorePanel scores={scores} currentRound={currentRound} maxRounds={maxRounds} />
      </BottomSheet>
    </div>
  );
}
