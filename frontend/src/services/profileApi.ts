const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  bio: string;
  target_role: string;
  target_companies: string[];
  primary_language: string;
  github_username: string;
  linkedin_url: string;
  provider: string;
  created_at?: string;
}

export type UpdateProfilePayload = Partial<UserProfile>;

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
      message = typeof payload.detail === "string" ? payload.detail : message;
    } catch {
      // fallback
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function getUserProfile(): Promise<UserProfile> {
  return request<UserProfile>("/profile");
}

export function updateUserProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  return request<UserProfile>("/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
