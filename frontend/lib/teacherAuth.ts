"use client";

/**
 * Lightweight teacher token storage and authenticated fetch wrapper.
 *
 * The teacher backend is gated by a static TEACHER_TOKEN configured on
 * the server (see backend/app/api/teacher_auth.py). The token is stored
 * in localStorage so it survives reloads on the same browser, and
 * automatically attached to every teacher API request via the
 * X-Teacher-Token header.
 *
 * This is intentionally simple — sufficient for classroom pilot use,
 * not a full SaaS auth system.
 */

const STORAGE_KEY = "creai_edu_teacher_token";

export function getTeacherToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setTeacherToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore quota errors */
  }
}

export function clearTeacherToken(): void {
  setTeacherToken("");
}

export function hasTeacherToken(): boolean {
  return getTeacherToken().length > 0;
}

/**
 * Validates the stored token against the backend. Returns true if the
 * token is accepted, false otherwise. Does not throw on network errors —
 * caller can decide how to surface them.
 */
export async function checkTeacherToken(token?: string): Promise<boolean> {
  const t = (token ?? getTeacherToken()).trim();
  if (!t) return false;
  try {
    const res = await fetch("/api/teacher/auth/check", {
      method: "POST",
      headers: { "X-Teacher-Token": t },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch wrapper that automatically attaches the teacher token. Throws
 * a TeacherAuthError if the server rejects the token (401), so pages
 * can redirect to /teacher login. Other errors fall through as regular
 * Response.
 */
export class TeacherAuthError extends Error {
  constructor(message = "Teacher token is invalid or missing") {
    super(message);
    this.name = "TeacherAuthError";
  }
}

export async function teacherFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getTeacherToken();
  if (!token) {
    throw new TeacherAuthError();
  }
  const headers = new Headers(init.headers);
  headers.set("X-Teacher-Token", token);
  if (
    !headers.has("Content-Type") &&
    init.body &&
    typeof init.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearTeacherToken();
    throw new TeacherAuthError();
  }
  return res;
}
