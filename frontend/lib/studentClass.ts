"use client";

/**
 * Student-side class context storage.
 *
 * When a student lands on /join/[code], they enter their name + 学号 and
 * we resolve the code → class info via /api/student/join-class. We then
 * persist the class context in sessionStorage so subsequent BP submissions
 * are automatically associated with the class. sessionStorage (not local)
 * means closing the tab clears the binding — appropriate for shared
 * classroom devices.
 */

const STORAGE_KEY = "creai_edu_student_class";

export interface StudentClassContext {
  classId: string;
  className: string;
  teacherName: string;
  studentName: string;
  studentId: string;
}

export function getStudentClassContext(): StudentClassContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudentClassContext;
    if (!parsed.classId || !parsed.className) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStudentClassContext(ctx: StudentClassContext): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function clearStudentClassContext(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
