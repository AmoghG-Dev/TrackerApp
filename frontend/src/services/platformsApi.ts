const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface SupportedPlatform {
  key: string;
  name: string;
  website: string;
  has_contests: boolean;
  has_stats: boolean;
}

export interface UserPlatform {
  id: string;
  name: string;
  website: string;
  handle: string;
  platform_key: string;
  sync_contests: boolean;
  is_active: boolean;
  status: "active" | "error" | "unconfigured";
  status_message: string;
  has_auth_token: boolean;
  details?: Record<string, unknown>;
  created_at: string;
  last_validated_at?: string;
}

export interface AddPlatformPayload {
  name: string;
  website?: string;
  handle: string;
  platform_key: string;
  auth_token?: string;
  sync_contests?: boolean;
}

export interface UpdatePlatformPayload {
  name?: string;
  website?: string;
  handle?: string;
  sync_contests?: boolean;
  is_active?: boolean;
  auth_token?: string;
}

export interface PlatformTestResult {
  success: boolean;
  status: string;
  message: string;
  details?: Record<string, unknown>;
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
      message = typeof payload.detail === "string" ? payload.detail : message;
    } catch {
      // fallback
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function getSupportedPlatforms(): Promise<SupportedPlatform[]> {
  return request<SupportedPlatform[]>("/platforms/supported");
}

export function getUserPlatforms(): Promise<UserPlatform[]> {
  return request<UserPlatform[]>("/platforms");
}

export function addPlatform(payload: AddPlatformPayload): Promise<UserPlatform> {
  return request<UserPlatform>("/platforms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePlatform(id: string, payload: UpdatePlatformPayload): Promise<UserPlatform> {
  return request<UserPlatform>(`/platforms/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function testPlatform(id: string): Promise<PlatformTestResult> {
  return request<PlatformTestResult>(`/platforms/${encodeURIComponent(id)}/test`, {
    method: "POST",
  });
}

export function deletePlatform(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/platforms/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
