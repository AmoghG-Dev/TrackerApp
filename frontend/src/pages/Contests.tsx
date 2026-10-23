import { useEffect, useState } from "react";
import {
  CalendarSync,
  ExternalLink,
  Plus,
} from "lucide-react";
import {
  fetchContests,
  type Contest,
  type ContestFilter,
} from "../services/contestsApi";
import {
  addPlatform,
  getSupportedPlatforms,
  getUserPlatforms,
  type SupportedPlatform,
  type UserPlatform,
} from "../services/platformsApi";
import { syncGoogleCalendar } from "../services/googleCalendarApi";
import "./Contests.css";

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
  const [platforms, setPlatforms] = useState<UserPlatform[]>([]);
  const [supportedPlatforms, setSupportedPlatforms] = useState<SupportedPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  // Quick Add Platform modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState("leetcode");
  const [newName, setNewName] = useState("LeetCode");
  const [newWebsite, setNewWebsite] = useState("https://leetcode.com");
  const [newHandle, setNewHandle] = useState("");
  const [addingPlatform, setAddingPlatform] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadContestsAndPlatforms() {
      setLoading(true);
      setError("");

      try {
        const [result, userPlats, supported] = await Promise.all([
          fetchContests(filter, 50),
          getUserPlatforms(),
          getSupportedPlatforms(),
        ]);

        if (!cancelled) {
          setContests(result.contests);
          setPlatforms(userPlats);
          setSupportedPlatforms(supported);
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

    void loadContestsAndPlatforms();

    return () => {
      cancelled = true;
    };
  }, [filter, refreshKey]);

  async function handleQuickCalendarSync() {
    setSyncingCalendar(true);
    setNotice("");
    setError("");

    try {
      const res = await syncGoogleCalendar(30, 15);
      setNotice(
        `Synced with Google Calendar! Created: ${res.created}, Updated: ${res.updated}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not sync contests to Google Calendar. Make sure it is connected.",
      );
    } finally {
      setSyncingCalendar(false);
    }
  }

  function handlePlatformSelect(key: string) {
    setNewKey(key);
    const found = supportedPlatforms.find((p) => p.key === key);
    if (found) {
      setNewName(found.name);
      setNewWebsite(found.website);
    }
  }

  async function handleAddPlatformSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newHandle.trim()) return;

    setAddingPlatform(true);
    try {
      const added = await addPlatform({
        name: newName,
        website: newWebsite,
        handle: newHandle.trim(),
        platform_key: newKey,
        sync_contests: true,
      });

      setPlatforms((curr) => [added, ...curr]);
      setShowAddModal(false);
      setNewHandle("");
      setNotice(`Platform '${added.name}' added with status: ${added.status}`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add platform.");
    } finally {
      setAddingPlatform(false);
    }
  }

  // Determine dynamic filters
  const filterOptions = [
    { label: "All Platforms", value: "all" },
    { label: "Codeforces", value: "codeforces" },
    { label: "LeetCode", value: "leetcode" },
    { label: "AtCoder", value: "atcoder" },
  ];

  return (
    <main className="contests-page">
      <div className="contests-header">
        <div>
          <h1>Contests</h1>
          <p>
            Find upcoming programming contests from your configured platforms and plan ahead.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={handleQuickCalendarSync}
            disabled={syncingCalendar}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <CalendarSync size={15} />
            {syncingCalendar ? "Syncing..." : "Sync Calendar"}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowAddModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={15} />
            Add Platform
          </button>

          <button
            type="button"
            className="contest-refresh-button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {notice && (
        <div className="google-calendar-alert success" role="status" style={{ marginBottom: "16px" }}>
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="google-calendar-alert error" role="alert" style={{ marginBottom: "16px" }}>
          <span>{error}</span>
        </div>
      )}

      <div className="contest-summary">
        <div className="contest-summary-card">
          <span className="contest-summary-label">Upcoming contests</span>
          <strong>{loading ? "—" : contests.length}</strong>
          <span className="contest-summary-caption">Matching your filter</span>
        </div>

        <div className="contest-summary-card">
          <span className="contest-summary-label">Configured Platforms</span>
          <strong>{platforms.length > 0 ? platforms.length : "Default (3)"}</strong>
          <span className="contest-summary-caption">
            {platforms.length > 0
              ? platforms.map((p) => p.name).join(", ")
              : "Codeforces, LeetCode, AtCoder"}
          </span>
        </div>
      </div>

      <div className="contest-list-header">
        <div>
          <h2>Upcoming schedule</h2>
          <p>Start times are shown in your local timezone.</p>
        </div>

        <div className="contest-filters" aria-label="Filter contests">
          {filterOptions.map((item) => (
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
            There may be no scheduled contests for this filter right now. Try refreshing later.
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
                      contest.platform.toLowerCase() === "codeforces"
                        ? "codeforces"
                        : contest.platform.toLowerCase() === "atcoder"
                          ? "atcoder"
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
                View contest <ExternalLink size={13} style={{ marginLeft: "4px" }} />
              </a>
            </article>
          ))}
        </div>
      )}

      {/* Quick Add Platform Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Connect Coding Platform</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowAddModal(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddPlatformSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Platform</span>
                <select
                  value={newKey}
                  onChange={(e) => handlePlatformSelect(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                >
                  {supportedPlatforms.map((sp) => (
                    <option key={sp.key} value={sp.key}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Handle / Username *</span>
                <input
                  type="text"
                  required
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="e.g. tourist"
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={addingPlatform}
                >
                  {addingPlatform ? "Validating..." : "Add Platform"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
