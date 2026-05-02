"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Users } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { setStudentClassContext } from "@/lib/studentClass";

interface ClassInfo {
  class_id: string;
  class_name: string;
  teacher_name: string;
}

/**
 * Student joins a class by code. Two phases:
 *  1. Resolve code → class info (server validates & checks active flag).
 *  2. Capture name + 学号; persist context to sessionStorage; redirect to /.
 */
export default function JoinByCodePage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const rawCode = decodeURIComponent(params?.code ?? "").toUpperCase();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!rawCode) {
      setResolveError("缺少班级码。");
      setResolving(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/student/join-class", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: rawCode }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          setResolveError(payload?.detail ?? "班级码无效或已停用。");
        } else {
          const data = (await res.json()) as ClassInfo;
          setClassInfo(data);
        }
      } catch {
        if (cancelled) return;
        setResolveError("网络错误，请检查后端服务是否正常运行。");
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classInfo) return;
    const name = studentName.trim();
    if (!name) return;
    setSubmitting(true);
    setStudentClassContext({
      classId: classInfo.class_id,
      className: classInfo.class_name,
      teacherName: classInfo.teacher_name,
      studentName: name,
      studentId: studentId.trim(),
    });
    router.push("/");
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="arena-bg" />

      <div className="fixed top-4 right-4 z-30">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <a
          href="/join"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors cursor-pointer mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          重新输入班级码
        </a>

        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/8 border border-accent/15 text-accent mb-4">
            <Users className="h-6 w-6" />
          </div>
          <p className="text-[11px] text-text-muted mb-1">班级码</p>
          <p className="font-display text-3xl font-extrabold text-text-primary tracking-[0.3em] font-mono">
            {rawCode || "—"}
          </p>
        </div>

        {resolving ? (
          <div className="card p-6 flex items-center justify-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在校验班级码…
          </div>
        ) : resolveError ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 border-danger/20"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-danger mb-1">无法加入班级</p>
                <p className="text-[13px] text-text-secondary leading-6">{resolveError}</p>
              </div>
            </div>
            <a
              href="/join"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm btn-secondary cursor-pointer"
            >
              重新输入
            </a>
          </motion.div>
        ) : classInfo ? (
          <motion.form
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="card p-4 bg-accent/[0.03] border-accent/15">
              <p className="text-[11px] text-text-muted mb-1">即将加入</p>
              <p className="text-sm font-bold text-text-primary">{classInfo.class_name}</p>
              <p className="text-[12px] text-text-secondary mt-1">
                任课教师：{classInfo.teacher_name}
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                姓名 <span className="text-danger">*</span>
              </label>
              <input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="请输入你的姓名"
                maxLength={20}
                autoFocus
                className="w-full px-4 py-3 bg-[var(--bg-1)] rounded-xl text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 border border-border shadow-card"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                学号 <span className="text-text-muted">（可选）</span>
              </label>
              <input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="如 20240123456"
                maxLength={32}
                className="w-full px-4 py-3 bg-[var(--bg-1)] rounded-xl text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 border border-border shadow-card font-mono"
              />
              <p className="mt-1.5 text-[11px] text-text-muted leading-relaxed">
                教师后台展示时会自动脱敏（如 202***1234），请放心填写
              </p>
            </div>

            <button
              type="submit"
              disabled={!studentName.trim() || submitting}
              className="w-full py-3.5 px-6 rounded-full text-sm btn-primary flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>加入班级并开始</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <p className="text-center text-[10px] text-text-muted leading-relaxed">
              加入后，你的 BP 提交将自动归属到本班，供任课教师汇总查看
            </p>
          </motion.form>
        ) : null}
      </div>
    </main>
  );
}
