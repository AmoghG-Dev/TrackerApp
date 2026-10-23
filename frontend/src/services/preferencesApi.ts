const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface UserPreferences {
  daily_target: number;
  preferred_difficulty: string;
  auto_sync_calendar: boolean;
  calendar_sync_interval_hours: number;
  calendar_reminder_minutes: number;
  calendar_sync_horizon_days: number;
  contest_refresh_interval_minutes: number;
  timezone: string;
  theme: string;
  notifications_enabled: boolean;
  last_auto_sync_at?: string;
}

export type UpdatePreferencesPayload = Partial<UserPreferences>;

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

export function getUserPreferences(): Promise<UserPreferences> {
  return request<UserPreferences>("/preferences");
}

export function updateUserPreferences(payload: UpdatePreferencesPayload): Promise<UserPreferences> {
  return request<UserPreferences>("/preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
