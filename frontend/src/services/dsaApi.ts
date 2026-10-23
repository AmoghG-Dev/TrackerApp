const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type ApiQuestion = {
  id: string;
  title: string;
  platform: string;
  platform_id?: string;
  url: string;
  difficulty: "easy" | "medium" | "hard";
  topics: string[];
  company_tags?: string[];
  frequency_score?: number;
  status?: "pending" | "solved" | "retry";
};

export type ApiAttemptStatus =
  | "pending"
  | "solved"
  | "unsolved"
  | "failed";

export interface CreateQuestionPayload {
  title: string;
  url: string;
  difficulty: "easy" | "medium" | "hard";
  platform?: string;
  topics?: string[];
  frequency_score?: number;
}

export interface UpdateQuestionPayload {
  title?: string;
  url?: string;
  difficulty?: "easy" | "medium" | "hard";
  platform?: string;
  topics?: string[];
  frequency_score?: number;
}

export interface DsaStats {
  total_questions: number;
  solved_count: number;
  retry_count: number;
  pending_count: number;
  current_streak: number;
  longest_streak: number;
  total_active_days: number;
  difficulty: {
    easy: { solved: number; total: number };
    medium: { solved: number; total: number };
    hard: { solved: number; total: number };
  };
  top_topics: { topic: string; solved: number }[];
  activity_trend: { date: string; attempts: number }[];
}

export interface DailyAssignmentQuestion {
  question_id: string;
  title: string;
  platform: string;
  url: string;
  difficulty: "easy" | "medium" | "hard";
  topics: string[];
  status: string;
}

export interface DailyAssignment {
  id: string;
  date: string;
  questions: DailyAssignmentQuestion[];
}

export interface AttemptHistoryItem {
  id: string;
  question_id: string;
  title: string;
  platform: string;
  difficulty: "easy" | "medium" | "hard";
  url: string;
  status: string;
  time_taken_minutes?: number | null;
  hints_used: number;
  attempted_at: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const payload = await response.json();
      message =
        typeof payload.detail === "string"
          ? payload.detail
          : message;
    } catch {
      // Keep the fallback error message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function getDsaQuestions(): Promise<ApiQuestion[]> {
  return request<ApiQuestion[]>("/dsa/questions");
}

export function createDsaQuestion(payload: CreateQuestionPayload): Promise<ApiQuestion> {
  return request<ApiQuestion>("/dsa/questions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDsaQuestion(id: string, payload: UpdateQuestionPayload): Promise<ApiQuestion> {
  return request<ApiQuestion>(`/dsa/questions/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteDsaQuestion(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/dsa/questions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function recordDsaAttempt(
  questionId: string,
  status: ApiAttemptStatus,
): Promise<{ message: string }> {
  return request<{ message: string }>("/dsa/attempts", {
    method: "POST",
    body: JSON.stringify({
      question_id: questionId,
      status,
    }),
  });
}

export function getDsaStats(): Promise<DsaStats> {
  return request<DsaStats>("/dsa/stats");
}

export function getDailyQuestions(): Promise<DailyAssignment> {
  return request<DailyAssignment>("/dsa/daily");
}

export function getAttemptHistory(): Promise<AttemptHistoryItem[]> {
  return request<AttemptHistoryItem[]>("/dsa/attempts/history");
}
