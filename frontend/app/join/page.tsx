"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Users } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Student-facing entry page where they manually type a class code.
 * Routes to /join/[code] on submit.
 */
export default function JoinIndexPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    router.push(`/join/${encodeURIComponent(trimmed)}`);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="arena-bg" />

      <div className="fixed top-4 right-4 z-30">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors cursor-pointer mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回首页
        </a>

        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/8 border border-accent/15 text-accent mb-4">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-text-primary mb-2">
            加入双创课堂
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            请输入任课教师发布的 6 位班级码
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="如 ABC123"
            maxLength={8}
            autoFocus
            className="w-full px-4 py-4 bg-[var(--bg-1)] rounded-2xl text-text-primary placeholder-text-muted text-center text-2xl font-mono font-bold tracking-[0.4em] focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 border border-border shadow-card"
          />
          <button
            type="submit"
            disabled={!code.trim() || loading}
            className="w-full py-3.5 px-6 rounded-full text-sm btn-primary flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>下一步</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] text-text-muted leading-relaxed">
          班级码由任课教师在 <a href="/teacher" className="text-accent hover:underline">教师后台</a> 创建班级后获得
        </p>
      </div>
    </main>
  );
}
