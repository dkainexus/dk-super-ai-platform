import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Thin client for the DK CMS app API (/api/app/*).

const API_BASE: string =
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ?? "https://www.dkglobal.group";

const TOKEN_KEY = "dk_app_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/api/app${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON error body
  }
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

// ---------- Types (mirror the API responses) ----------

export type Me = {
  owner: {
    id: string;
    name: string | null;
    username: string | null;
    status: string;
    phone: string | null;
    email: string | null;
    bank_name: string | null;
    bank_account_no: string | null;
  };
  merchant: { name: string; logo_url: string | null };
  country: { name: string | null; flag: string | null; currency: string | null };
  unread_notifications: number;
  modules: { training: boolean; notifications: boolean; exams: boolean; wallet: boolean };
};

export type VideoItem = {
  id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  thumb_url: string | null;
  seconds_watched: number;
  completed: boolean;
};

export type NotificationItem = {
  id: string;
  type: "general" | "company" | "reward" | "training" | "exam";
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export type ExamListItem = {
  id: string;
  title: string;
  description: string | null;
  question_count: number;
  pass_score: number;
  required_videos: { id: string; title: string; completed: boolean }[];
  unlocked: boolean;
  attempts: number;
  best_score: number | null;
  passed: boolean;
  can_take: boolean;
  wait_until: string | null;
};

export type ExamPaper = {
  exam: { id: string; title: string; pass_score: number };
  questions: {
    id: string;
    type: "choice" | "essay";
    question: string;
    options: string[];
    points: number;
  }[];
};

export type ExamAnswer = { question_id: string; answer_index?: number; answer_text?: string };

export type ExamResult = {
  score: number;
  passed: boolean;
  pass_score: number;
  feedback: {
    overall: string;
    per_question: { question_id: string; score: number; comment: string }[];
  };
  questions: { id: string; question: string; type: "choice" | "essay" }[];
};

// ---------- Endpoints ----------

export async function login(username: string, password: string): Promise<void> {
  const res = await request<{ token: string }>("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  await setToken(res.token);
}

export async function logout(): Promise<void> {
  await setToken(null);
}

export type WalletTx = {
  id: string;
  type: "reward" | "rent" | "withdrawal" | "refund" | "adjustment";
  amount: number;
  note: string | null;
  created_at: string;
};

export type WithdrawalItem = {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "rejected";
  reject_reason: string | null;
  requested_at: string;
};

export type WalletInfo = {
  balance: number;
  currency: string;
  bank: string | null;
  bank_account_no: string | null;
  transactions: WalletTx[];
  withdrawals: WithdrawalItem[];
};

export const api = {
  me: () => request<Me>("/me"),
  wallet: () => request<WalletInfo>("/wallet"),
  withdraw: (amount: number) =>
    request<{ ok: true }>("/wallet/withdraw", { method: "POST", body: JSON.stringify({ amount }) }),
  videos: () => request<{ videos: VideoItem[] }>("/videos"),
  videoUrl: (id: string) => request<{ url: string }>(`/videos/${id}/url`),
  reportProgress: (id: string, seconds: number, completed: boolean) =>
    request<{ ok: true }>(`/videos/${id}/progress`, {
      method: "POST",
      body: JSON.stringify({ seconds, completed }),
    }),
  exams: () => request<{ exams: ExamListItem[] }>("/exams"),
  examPaper: (id: string) => request<ExamPaper>(`/exams/${id}`),
  submitExam: (id: string, answers: ExamAnswer[]) =>
    request<ExamResult>(`/exams/${id}/submit`, { method: "POST", body: JSON.stringify({ answers }) }),
  notifications: () => request<{ notifications: NotificationItem[]; unread: number }>("/notifications"),
  markRead: (id?: string) =>
    request<{ ok: true }>("/notifications/read", { method: "POST", body: JSON.stringify(id ? { id } : {}) }),
};
