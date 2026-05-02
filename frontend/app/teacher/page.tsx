"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import {
  checkTeacherToken,
  clearTeacherToken,
  getTeacherToken,
  setTeacherToken,
} from "@/lib/teacherAuth";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If a token already exists, validate and bounce to dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = getTeacherToken();
      if (!existing) {
        setChecking(false);
        return;
      }
      const ok = await checkTeacherToken(existing);
      if (cancelled) return;
      if (ok) {
        router.replace("/teacher/dashboard");
      } else {
        clearTeacherToken();
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await checkTeacherToken(trimmed);
      if (!ok) {
        setError("令牌无效。请向部署管理员核实 TEACHER_TOKEN 配置。");
        return;
      }
      setTeacherToken(trimmed);
      router.replace("/teacher/dashboard");
    } catch {
      setError("网络错误，请检查后端服务是否正常运行。");
    } finally {
      setSubmitting(false);
    }
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
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-text-primary mb-2">
            教师后台
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            管理双创课堂、查看学生 BP 提交与班级聚合分析
          </p>
        </div>

        {checking ? (
          <div className="card p-6 flex items-center justify-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在校验登录状态…
          </div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                教师令牌（TEACHER_TOKEN）
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="粘贴部署时配置的令牌"
                autoFocus
                className="w-full px-4 py-3 bg-[var(--bg-1)] rounded-xl text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 border border-border shadow-card font-mono"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-danger/20 bg-danger/[0.04] px-3 py-2.5 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                <p className="text-[12px] text-danger leading-5">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!token.trim() || submitting}
              className="w-full py-3.5 px-6 rounded-full text-sm btn-primary flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>验证并进入后台</span>
                </>
              )}
            </button>
          </motion.form>
        )}

        <p className="mt-8 text-center text-[10px] text-text-muted leading-relaxed">
          令牌由系统管理员在 .env 中通过 TEACHER_TOKEN 配置，本地保存于浏览器 localStorage
        </p>
      </div>
    </main>
  );
}
