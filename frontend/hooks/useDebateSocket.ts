"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface DebateTaskPayload {
  id: string;
  agent: string;
  agent_name: string;
  title: string;
  focus: string;
  reason: string;
  round: number;
  step: number;
  status?: string;
}

export interface DebateEvidencePayload {
  id: string;
  type: string;
  title: string;
  content: string;
  source: string;
  agent: string;
  agent_name: string;
  round: number;
  step: number;
}

export interface DebateJudgeDecisionPayload {
  verdict: string;
  should_continue: boolean;
  reason: string;
  next_focus?: string;
}

export interface DebateToolPayload {
  name: string;
  title: string;
  rationale?: string;
  arguments?: Record<string, unknown>;
  summary?: string;
  content?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface DebatePendingTool {
  name: string;
  title: string;
  rationale?: string;
  agent?: string;
  agent_name?: string;
  round: number;
  step: number;
  task?: DebateTaskPayload | null;
}

export interface DebateRuntimeState {
  current_round: number;
  max_rounds: number;
  step_count: number;
  halt_reason?: string | null;
  active_task?: DebateTaskPayload | null;
  open_questions?: string[];
  scoreboard?: Record<string, number>;
  agent_states?: Record<string, Record<string, unknown>>;
}

export interface DebateTimelineEntry {
  id?: string;
  type: string;
  title: string;
  detail?: string;
  round: number;
  step: number;
  agent?: string;
  agent_name?: string;
  task?: DebateTaskPayload;
  action?: Record<string, unknown>;
  tool?: DebateToolPayload;
  evidence?: DebateEvidencePayload;
  decision?: DebateJudgeDecisionPayload;
  halt_reason?: string | null;
}

interface DebateEvent {
  type: string;
  agent?: string;
  agent_name?: string;
  model_key?: string;
  model_name?: string;
  token?: string;
  content?: string;
  scores?: Record<string, number>;
  round?: number;
  step?: number;
  max_rounds?: number;
  error?: string;
  summary?: {
    consensus: string[];
    disputes: string[];
    key_insights: string[];
    next_focus: string;
  };
  report?: Record<string, unknown>;
  final_scores?: Record<string, number>;
  message?: string;
  search_provider_label?: string;
  has_result?: boolean;
  task?: DebateTaskPayload | null;
  tool?: DebateToolPayload;
  tool_result?: DebateToolPayload;
  evidence?: DebateEvidencePayload;
  decision?: DebateJudgeDecisionPayload;
  state?: DebateRuntimeState;
  action_trace?: DebateTimelineEntry[];
  evidence_board?: DebateEvidencePayload[];
  agent_states?: Record<string, Record<string, unknown>>;
  halt_reason?: string | null;
  step_count?: number;
  current_round?: number;
}

export type ConnectionState = "connected" | "reconnecting" | "lost";

interface UseDebateSocketReturn {
  messages: DebateMessage[];
  timeline: DebateTimelineEntry[];
  scores: Record<string, number>;
  currentRound: number;
  maxRounds: number;
  stepCount: number;
  activeTask: DebateTaskPayload | null;
  haltReason: string | null;
  openQuestions: string[];
  agentStates: Record<string, Record<string, unknown>>;
  convergenceRound: number | null;
  summarizingRound: number | null;
  isGeneratingReport: boolean;
  status: "connecting" | "searching" | "debating" | "completed" | "error";
  report: Record<string, unknown> | null;
  summaries: RoundSummary[];
  connectionState: ConnectionState;
  pendingTool: DebatePendingTool | null;
  searchResult: string | null;
  searchProviderLabel: string;
  sendMessage: (content: string) => void;
}

export interface DebateMessage {
  agent: string;
  agentName: string;
  modelKey?: string;
  modelName?: string;
  content: string;
  round: number;
  step?: number;
  task?: DebateTaskPayload | null;
  scores?: Record<string, number>;
  isStreaming: boolean;
}

export interface RoundSummary {
  round: number;
  consensus: string[];
  disputes: string[];
  keyInsights: string[];
  nextFocus: string;
}

const AGENT_COLORS: Record<string, string> = {
  investor: "#D97706",
  cto: "#0891B2",
  user_rep: "#059669",
  competitor: "#E11D48",
  orchestrator: "#7C3AED",
  system: "#64748B",
};

const MAX_RECONNECT_ATTEMPTS = 10;

export { AGENT_COLORS };

function appendUniqueTimelineEntry(
  previous: DebateTimelineEntry[],
  entry: DebateTimelineEntry
): DebateTimelineEntry[] {
  if (entry.id && previous.some((item) => item.id === entry.id)) {
    return previous;
  }
  return [...previous, entry];
}

function sanitizeAgentContent(content: string): string {
  let cleaned = content.replace(/\r\n/g, "\n");
  const patterns = [
    /```scores\s*\n[\s\S]*?\n```/g,
    /<function_calls>[\s\S]*?<\/function_calls>/gi,
    /<function_calls>[\s\S]*$/gi,
    /<invoke\b[\s\S]*?<\/invoke>/gi,
    /<invoke\b[\s\S]*$/gi,
    /^[ \t]*<\/?(?:function_calls|invoke|parameter)\b[^>]*>[ \t]*\n?/gim,
    /^[ \t]*\/no_think[ \t]*\n?/gim,
    /^[ \t]*\/(?:function|tool)\b[^\n]*\n?/gim,
  ];

  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

function finalizeMessageContent(content?: string | null, fallback = "> 调用已中断"): string {
  const normalized = sanitizeAgentContent(content ?? "");
  return normalized || fallback;
}

function finalizeStreamingMessages(prev: DebateMessage[]): DebateMessage[] {
  return prev.map((message) =>
    message.isStreaming
      ? {
          ...message,
          isStreaming: false,
          content: finalizeMessageContent(message.content),
        }
      : message
  );
}

function upsertRoundSummary(
  previous: RoundSummary[],
  next: RoundSummary
): RoundSummary[] {
  const existingIndex = previous.findIndex((item) => item.round === next.round);
  if (existingIndex === -1) {
    return [...previous, next].sort((a, b) => a.round - b.round);
  }

  const copy = [...previous];
  copy[existingIndex] = next;
  return copy;
}

function toTimelineEntry(event: DebateEvent): DebateTimelineEntry {
  return {
    id: (event as DebateTimelineEntry).id,
    type: event.type,
    title: (event as DebateTimelineEntry).title ?? event.message ?? event.type,
    detail: (event as DebateTimelineEntry).detail ?? event.content,
    round: event.round ?? event.current_round ?? event.state?.current_round ?? 0,
    step: event.step ?? event.step_count ?? event.state?.step_count ?? 0,
    agent: event.agent,
    agent_name: event.agent_name,
    task: event.task ?? undefined,
    action: (event as DebateTimelineEntry).action,
    tool: event.tool,
    evidence: event.evidence,
    decision: event.decision,
    halt_reason: event.halt_reason,
  };
}

export function useDebateSocket(
  debateId: string,
  replayFromCache = false
): UseDebateSocketReturn {
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [timeline, setTimeline] = useState<DebateTimelineEntry[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [currentRound, setCurrentRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(3);
  const [stepCount, setStepCount] = useState(0);
  const [activeTask, setActiveTask] = useState<DebateTaskPayload | null>(null);
  const [haltReason, setHaltReason] = useState<string | null>(null);
  const [openQuestions, setOpenQuestions] = useState<string[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, Record<string, unknown>>>({});
  const [convergenceRound, setConvergenceRound] = useState<number | null>(null);
  const [summarizingRound, setSummarizingRound] = useState<number | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [status, setStatus] = useState<UseDebateSocketReturn["status"]>("connecting");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [summaries, setSummaries] = useState<RoundSummary[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connected");
  const [pendingTool, setPendingTool] = useState<DebatePendingTool | null>(null);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchProviderLabel, setSearchProviderLabel] = useState("联网搜索");
  const wsRef = useRef<WebSocket | null>(null);
  const searchCompletedRef = useRef(false);
  const streamingRef = useRef<Map<string, string>>(new Map());
  const statusRef = useRef<UseDebateSocketReturn["status"]>("connecting");
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEvent = useCallback((event: DebateEvent) => {
    switch (event.type) {
      case "search_start":
        searchCompletedRef.current = false;
        statusRef.current = "searching";
        setStatus("searching");
        setSearchResult("");
        if (event.search_provider_label) {
          setSearchProviderLabel(event.search_provider_label);
        }
        break;

      case "search_token":
        if (event.token && !searchCompletedRef.current) {
          setSearchResult((prev) => (prev ?? "") + event.token);
        }
        break;

      case "search_complete":
        searchCompletedRef.current = true;
        setSearchResult(event.content?.trim() ? event.content : null);
        if (event.search_provider_label) {
          setSearchProviderLabel(event.search_provider_label);
        }
        break;

      case "debate_start":
        setIsGeneratingReport(false);
        statusRef.current = "debating";
        setStatus("debating");
        break;

      case "state_update":
        if (event.state) {
          setCurrentRound(event.state.current_round ?? 0);
          setMaxRounds(event.state.max_rounds ?? 3);
          setStepCount(event.state.step_count ?? 0);
          setActiveTask(event.state.active_task ?? null);
          setHaltReason(event.state.halt_reason ?? null);
          setOpenQuestions(event.state.open_questions ?? []);
          if (event.state.scoreboard) {
            setScores(event.state.scoreboard);
          }
          if (event.state.agent_states) {
            setAgentStates(event.state.agent_states);
          }
        }
        break;

      case "round_start":
        if (!searchCompletedRef.current) {
          searchCompletedRef.current = true;
          setSearchResult(null);
        }
        setCurrentRound(event.round ?? 0);
        setSummarizingRound(null);
        setIsGeneratingReport(false);
        setPendingTool(null);
        if (event.max_rounds) setMaxRounds(event.max_rounds);
        statusRef.current = "debating";
        setStatus("debating");
        break;

      case "task_assigned":
        setActiveTask(event.task ?? null);
        setTimeline((prev) => appendUniqueTimelineEntry(prev, toTimelineEntry(event)));
        break;

      case "tool_call":
        setPendingTool({
          name: event.tool?.name ?? event.message ?? "tool",
          title: event.tool?.title ?? event.title ?? "工具调用中",
          rationale: event.tool?.rationale ?? event.detail,
          agent: event.agent,
          agent_name: event.agent_name,
          round: event.round ?? 0,
          step: event.step ?? 0,
          task: event.task ?? null,
        });
        setTimeline((prev) => appendUniqueTimelineEntry(prev, toTimelineEntry(event)));
        break;

      case "tool_result":
        setPendingTool(null);
        setTimeline((prev) => appendUniqueTimelineEntry(prev, toTimelineEntry(event)));
        break;

      case "action_emitted":
      case "evidence_posted":
      case "scheduler_decision":
      case "judge_decision":
        setTimeline((prev) => appendUniqueTimelineEntry(prev, toTimelineEntry(event)));
        if (
          event.type === "judge_decision" &&
          event.decision?.reason &&
          !event.decision.should_continue
        ) {
          setHaltReason(event.decision.reason);
        }
        break;

      case "halted":
        setPendingTool(null);
        setHaltReason(event.halt_reason ?? event.message ?? null);
        setTimeline((prev) => appendUniqueTimelineEntry(prev, toTimelineEntry(event)));
        break;

      case "agent_start":
        if (event.agent && event.agent_name) {
          const agent = event.agent;
          const agentName = event.agent_name;
          const key = `${agent}-${event.round}-${event.step ?? 0}`;
          streamingRef.current.set(key, "");
          setMessages((prev) => [
            ...prev,
            {
              agent,
              agentName,
              modelKey: event.model_key,
              modelName: event.model_name,
              content: "",
              round: event.round ?? 0,
              step: event.step,
              task: event.task,
              isStreaming: true,
            },
          ]);
        }
        break;

      case "agent_token":
        if (event.agent && event.token) {
          const key = `${event.agent}-${event.round}-${event.step ?? 0}`;
          const current = streamingRef.current.get(key) ?? "";
          const updated = current + event.token;
          streamingRef.current.set(key, updated);

          setMessages((prev) => {
            const idx = prev.findLastIndex(
              (message) =>
                message.agent === event.agent &&
                message.round === event.round &&
                message.step === event.step
            );
            if (idx === -1) return prev;
            const copy = [...prev];
            copy[idx] = { ...copy[idx], content: finalizeMessageContent(updated, "") };
            return copy;
          });
        }
        break;

      case "agent_complete":
        if (event.agent) {
          const agent = event.agent;
          const key = `${agent}-${event.round}-${event.step ?? 0}`;
          streamingRef.current.delete(key);
          setMessages((prev) => {
            const idx = prev.findLastIndex(
              (message) =>
                message.agent === agent &&
                message.round === event.round &&
                message.step === event.step
            );
            if (idx === -1 && event.agent_name) {
              return [
                ...prev,
                {
                  agent,
                  agentName: event.agent_name,
                  modelKey: event.model_key,
                  modelName: event.model_name,
                  content: finalizeMessageContent(event.content, "> 暂无正文"),
                  round: event.round ?? 0,
                  step: event.step,
                  task: event.task,
                  scores: event.scores,
                  isStreaming: false,
                },
              ];
            }
            if (idx === -1) return prev;
            const copy = [...prev];
            copy[idx] = {
              ...copy[idx],
              modelKey: event.model_key ?? copy[idx].modelKey,
              modelName: event.model_name ?? copy[idx].modelName,
              content: finalizeMessageContent(
                event.content ?? copy[idx].content,
                "> 暂无正文"
              ),
              scores: event.scores,
              isStreaming: false,
            };
            return copy;
          });
        }
        break;

      case "agent_error":
        if (event.agent) {
          const agent = event.agent;
          const key = `${agent}-${event.round}-${event.step ?? 0}`;
          streamingRef.current.delete(key);
          setMessages((prev) => {
            const idx = prev.findLastIndex(
              (message) =>
                message.agent === agent &&
                message.round === event.round &&
                message.step === event.step
            );
            if (idx === -1 && event.agent_name) {
              const errorPrefix = finalizeMessageContent(event.content, "");
              return [
                ...prev,
                {
                  agent,
                  agentName: event.agent_name,
                  modelKey: event.model_key,
                  modelName: event.model_name,
                  content: errorPrefix
                    ? `${errorPrefix}\n\n> 调用失败：${event.message ?? "调用失败"}`
                    : `> 调用失败：${event.message ?? "调用失败"}`,
                  round: event.round ?? 0,
                  step: event.step,
                  task: event.task,
                  isStreaming: false,
                },
              ];
            }
            if (idx === -1) return prev;
            const copy = [...prev];
            const existing = finalizeMessageContent(event.content ?? copy[idx].content, "");
            const errorText = event.message
              ? `\n\n> 调用失败：${event.message}`
              : "\n\n> 调用失败";
            copy[idx] = {
              ...copy[idx],
              modelKey: event.model_key ?? copy[idx].modelKey,
              modelName: event.model_name ?? copy[idx].modelName,
              content: `${existing}${errorText}`.trim(),
              isStreaming: false,
            };
            return copy;
          });
        }
        break;

      case "score_update":
        if (event.scores) {
          setScores(event.scores);
        }
        break;

      case "round_summary_start":
        setSummarizingRound(event.round ?? null);
        break;

      case "round_summary":
        setSummarizingRound(null);
        if (event.summary) {
          const summary = event.summary;
          setSummaries((prev) =>
            upsertRoundSummary(prev, {
              round: event.round ?? 0,
              consensus: summary.consensus ?? [],
              disputes: summary.disputes ?? [],
              keyInsights: summary.key_insights ?? [],
              nextFocus: summary.next_focus ?? "",
            })
          );
        }
        break;

      case "convergence":
        setConvergenceRound(event.round ?? null);
        break;

      case "final_report_start":
        setSummarizingRound(null);
        setIsGeneratingReport(true);
        setPendingTool(null);
        statusRef.current = "debating";
        setStatus("debating");
        break;

      case "debate_complete":
        if (!searchCompletedRef.current) {
          searchCompletedRef.current = true;
          setSearchResult(null);
        }
        setSummarizingRound(null);
        setIsGeneratingReport(false);
        setPendingTool(null);
        streamingRef.current.clear();
        setMessages(finalizeStreamingMessages);
        statusRef.current = "completed";
        setStatus("completed");
        setActiveTask(null);
        if (event.report) setReport(event.report);
        if (event.final_scores) setScores(event.final_scores);
        if (event.action_trace) setTimeline(event.action_trace);
        if (event.agent_states) setAgentStates(event.agent_states);
        if (typeof event.step_count === "number") setStepCount(event.step_count);
        if (typeof event.current_round === "number") setCurrentRound(event.current_round);
        if (typeof event.halt_reason === "string") setHaltReason(event.halt_reason);
        break;

      case "error":
        setSummarizingRound(null);
        setIsGeneratingReport(false);
        setPendingTool(null);
        streamingRef.current.clear();
        statusRef.current = "error";
        setStatus("error");
        setMessages(finalizeStreamingMessages);
        console.error("Debate error:", event.message);
        break;

      default:
        break;
    }
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "user_message", content }));
    }
  }, []);

  useEffect(() => {
    const wsProtocol =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "wss:"
        : "ws:";
    const isLocalFrontendDev =
      typeof window !== "undefined" &&
      /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) &&
      window.location.port === "3000";
    const wsHost =
      process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== "undefined"
        ? isLocalFrontendDev
          ? `${wsProtocol}//${window.location.hostname}:8000`
          : `${wsProtocol}//${window.location.host}`
        : "ws://localhost:8000");
    const replayQuery = replayFromCache ? "?replay=1" : "";
    const wsUrl = `${wsHost}/ws/debate/${debateId}${replayQuery}`;

    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        if (reconnectAttemptRef.current > 0) {
          setConnectionState("connected");
        }
        reconnectAttemptRef.current = 0;
        if (statusRef.current === "error") {
          statusRef.current = "connecting";
          setStatus("connecting");
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsed: DebateEvent = JSON.parse(event.data);
          handleEvent(parsed);
        } catch (err) {
          console.error("Failed to parse WS message:", err);
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (disposed) return;
        const previousStatus = statusRef.current;
        if (previousStatus === "completed") {
          return;
        }

        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }

        if (
          previousStatus === "debating" ||
          previousStatus === "connecting" ||
          previousStatus === "searching"
        ) {
          if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
            reconnectAttemptRef.current += 1;
            setConnectionState("reconnecting");
            reconnectTimerRef.current = setTimeout(connect, delay);
            return;
          }
          setConnectionState("lost");
        }

        setMessages(finalizeStreamingMessages);
        statusRef.current = "error";
        setStatus("error");
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = null;
      streamingRef.current.clear();
      wsRef.current?.close();
    };
  }, [debateId, handleEvent, replayFromCache]);

  return {
    messages,
    timeline,
    scores,
    currentRound,
    maxRounds,
    stepCount,
    activeTask,
    haltReason,
    openQuestions,
    agentStates,
    convergenceRound,
    summarizingRound,
    isGeneratingReport,
    status,
    report,
    summaries,
    connectionState,
    pendingTool,
    searchResult,
    searchProviderLabel,
    sendMessage,
  };
}
