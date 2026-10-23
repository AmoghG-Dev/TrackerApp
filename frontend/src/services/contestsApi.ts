const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type ContestPlatform = string;

export interface Contest {
  id: string | number;
  name: string;
  platform: ContestPlatform;
  start_time: string;
  start_timestamp: number;
  duration_seconds: number;
  url: string;
}

export type ContestFilter = string;

interface ContestApiResponse {
  count: number;
  contests: Contest[];
  platform: ContestFilter;
  timezone: string;
  fetched_at: string;
}

export async function fetchContests(
  platform: ContestFilter = "all",
  limit = 50,
): Promise<ContestApiResponse> {
  const params = new URLSearchParams({
    platform,
    limit: String(limit),
  });

  const response = await fetch(
    `${API_BASE_URL}/contests?${params.toString()}`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    let message = `Failed to fetch contests (${response.status})`;

    try {
      const error = await response.json();
      if (typeof error.detail === "string") {
        message = error.detail;
      }
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<ContestApiResponse>;
}
