"use client";

import { useState } from "react";
import { Share2, Check, Loader2 } from "lucide-react";

interface ShareButtonProps {
  debateId: string;
}

export default function ShareButton({ debateId }: ShareButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "copied">("idle");

  const handleShare = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/debate/${debateId}/share`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to create share link");
      const data = await res.json();

      const shareUrl = `${window.location.origin}/share/${data.share_token}`;
      await navigator.clipboard.writeText(shareUrl);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      console.error("Share failed:", err);
      setState("idle");
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={state === "loading"}
      className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm btn-secondary cursor-pointer"
    >
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "copied" ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      {state === "copied" ? "已复制链接" : "分享报告"}
    </button>
  );
}
