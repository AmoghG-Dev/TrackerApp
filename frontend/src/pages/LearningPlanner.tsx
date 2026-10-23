import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  BookOpen,
  CalendarDays,
  CalendarSync,
  Check,
  ExternalLink,
  Trash2,
  X,
} from "lucide-react";

import {
  getPlaylists,
  createPlaylist,
  updateVideoCompletion,
  deletePlaylist,
  reschedulePlaylist,
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

  // Reschedule Modal States
  const [rescheduleTarget, setRescheduleTarget] =
    useState<LearningPlaylist | null>(null);
  const [newStartDate, setNewStartDate] = useState(getTodayString());
  const [newPace, setNewPace] = useState(2);
  const [rescheduling, setRescheduling] = useState(false);

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

  function openRescheduleModal(playlist: LearningPlaylist) {
    setRescheduleTarget(playlist);
    setNewStartDate(getTodayString());
    setNewPace(playlist.videosPerDay || 2);
  }

  async function handleConfirmReschedule(e: FormEvent) {
    e.preventDefault();
    if (!rescheduleTarget) return;

    setRescheduling(true);
    try {
      const updated = await reschedulePlaylist(
        rescheduleTarget.id,
        newStartDate,
        newPace,
      );

      setPlaylists((curr) =>
        curr.map((p) => (p.id === rescheduleTarget.id ? updated : p)),
      );
      setNotice(`Rescheduled '${rescheduleTarget.title}' starting from ${newStartDate}.`);
      setRescheduleTarget(null);
    } catch (err) {
      setNotice(
        err instanceof Error
          ? `Reschedule failed: ${err.message}`
          : "Failed to reschedule playlist.",
      );
    } finally {
      setRescheduling(false);
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
            Plan your videos, track completion, and reschedule smoothly when life happens.
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
              <div
                className="panel-heading"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ minWidth: "220px", flex: "1 1 auto" }}>
                  <h2 style={{ wordBreak: "break-word" }}>{playlist.title}</h2>
                  <p style={{ color: "#8798af", fontSize: "11px", marginTop: "2px" }}>
                    {completedCount} of {playlist.videos.length} videos completed &bull; {playlist.videosPerDay} videos/day
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openRescheduleModal(playlist)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <CalendarSync size={14} /> Reschedule
                  </button>

                  <a
                    className="secondary-button"
                    href={playlist.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    YouTube <ExternalLink size={13} />
                  </a>

                  <button
                    type="button"
                    className="action-icon-button danger"
                    onClick={() => removePlaylist(playlist.id)}
                    title="Delete playlist"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="playlist-progress" style={{ marginTop: "10px" }}>
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
                        playlist.startDate || getTodayString(),
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

                      <div className="video-details" style={{ minWidth: 0 }}>
                        <strong style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                          {video.title}
                        </strong>
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

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Reschedule Study Plan</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setRescheduleTarget(null)}
              >
                &times;
              </button>
            </div>

            <p style={{ color: "#94a3b8", fontSize: "12px", marginTop: "6px" }}>
              Reset the starting date or adjust your daily pace for <strong>{rescheduleTarget.title}</strong>.
            </p>

            <form onSubmit={handleConfirmReschedule} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>New Start Date</span>
                <input
                  type="date"
                  required
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Daily Pace (Videos Per Day)</span>
                <select
                  value={newPace}
                  onChange={(e) => setNewPace(Number(e.target.value))}
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                >
                  <option value={1}>1 video per day</option>
                  <option value={2}>2 videos per day</option>
                  <option value={3}>3 videos per day</option>
                  <option value={4}>4 videos per day</option>
                </select>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setRescheduleTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={rescheduling}
                >
                  {rescheduling ? "Updating schedule..." : "Confirm Reschedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
