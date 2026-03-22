"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
  max_rounds?: number;
  summary?: {
    consensus: string[];
    disputes: string[];
    key_insights: string[];
    next_focus: string;
  };
  report?: Record<string, unknown>;
  final_scores?: Record<string, number>;
  message?: string;
}

interface UseDebateSocketReturn {
  messages: DebateMessage[];
  scores: Record<string, number>;
  currentRound: number;
  maxRounds: number;
  convergenceRound: number | null;
  status: "connecting" | "debating" | "completed" | "error";
  report: Record<string, unknown> | null;
  summaries: RoundSummary[];
}

export interface DebateMessage {
  agent: string;
  agentName: string;
  modelKey?: string;
  modelName?: string;
  content: string;
  round: number;
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
};

export { AGENT_COLORS };

export function useDebateSocket(debateId: string): UseDebateSocketReturn {
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [currentRound, setCurrentRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(3);
  const [convergenceRound, setConvergenceRound] = useState<number | null>(null);
  const [status, setStatus] = useState<UseDebateSocketReturn["status"]>("connecting");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [summaries, setSummaries] = useState<RoundSummary[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const streamingRef = useRef<Map<string, string>>(new Map());

  const handleEvent = useCallback((event: DebateEvent) => {
    switch (event.type) {
      case "debate_start":
        setStatus("debating");
        break;

      case "round_start":
        setCurrentRound(event.round ?? 0);
        if (event.max_rounds) setMaxRounds(event.max_rounds);
        break;

      case "agent_start":
        if (event.agent && event.agent_name) {
          const key = `${event.agent}-${event.round}`;
          streamingRef.current.set(key, "");
          setMessages((prev) => [
            ...prev,
            {
              agent: event.agent!,
              agentName: event.agent_name!,
              modelKey: event.model_key,
              modelName: event.model_name,
              content: "",
              round: event.round ?? 0,
              isStreaming: true,
            },
          ]);
        }
        break;

      case "agent_token":
        if (event.agent && event.token) {
          const key = `${event.agent}-${event.round}`;
          const current = streamingRef.current.get(key) ?? "";
          const updated = current + event.token;
          streamingRef.current.set(key, updated);

          setMessages((prev) => {
            const idx = prev.findLastIndex(
              (m) => m.agent === event.agent && m.round === event.round
            );
            if (idx === -1) return prev;
            const copy = [...prev];
            copy[idx] = { ...copy[idx], content: updated };
            return copy;
          });
        }
        break;

      case "agent_complete":
        if (event.agent) {
          setMessages((prev) => {
            const idx = prev.findLastIndex(
              (m) => m.agent === event.agent && m.round === event.round
            );
            if (idx === -1) return prev;
            const copy = [...prev];
            copy[idx] = {
              ...copy[idx],
              modelKey: event.model_key ?? copy[idx].modelKey,
              modelName: event.model_name ?? copy[idx].modelName,
              content: event.content ?? copy[idx].content,
              scores: event.scores,
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

      case "round_summary":
        if (event.summary) {
          setSummaries((prev) => [
            ...prev,
            {
              round: event.round ?? 0,
              consensus: event.summary!.consensus ?? [],
              disputes: event.summary!.disputes ?? [],
              keyInsights: event.summary!.key_insights ?? [],
              nextFocus: event.summary!.next_focus ?? "",
            },
          ]);
        }
        break;

      case "convergence":
        setConvergenceRound(event.round ?? null);
        break;

      case "debate_complete":
        setStatus("completed");
        if (event.report) setReport(event.report);
        if (event.final_scores) setScores(event.final_scores);
        break;

      case "error":
        setStatus("error");
        console.error("Debate error:", event.message);
        break;
    }
  }, []);

  useEffect(() => {
    const wsProtocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = process.env.NEXT_PUBLIC_WS_URL || (typeof window !== "undefined" ? `${wsProtocol}//${window.location.host}` : "ws://localhost:8000");
    const wsUrl = `${wsHost}/ws/debate/${debateId}`;

    let ws: WebSocket | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connecting");
      };

      ws.onmessage = (e) => {
        try {
          const event: DebateEvent = JSON.parse(e.data);
          handleEvent(event);
        } catch (err) {
          console.error("Failed to parse WS message:", err);
        }
      };

      ws.onerror = () => {
        // Don't set error here, let onclose handle it
      };

      ws.onclose = () => {
        if (disposed) return;
        setStatus((prev) => {
          // If completed or already error, don't change
          if (prev === "completed" || prev === "error") return prev;
          return "error";
        });
        // DO NOT auto-reconnect — user should start a new debate
      };
    };

    connect();

    return () => {
      disposed = true;
      ws?.close();
    };
  }, [debateId, handleEvent]);

  return {
    messages,
    scores,
    currentRound,
    maxRounds,
    convergenceRound,
    status,
    report,
    summaries,
  };
}
