
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api/v1";

export type GoogleCalendarStatus = {
  connected: boolean;
  connected_at: string | null;
};

export type GoogleCalendarSyncResult = {
  connected: boolean;
  checked: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    contest: string;
    message: string;
  }>;
  synced_at: string;
};

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const payload = await response.json();
      message = payload.detail || message;
    } catch {
      // Keep the fallback error message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function getGoogleCalendarStatus() {
  return request<GoogleCalendarStatus>(
    "/google-calendar/status",
  );
}

export async function connectGoogleCalendar() {
  const result = await request<{ authorization_url: string }>(
    "/google-calendar/connect",
  );

  // The browser must navigate to Google's OAuth consent page.
  window.location.assign(result.authorization_url);
}

export function disconnectGoogleCalendar() {
  return request<{ connected: boolean; message: string }>(
    "/google-calendar/disconnect",
    { method: "POST" },
  );
}

export function syncGoogleCalendar(
  days: number,
  reminderMinutes: number,
) {
  const query = new URLSearchParams({
    days: String(days),
    reminder_minutes: String(reminderMinutes),
  });

  return request<GoogleCalendarSyncResult>(
    `/google-calendar/sync?${query.toString()}`,
    { method: "POST" },
  );
}
