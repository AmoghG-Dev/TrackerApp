
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  provider: string;
};

type AuthResponse = {
  user: AuthUser;
};

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
      if (typeof payload.detail === "string") {
        message = payload.detail;
      }
    } catch {
      // Keep the fallback error message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function getCurrentUser(): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/me");
}

export function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(
  email: string,
  password: string,
  invitationCode: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      invitation_code: invitationCode,
    }),
  });
}

export function logout(): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/logout", {
    method: "POST",
  });
}

export function startGoogleLogin(invitationCode?: string): void {
  const query = invitationCode
    ? `?invitation_code=${encodeURIComponent(invitationCode)}`
    : "";

  window.location.assign(
    `${API_BASE_URL}/auth/google${query}`,
  );
}
