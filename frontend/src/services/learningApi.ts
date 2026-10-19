
import type {
  LearningPlaylist,
  LearningVideo,
} from "../types/tracker";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000/api/v1";

export interface CreatePlaylistPayload {
  title: string;
  url: string;
  start_date: string;
  videos_per_day: number;
  videos: LearningVideo[];
}

interface ApiPlaylist {
  id: string;
  title: string;
  url: string;
  start_date: string;
  videos_per_day: number;
  videos: LearningVideo[];
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || `Request failed: ${response.status}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function mapPlaylist(
  playlist: ApiPlaylist,
): LearningPlaylist {
  return {
    id: playlist.id,
    title: playlist.title,
    url: playlist.url,
    startDate: playlist.start_date,
    videosPerDay: playlist.videos_per_day,
    videos: playlist.videos,
  };
}

export async function getPlaylists(): Promise<LearningPlaylist[]> {
  const playlists =
    await request<ApiPlaylist[]>("/learning/playlists");

  return playlists.map(mapPlaylist);
}

export async function createPlaylist(
  payload: CreatePlaylistPayload,
): Promise<LearningPlaylist> {
  const playlist = await request<ApiPlaylist>(
    "/learning/playlists",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return mapPlaylist(playlist);
}

export async function updateVideoCompletion(
  playlistId: string,
  videoId: string,
  completed: boolean,
): Promise<void> {
  await request(
    `/learning/playlists/${encodeURIComponent(playlistId)}/videos/${encodeURIComponent(videoId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    },
  );
}

export async function deletePlaylist(
  playlistId: string,
): Promise<void> {
  await request(
    `/learning/playlists/${encodeURIComponent(playlistId)}`,
    { method: "DELETE" },
  );
}
