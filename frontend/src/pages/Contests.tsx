
import { useEffect, useState } from "react";
import {
  fetchContests,
  type Contest,
  type ContestFilter,
} from "../services/contestsApi";
import "./Contests.css";

const FILTERS: { label: string; value: ContestFilter }[] = [
  { label: "All Platforms", value: "all" },
  { label: "Codeforces", value: "codeforces" },
  { label: "LeetCode", value: "leetcode" },
];

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatCountdown(timestamp: number, now: number): string {
  const difference = timestamp - now;

  if (difference <= 0) return "Starting soon";

  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `In ${days}d ${hours}h`;
  if (hours > 0) return `In ${hours}h ${minutes}m`;
  return `In ${minutes}m`;
}

function formatStartTime(startTime: string): string {
  return new Date(startTime).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Contests() {
  const [filter, setFilter] = useState<ContestFilter>("all");
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadContests() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchContests(filter, 50);

        if (!cancelled) {
          setContests(result.contests);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load contests. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadContests();

    return () => {
      cancelled = true;
    };
  }, [filter, refreshKey]);

  return (
    <main className="contests-page">
      <div className="contests-header">
        <div>
          <h1>Contests</h1>
          <p>
            Find upcoming programming contests and plan your practice.
          </p>
        </div>

        <button
          type="button"
          className="contest-refresh-button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="contest-summary">
        <div className="contest-summary-card">
          <span className="contest-summary-label">Upcoming contests</span>
          <strong>{loading ? "—" : contests.length}</strong>
          <span className="contest-summary-caption">Matching your filter</span>
        </div>

        <div className="contest-summary-card">
          <span className="contest-summary-label">Platforms</span>
          <strong>2</strong>
          <span className="contest-summary-caption">
            Codeforces and LeetCode
          </span>
        </div>
      </div>

      <div className="contest-list-header">
        <div>
          <h2>Upcoming schedule</h2>
          <p>Start times are shown in your local timezone.</p>
        </div>

        <div className="contest-filters" aria-label="Filter contests">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item.value}
              className={
                filter === item.value
                  ? "contest-filter active"
                  : "contest-filter"
              }
              onClick={() => setFilter(item.value)}
              aria-pressed={filter === item.value}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="contest-message">
          Loading upcoming contests...
        </div>
      )}

      {!loading && error && (
        <div className="contest-message contest-error" role="alert">
          <strong>Unable to load contests</strong>
          <p>{error}</p>
          <button
            type="button"
            className="contest-retry-button"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && contests.length === 0 && (
        <div className="contest-message">
          <strong>No upcoming contests found</strong>
          <p>
            There may be no scheduled contests, or a platform may not have
            returned its contest data. Try refreshing later.
          </p>
        </div>
      )}

      {!loading && !error && contests.length > 0 && (
        <div className="contest-list">
          {contests.map((contest) => (
            <article
              className="contest-card"
              key={`${contest.platform}-${contest.id}`}
            >
              <div className="contest-card-main">
                <div className="contest-card-title-row">
                  <span
                    className={`contest-platform ${
                      contest.platform === "Codeforces"
                        ? "codeforces"
                        : "leetcode"
                    }`}
                  >
                    {contest.platform}
                  </span>
                  <span className="contest-countdown">
                    {formatCountdown(contest.start_timestamp * 1000, now)}
                  </span>
                </div>

                <h3>{contest.name}</h3>

                <div className="contest-details">
                  <span>{formatStartTime(contest.start_time)}</span>
                  <span>
                    Duration: {formatDuration(contest.duration_seconds)}
                  </span>
                </div>
              </div>

              <a
                className="contest-open-link"
                href={contest.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View contest <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
