import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  Unlink,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  syncGoogleCalendar,
  type GoogleCalendarStatus,
  type GoogleCalendarSyncResult,
} from "../services/googleCalendarApi";
import "./GoogleCalendar.css";

export default function GoogleCalendar() {
  const [status, setStatus] = useState<GoogleCalendarStatus>({
    connected: false,
    connected_at: null,
  });
  const [days, setDays] = useState(30);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [syncResult, setSyncResult] =
    useState<GoogleCalendarSyncResult | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setStatus(await getGoogleCalendarStatus());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Google Calendar status.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

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
          : "Unable to connect Google Calendar.",
      );
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      "Disconnect Google Calendar and delete TrackerApp-managed contest events from your calendar? Other calendar events will not be affected.",
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");
    setSyncResult(null);

    try {
      const result = await disconnectGoogleCalendar();
      setMessage(
        result.message ||
          "Google Calendar disconnected. TrackerApp contest events have been removed from your calendar.",
      );
      await loadStatus();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to disconnect Google Calendar. Please try again.",
      );
      await loadStatus();
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    setError("");
    setMessage("");
    setSyncResult(null);

    try {
      const result = await syncGoogleCalendar(days, reminderMinutes);
      setSyncResult(result);

      if (result.errors.length > 0) {
        setMessage("Calendar sync completed with some errors.");
      } else {
        setMessage("Google Calendar sync completed successfully.");
      }

      await loadStatus();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sync calendar events.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="google-calendar-page">
      <header className="google-calendar-header">
        <div>
          <h1>Google Calendar</h1>
          <p>Sync upcoming coding contests to your Google Calendar.</p>
        </div>
        <CalendarDays size={32} />
      </header>

      {error && (
        <div className="google-calendar-alert error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="google-calendar-alert success" role="status">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      <section className="google-calendar-card">
        <h2>Connection status</h2>

        {loading ? (
          <p>Checking connection…</p>
        ) : (
          <>
            <p>
              Status:{" "}
              <strong>
                {status.connected ? "Connected" : "Not connected"}
              </strong>
            </p>

            {status.connected_at && (
              <p>
                Connected on:{" "}
                {new Date(status.connected_at).toLocaleString()}
              </p>
            )}

            {status.connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={busy || loading}
              >
                <Unlink size={16} />
                {busy ? "Please wait…" : "Disconnect"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={busy || loading}
              >
                <ExternalLink size={16} />
                {busy ? "Please wait…" : "Connect Google Calendar"}
              </button>
            )}
          </>
        )}
      </section>

      <section className="google-calendar-card">
        <h2>Sync contest reminders</h2>
        <p>
          Choose how far ahead to sync contests and when to receive reminders.
        </p>

        <label>
          Sync contests for
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            disabled={busy}
          >
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
          </select>
        </label>

        <label>
          Reminder before contest
          <select
            value={reminderMinutes}
            onChange={(event) =>
              setReminderMinutes(Number(event.target.value))
            }
            disabled={busy}
          >
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
          </select>
        </label>

        <button
          type="button"
          onClick={handleSync}
          disabled={busy || loading || !status.connected}
        >
          <RefreshCw size={16} />
          {busy ? "Please wait…" : "Sync calendar"}
        </button>

        {!status.connected && !loading && (
          <p>Connect Google Calendar before syncing contests.</p>
        )}

        {syncResult && (
          <div className="google-calendar-sync-result">
            <h3>Sync summary</h3>
            <p>Checked: {syncResult.checked}</p>
            <p>Created: {syncResult.created}</p>
            <p>Updated: {syncResult.updated}</p>
            <p>Skipped: {syncResult.skipped}</p>

            {syncResult.errors.length > 0 && (
              <>
                <h4>Events with errors</h4>
                <ul>
                  {syncResult.errors.map((item, index) => (
                    <li key={`${item.contest}-${index}`}>
                      {item.contest}: {item.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}