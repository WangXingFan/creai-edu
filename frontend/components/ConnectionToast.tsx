"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import type { ConnectionState } from "@/hooks/useDebateSocket";

interface ConnectionToastProps {
  state: ConnectionState;
}

const CONFIG: Record<ConnectionState, { icon: React.ReactNode; text: string; color: string; border: string } | null> = {
  connected: null,
  reconnecting: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    text: "连接已断开，正在重连...",
    color: "text-warning",
    border: "border-warning/30",
  },
  lost: {
    icon: <WifiOff className="h-3.5 w-3.5" />,
    text: "连接已断开，请刷新页面重试",
    color: "text-danger",
    border: "border-danger/30",
  },
};

export default function ConnectionToast({ state }: ConnectionToastProps) {
  const config = CONFIG[state];

  return (
    <AnimatePresence>
      {config && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full
            bg-white border ${config.border} shadow-lg text-sm font-medium ${config.color}`}
        >
          {config.icon}
          <span>{config.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
