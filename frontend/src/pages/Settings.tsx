import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarSync,
  Check,
  CheckCircle2,
  Code2,
  Plus,
  RefreshCw,
  Save,
  Sliders,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  getUserPreferences,
  updateUserPreferences,
  type UserPreferences,
} from "../services/preferencesApi";
import {
  addPlatform,
  deletePlatform,
  getSupportedPlatforms,
  getUserPlatforms,
  testPlatform,
  updatePlatform,
  type SupportedPlatform,
  type UserPlatform,
} from "../services/platformsApi";

export default function Settings() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [platforms, setPlatforms] = useState<UserPlatform[]>([]);
  const [supportedPlatforms, setSupportedPlatforms] = useState<
    SupportedPlatform[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Preference Form States
  const [dailyTarget, setDailyTarget] = useState(3);
  const [prefDifficulty, setPrefDifficulty] = useState("all");
  const [autoSync, setAutoSync] = useState(false);
  const [syncIntervalHours, setSyncIntervalHours] = useState(6);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [syncHorizonDays, setSyncHorizonDays] = useState(30);
  const [refreshIntervalMinutes, setRefreshIntervalMinutes] = useState(30);

  // Add Platform Modal States
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [platformKey, setPlatformKey] = useState("leetcode");
  const [platformName, setPlatformName] = useState("LeetCode");
  const [platformWebsite, setPlatformWebsite] = useState("https://leetcode.com");
  const [platformHandle, setPlatformHandle] = useState("");
  const [platformAuthToken, setPlatformAuthToken] = useState("");
  const [platformSyncContests, setPlatformSyncContests] = useState(true);
  const [addingPlatform, setAddingPlatform] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [prefsData, platformsData, supportedData] = await Promise.all([
          getUserPreferences(),
          getUserPlatforms(),
          getSupportedPlatforms(),
        ]);
        if (!cancelled) {
          setPreferences(prefsData);
          setPlatforms(platformsData);
          setSupportedPlatforms(supportedData);

          setDailyTarget(prefsData.daily_target);
          setPrefDifficulty(prefsData.preferred_difficulty);
          setAutoSync(prefsData.auto_sync_calendar);
          setSyncIntervalHours(prefsData.calendar_sync_interval_hours);
          setReminderMinutes(prefsData.calendar_reminder_minutes);
          setSyncHorizonDays(prefsData.calendar_sync_horizon_days);
          setRefreshIntervalMinutes(prefsData.contest_refresh_interval_minutes);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load settings.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSavePreferences(e: FormEvent) {
    e.preventDefault();
    setSavingPrefs(true);
    setNotice("");
    setError("");

    try {
      const updated = await updateUserPreferences({
        daily_target: dailyTarget,
        preferred_difficulty: prefDifficulty,
        auto_sync_calendar: autoSync,
        calendar_sync_interval_hours: syncIntervalHours,
        calendar_reminder_minutes: reminderMinutes,
        calendar_sync_horizon_days: syncHorizonDays,
        contest_refresh_interval_minutes: refreshIntervalMinutes,
      });
      setPreferences(updated);
      setNotice("Preferences saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update preferences.",
      );
    } finally {
      setSavingPrefs(false);
    }
  }

  function handleSelectPlatformKey(key: string) {
    setPlatformKey(key);
    const found = supportedPlatforms.find((p) => p.key === key);
    if (found) {
      setPlatformName(found.name);
      setPlatformWebsite(found.website);
    } else {
      setPlatformName("");
      setPlatformWebsite("");
    }
  }

  async function handleAddPlatform(e: FormEvent) {
    e.preventDefault();
    if (!platformHandle.trim()) {
      setError("Please enter a username or handle.");
      return;
    }

    setAddingPlatform(true);
    setError("");
    setNotice("");

    try {
      const created = await addPlatform({
        name: platformName || platformKey,
        website: platformWebsite,
        handle: platformHandle.trim(),
        platform_key: platformKey,
        auth_token: platformAuthToken.trim() || undefined,
        sync_contests: platformSyncContests,
      });

      setPlatforms((curr) => [created, ...curr]);
      setShowAddPlatform(false);
      setPlatformHandle("");
      setPlatformAuthToken("");
      setNotice(`Platform '${created.name}' added with status: ${created.status}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add platform.",
      );
    } finally {
      setAddingPlatform(false);
    }
  }

  async function handleTestPlatform(id: string) {
    setTestingId(id);
    setNotice("");
    setError("");

    try {
      const res = await testPlatform(id);
      setPlatforms((curr) =>
        curr.map((p) =>
          p.id === id
            ? {
                ...p,
                status: res.status as "active" | "error",
                status_message: res.message,
                details: res.details,
              }
            : p,
        ),
      );
      if (res.success) {
        setNotice(res.message);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Connection test failed.",
      );
    } finally {
      setTestingId(null);
    }
  }

  async function handleToggleSync(p: UserPlatform) {
    try {
      const updated = await updatePlatform(p.id, {
        sync_contests: !p.sync_contests,
      });
      setPlatforms((curr) => curr.map((x) => (x.id === p.id ? updated : x)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to toggle contest sync.",
      );
    }
  }

  async function handleDeletePlatform(id: string, name: string) {
    if (!window.confirm(`Remove '${name}' from your configured platforms?`)) return;

    try {
      await deletePlatform(id);
      setPlatforms((curr) => curr.filter((p) => p.id !== id));
      setNotice(`Platform '${name}' removed.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove platform.",
      );
    }
  }

  if (loading) {
    return (
      <div className="panel" style={{ padding: "40px", textAlign: "center" }}>
        <p style={{ color: "#94a3b8" }}>Loading settings and integrations...</p>
      </div>
    );
  }

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">PREFERENCES & PLATFORMS</div>
          <h1>
            Settings<span className="blue-period">.</span>
          </h1>
          <p className="subtitle">
            Configure daily targets, automated sync intervals, and dynamic coding platform adapters.
          </p>
        </div>
        <span className="local-badge">MongoDB Preserved</span>
      </section>

      {notice && (
        <div className="google-calendar-alert success" role="status" style={{ marginBottom: "16px" }}>
          <Check size={18} />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="google-calendar-alert error" role="alert" style={{ marginBottom: "16px" }}>
          <span>{error}</span>
        </div>
      )}

      {/* Preferences Form */}
      <form onSubmit={handleSavePreferences}>
        <section className="dashboard-grid">
          {/* Practice Preferences */}
          <div className="panel question-panel">
            <div className="panel-heading">
              <div>
                <h2>Practice Preferences</h2>
                <p>Customize daily goals and question difficulty</p>
              </div>
              <Sliders size={20} className="muted-icon" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Daily Problem Target</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={dailyTarget}
                  onChange={(e) => setDailyTarget(Number(e.target.value))}
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    width: "120px",
                  }}
                />
                <span style={{ color: "#64748b", fontSize: "11px" }}>Recommended: 3 problems per day</span>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Preferred Difficulty</span>
                <select
                  value={prefDifficulty}
                  onChange={(e) => setPrefDifficulty(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                >
                  <option value="all">Balanced (All Difficulties)</option>
                  <option value="easy">Easy Focus</option>
                  <option value="medium">Medium Focus</option>
                  <option value="hard">Hard Focus</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Contest Feed Auto-Refresh</span>
                <select
                  value={refreshIntervalMinutes}
                  onChange={(e) => setRefreshIntervalMinutes(Number(e.target.value))}
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                >
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every 1 hour</option>
                  <option value={120}>Every 2 hours</option>
                </select>
              </label>
            </div>
          </div>

          {/* Calendar Automation */}
          <div className="panel progress-panel">
            <div className="panel-heading">
              <div>
                <h2>Calendar Automation</h2>
                <p>Background sync and reminder intervals</p>
              </div>
              <CalendarSync size={20} className="muted-icon" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "#38bdf8" }}
                />
                <div>
                  <strong style={{ color: "#f8fafc", fontSize: "13px", display: "block" }}>
                    Enable Automatic Google Calendar Sync
                  </strong>
                  <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>
                    Periodically sync contests from enabled platforms in the background
                  </span>
                  {preferences?.last_auto_sync_at && (
                    <span style={{ color: "#38bdf8", fontSize: "11px", display: "block", marginTop: "2px" }}>
                      Last auto-sync: {new Date(preferences.last_auto_sync_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Auto-Sync Interval</span>
                <select
                  value={syncIntervalHours}
                  disabled={!autoSync}
                  onChange={(e) => setSyncIntervalHours(Number(e.target.value))}
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    opacity: autoSync ? 1 : 0.6,
                  }}
                >
                  <option value={1}>Every 1 hour</option>
                  <option value={3}>Every 3 hours</option>
                  <option value={6}>Every 6 hours</option>
                  <option value={12}>Every 12 hours</option>
                  <option value={24}>Every 24 hours</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Calendar Event Reminder</span>
                <select
                  value={reminderMinutes}
                  onChange={(e) => setReminderMinutes(Number(e.target.value))}
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                >
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Sync Horizon</span>
                <select
                  value={syncHorizonDays}
                  onChange={(e) => setSyncHorizonDays(Number(e.target.value))}
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                >
                  <option value={7}>Next 7 days</option>
                  <option value={14}>Next 14 days</option>
                  <option value={30}>Next 30 days</option>
                  <option value={60}>Next 60 days</option>
                  <option value={90}>Next 90 days</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <div style={{ marginTop: "16px" }}>
          <button
            type="submit"
            className="primary-button"
            disabled={savingPrefs}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Save size={16} />
            {savingPrefs ? "Saving preferences..." : "Save Preferences"}
          </button>
        </div>
      </form>

      {/* Dynamic Coding Platforms Section */}
      <section className="panel" style={{ marginTop: "24px" }}>
        <div className="panel-heading">
          <div>
            <h2>Dynamic Coding Platforms</h2>
            <p>Connect and configure platform adapters (LeetCode, Codeforces, AtCoder, Custom)</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowAddPlatform(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={16} /> Add Platform
          </button>
        </div>

        {platforms.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
            <Code2 size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <p>No platforms configured yet. Click &apos;Add Platform&apos; above to integrate your coding accounts.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
            {platforms.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  background: "#0c1523",
                  border: `1px solid ${p.status === "active" ? "#1e334a" : "#451a1a"}`,
                  borderRadius: "8px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "220px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "#16253b",
                      display: "grid",
                      placeItems: "center",
                      color: p.status === "active" ? "#4adea0" : "#f87171",
                    }}
                  >
                    {p.status === "active" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ color: "#f8fafc", fontSize: "14px" }}>{p.name}</strong>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: p.status === "active" ? "rgba(74, 222, 160, 0.15)" : "rgba(248, 113, 113, 0.15)",
                          color: p.status === "active" ? "#4adea0" : "#f87171",
                          fontWeight: 600,
                        }}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
                      @{p.handle} {p.website && <span>&bull; {p.website}</span>}
                    </div>

                    {p.status_message && (
                      <div style={{ color: p.status === "active" ? "#86efac" : "#fca5a5", fontSize: "11px", marginTop: "2px" }}>
                        {p.status_message}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleToggleSync(p)}
                    style={{ fontSize: "12px", padding: "6px 10px" }}
                  >
                    Contest Sync: {p.sync_contests ? "ON" : "OFF"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleTestPlatform(p.id)}
                    disabled={testingId === p.id}
                    style={{ fontSize: "12px", padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <RefreshCw size={13} className={testingId === p.id ? "spin" : ""} />
                    {testingId === p.id ? "Testing..." : "Test Connection"}
                  </button>

                  <button
                    type="button"
                    className="action-icon-button danger"
                    onClick={() => handleDeletePlatform(p.id, p.name)}
                    title="Remove platform"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Platform Modal */}
      {showAddPlatform && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Add Coding Platform</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowAddPlatform(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddPlatform} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Platform Type</span>
                <select
                  value={platformKey}
                  onChange={(e) => handleSelectPlatformKey(e.target.value)}
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
                      {sp.name} {sp.has_contests ? "(Contests Supported)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Display Name</span>
                <input
                  type="text"
                  required
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="e.g. LeetCode"
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
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Website URL</span>
                <input
                  type="url"
                  value={platformWebsite}
                  onChange={(e) => setPlatformWebsite(e.target.value)}
                  placeholder="https://leetcode.com"
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
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Username / Handle *</span>
                <input
                  type="text"
                  required
                  value={platformHandle}
                  onChange={(e) => setPlatformHandle(e.target.value)}
                  placeholder="e.g. your_handle"
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
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>API Token / Secret (Optional)</span>
                <input
                  type="password"
                  value={platformAuthToken}
                  onChange={(e) => setPlatformAuthToken(e.target.value)}
                  placeholder="Optional token for private endpoints"
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                <input
                  type="checkbox"
                  checked={platformSyncContests}
                  onChange={(e) => setPlatformSyncContests(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#38bdf8" }}
                />
                <span style={{ color: "#e2e8f0", fontSize: "12px" }}>
                  Aggregate & sync contests from this platform
                </span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowAddPlatform(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={addingPlatform}
                >
                  {addingPlatform ? "Validating & Adding..." : "Add Platform"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
