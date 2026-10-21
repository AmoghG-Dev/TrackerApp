
import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CloudSync,
  LoaderCircle,
  RefreshCw,
  Unplug,
} from "lucide-react";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  syncGoogleCalendar,
  type GoogleCalendarSyncResult,
} from "../services/googleCalendarApi";
import "./GoogleCalendar.css";

export default function GoogleCalendar() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(30);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [codeforces, setCodeforces] = useState(true);
  const [leetcode, setLeetcode] = useState(true);
  const [autoSync, setAutoSync] = useState(false);
  const [result, setResult] =
    useState<GoogleCalendarSyncResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshStatus = useCallback(async () => {
    setLoading(true);

    try {
      const status = await getGoogleCalendarStatus();
      setConnected(status.connected);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load Google Calendar status.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();

    const params = new URLSearchParams(window.location.search);

    if (params.get("calendar_connected") === "true") {
      setMessage("Google Calendar connected successfully.");
      window.history.replaceState(
        {},
        "",
        window.location.pathname,
      );
    } else if (params.has("calendar_error")) {
      setError("Google authorization was not completed.");
      window.history.replaceState(
        {},
        "",
        window.location.pathname,
      );
    }
  }, [refreshStatus]);

  async function handleConnect() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await connectGoogleCalendar();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start Google authorization.",
      );
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      "Disconnect Google Calendar? Existing calendar events will remain in your calendar.",
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await disconnectGoogleCalendar();
      setConnected(false);
      setResult(null);
      setAutoSync(false);
      setMessage(
        "Google Calendar disconnected. Existing events were left untouched.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to disconnect Google Calendar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    if (!connected) {
      setError("Connect Google Calendar before syncing.");
      return;
    }

    if (!codeforces && !leetcode) {
      setError("Select at least one contest platform.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);

    try {
      // The current backend sync endpoint syncs both platforms.
      // Platform-specific selection will be wired in the next step.
      const syncResult = await syncGoogleCalendar(
        days,
        reminderMinutes,
      );

      setResult(syncResult);

      if (syncResult.errors.length) {
        setMessage(
          "Sync finished, but some contests could not be synchronized.",
        );
      } else {
        setMessage("Contest synchronization completed.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Contest synchronization failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="calendar-page">
      <header className="calendar-page-header">
        <div>
          <p className="calendar-eyebrow">INTEGRATIONS</p>
          <h1>Google Calendar</h1>
          <p className="calendar-subtitle">
            Keep your upcoming coding contests on your calendar.
            Connect or disconnect whenever you choose.
          </p>
        </div>

        <div className="calendar-header-icon">
          <CalendarDays size={26} />
        </div>
      </header>

      {message && (
        <div className="calendar-notice calendar-notice-success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="calendar-notice calendar-notice-error">
          <CircleAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="calendar-card">
        <div className="calendar-connection-row">
          <div className="calendar-service-icon">
            <CalendarDays size={25} />
          </div>

          <div className="calendar-connection-copy">
            <h2>Google Calendar connection</h2>
            <p>
              {loading
                ? "Checking connection..."
                : connected
                  ? "Your Google Calendar is connected."
                  : "Not connected. Calendar access stays disabled until you connect."}
            </p>
          </div>

          <span
            className={`calendar-status ${
              connected ? "is-connected" : "is-disconnected"
            }`}
          >
            {loading
              ? "Checking"
              : connected
                ? "Connected"
                : "Disconnected"}
          </span>
        </div>

        <div className="calendar-card-actions">
          {connected ? (
            <button
              className="calendar-button calendar-button-secondary"
              onClick={handleDisconnect}
              disabled={loading || busy}
            >
              {busy ? (
                <LoaderCircle className="calendar-spinner" size={17} />
              ) : (
                <Unplug size={17} />
              )}
              Disconnect
            </button>
          ) : (
            <button
              className="calendar-button calendar-button-primary"
              onClick={handleConnect}
              disabled={loading || busy}
            >
              {busy ? (
                <LoaderCircle className="calendar-spinner" size={17} />
              ) : (
                <CalendarDays size={17} />
              )}
              Connect Google Calendar
            </button>
          )}

          <button
            className="calendar-button calendar-button-secondary"
            onClick={() => void refreshStatus()}
            disabled={loading || busy}
          >
            <RefreshCw size={16} />
            Refresh status
          </button>
        </div>
      </section>

      <section className="calendar-card">
        <div className="calendar-section-heading">
          <div>
            <h2>Contest sync preferences</h2>
            <p>
              Configure which contests to include and when reminders
              should appear.
            </p>
          </div>
          <CloudSync size={23} />
        </div>

        <div className="calendar-platform-list">
          <label className="calendar-option">
            <input
              type="checkbox"
              checked={codeforces}
              onChange={(event) =>
                setCodeforces(event.target.checked)
              }
            />
            <span>
              <strong>Codeforces</strong>
              <small>Upcoming programming contests</small>
            </span>
          </label>

          <label className="calendar-option">
            <input
              type="checkbox"
              checked={leetcode}
              onChange={(event) =>
                setLeetcode(event.target.checked)
              }
            />
            <span>
              <strong>LeetCode</strong>
              <small>Upcoming coding contests</small>
            </span>
          </label>
        </div>

        <div className="calendar-settings-grid">
          <label className="calendar-field">
            <span>Sync horizon</span>
            <select
              value={days}
              onChange={(event) =>
                setDays(Number(event.target.value))
              }
            >
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option>
            </select>
          </label>

          <label className="calendar-field">
            <span>Reminder before contest</span>
            <select
              value={reminderMinutes}
              onChange={(event) =>
                setReminderMinutes(Number(event.target.value))
              }
            >
              <option value={0}>At contest start</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
          </label>
        </div>

        <label className="calendar-auto-sync">
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(event) =>
              setAutoSync(event.target.checked)
            }
          />
          <span>
            <strong>Automatic synchronization</strong>
            <small>
              Enable automatic contest syncing when supported by
              the backend scheduler.
            </small>
          </span>
        </label>

        <div className="calendar-card-actions">
          <button
            className="calendar-button calendar-button-primary"
            onClick={handleSync}
            disabled={!connected || loading || busy}
          >
            {busy ? (
              <LoaderCircle className="calendar-spinner" size={17} />
            ) : (
              <RefreshCw size={17} />
            )}
            Sync Now
          </button>

          {!connected && (
            <span className="calendar-inline-hint">
              Connect Google Calendar to enable syncing.
            </span>
          )}
        </div>
      </section>

      {result && (
        <section className="calendar-card">
          <h2>Last sync result</h2>

          <div className="calendar-result-grid">
            <div>
              <strong>{result.checked}</strong>
              <span>Contests checked</span>
            </div>
            <div>
              <strong>{result.created}</strong>
              <span>Events created</span>
            </div>
            <div>
              <strong>{result.updated}</strong>
              <span>Events updated</span>
            </div>
            <div>
              <strong>{result.errors.length}</strong>
              <span>Errors</span>
            </div>
          </div>

          {result.errors.length > 0 && (
            <ul className="calendar-error-list">
              {result.errors.map((item, index) => (
                <li key={`${item.contest}-${index}`}>
                  <strong>{item.contest}:</strong> {item.message}
                </li>
              ))}
            </ul>
          )}

          <p className="calendar-last-sync">
            Last attempted: {new Date(result.synced_at).toLocaleString()}
          </p>
        </section>
      )}
    </main>
  );
}
