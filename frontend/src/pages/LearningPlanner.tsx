
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  ExternalLink,
  X,
} from "lucide-react";

import {
  getPlaylists,
  createPlaylist,
  updateVideoCompletion,
  deletePlaylist,
} from "../services/learningApi";

import type { LearningPlaylist } from "../types/tracker";

function getTodayString(): string {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000,
  );

  return local.toISOString().slice(0, 10);
}

function getScheduledDate(
  startDate: string,
  videoIndex: number,
  perDay: number,
): string {
  const date = new Date(`${startDate}T12:00:00`);
  date.setDate(date.getDate() + Math.floor(videoIndex / perDay));

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LearningPlanner() {
  const [playlists, setPlaylists] = useState<LearningPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);

  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [startDate, setStartDate] = useState(getTodayString());
  const [videosPerDay, setVideosPerDay] = useState(2);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlaylists() {
      try {
        const data = await getPlaylists();

        if (!cancelled) {
          setPlaylists(data);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(
            error instanceof Error
              ? `Could not load playlists: ${error.message}`
              : "Could not load playlists.",
          );
        }
      } finally {
        if (!cancelled) {
          setPlaylistsLoading(false);
        }
      }
    }

    void loadPlaylists();

    return () => {
      cancelled = true;
    };
  }, []);

  async function addPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const url = playlistUrl.trim();

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();

      const validYouTube =
        hostname === "youtube.com" ||
        hostname.endsWith(".youtube.com") ||
        hostname === "youtu.be";

      if (!validYouTube) {
        setNotice("Enter a valid YouTube playlist or video URL.");
        return;
      }
    } catch {
      setNotice("Enter a valid YouTube URL.");
      return;
    }

    const title = playlistTitle.trim() || "My ML Learning Playlist";

    setSaving(true);
    setNotice("");

    try {
      const created = await createPlaylist({
        title,
        url,
        start_date: startDate,
        videos_per_day: videosPerDay,
        videos: [],
      });

      setPlaylists((current) => [...current, created]);
      setPlaylistUrl("");
      setPlaylistTitle("");
      setNotice("Playlist saved successfully.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not save playlist: ${error.message}`
          : "Could not save playlist.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleVideo(playlistId: string, videoId: string) {
    const playlist = playlists.find((item) => item.id === playlistId);
    const video = playlist?.videos.find((item) => item.id === videoId);

    if (!video) return;

    const nextCompleted = !video.completed;

    try {
      await updateVideoCompletion(playlistId, videoId, nextCompleted);

      setPlaylists((current) =>
        current.map((item) =>
          item.id !== playlistId
            ? item
            : {
                ...item,
                videos: item.videos.map((entry) =>
                  entry.id === videoId
                    ? { ...entry, completed: nextCompleted }
                    : entry,
                ),
              },
        ),
      );

      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not update video: ${error.message}`
          : "Could not update video completion.",
      );
    }
  }

  async function removePlaylist(playlistId: string) {
    try {
      await deletePlaylist(playlistId);

      setPlaylists((current) =>
        current.filter((playlist) => playlist.id !== playlistId),
      );

      setNotice("Playlist deleted successfully.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not delete playlist: ${error.message}`
          : "Could not delete playlist.",
      );
    }
  }

  return (
    <>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="welcome-row">
        <div>
          <div className="eyebrow">AI/ML LEARNING PATH</div>
          <h1>
            Learning Planner<span className="blue-period">.</span>
          </h1>
          <p className="subtitle">
            Plan your videos, track completion, and keep learning on schedule.
          </p>
        </div>
        <span className="local-badge">MongoDB synced</span>
      </section>

      <section className="panel learning-form-panel">
        <div className="panel-heading">
          <div>
            <h2>Add a playlist</h2>
            <p>Paste a YouTube link and configure your study schedule.</p>
          </div>
          <BookOpen size={21} className="muted-icon" />
        </div>

        <form className="learning-form" onSubmit={addPlaylist}>
          <label>
            Playlist name
            <input
              value={playlistTitle}
              onChange={(event) => setPlaylistTitle(event.target.value)}
              placeholder="e.g. Andrew Ng Machine Learning"
            />
          </label>

          <label className="playlist-url-field">
            YouTube playlist URL
            <input
              type="url"
              required
              value={playlistUrl}
              onChange={(event) => setPlaylistUrl(event.target.value)}
              placeholder="https://www.youtube.com/playlist?list=..."
            />
          </label>

          <div className="learning-form-options">
            <label>
              Start date
              <input
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            <label>
              Videos per day
              <select
                value={videosPerDay}
                onChange={(event) =>
                  setVideosPerDay(Number(event.target.value))
                }
              >
                <option value={1}>1 video</option>
                <option value={2}>2 videos</option>
                <option value={3}>3 videos</option>
                <option value={4}>4 videos</option>
              </select>
            </label>
          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={saving}
          >
            <CalendarDays size={16} />
            {saving ? "Creating study plan..." : "Create study plan"}
          </button>
        </form>
      </section>

      <section className="learning-playlists">
        {playlistsLoading && (
          <div className="panel">Loading your playlists...</div>
        )}

        {!playlistsLoading && playlists.length === 0 && (
          <div className="panel empty-learning">
            <div className="empty-icon">
              <BookOpen size={25} />
            </div>
            <h2>No playlists added yet</h2>
            <p>
              Add a playlist above to create your learning schedule.
            </p>
          </div>
        )}

        {playlists.map((playlist) => {
          const completedCount = playlist.videos.filter(
            (video) => video.completed,
          ).length;

          const remainingVideos = playlist.videos.filter(
            (video) => !video.completed,
          );

          const progress = playlist.videos.length
            ? (completedCount / playlist.videos.length) * 100
            : 0;

          return (
            <section
              className="panel playlist-panel"
              key={playlist.id}
            >
              <div className="panel-heading">
                <div>
                  <h2>{playlist.title}</h2>
                  <p>
                    {completedCount} of {playlist.videos.length} videos
                    completed
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <a
                    className="secondary-button"
                    href={playlist.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open YouTube <ExternalLink size={14} />
                  </a>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() => removePlaylist(playlist.id)}
                  >
                    Delete playlist
                  </button>
                </div>
              </div>

              <div className="playlist-progress">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="video-schedule">
                {playlist.videos.map((video) => {
                  const remainingIndex = remainingVideos.findIndex(
                    (item) => item.id === video.id,
                  );

                  const scheduledDate = video.completed
                    ? "Completed"
                    : getScheduledDate(
                        getTodayString() > playlist.startDate
                          ? getTodayString()
                          : playlist.startDate,
                        remainingIndex,
                        playlist.videosPerDay,
                      );

                  return (
                    <article className="video-row" key={video.id}>
                      <button
                        type="button"
                        className={`video-check ${
                          video.completed ? "checked" : ""
                        }`}
                        onClick={() =>
                          toggleVideo(playlist.id, video.id)
                        }
                        aria-label={
                          video.completed
                            ? "Mark video incomplete"
                            : "Mark video complete"
                        }
                      >
                        {video.completed && <Check size={15} />}
                      </button>

                      <div className="video-details">
                        <strong>{video.title}</strong>
                        <span>{video.duration} min</span>
                      </div>

                      <span
                        className={`video-date ${
                          video.completed ? "completed-date" : ""
                        }`}
                      >
                        {scheduledDate}
                      </span>
                    </article>
                  );
                })}
              </div>

              {completedCount === playlist.videos.length && (
                <div className="completion-message">
                  <Check size={16} />
                  Playlist plan completed!
                </div>
              )}
            </section>
          );
        })}
      </section>
    </>
  );
}
