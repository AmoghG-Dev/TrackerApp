
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

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getDsaQuestions(): Promise<ApiQuestion[]> {
  return request<ApiQuestion[]>("/dsa/questions");
}

export function recordDsaAttempt(
  questionId: string,
  status: ApiAttemptStatus
): Promise<{ message: string }> {
  return request<{ message: string }>("/dsa/attempts", {
    method: "POST",
    body: JSON.stringify({
      question_id: questionId,
      status,
    }),
  });
}
