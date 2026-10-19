
import { Bell, ChevronRight, X } from "lucide-react";

interface TopbarProps {
  activePage: string;
  onNotify: () => void;
}

export default function Topbar({
  activePage,
  onNotify,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Workspace</span>
        <ChevronRight size={15} />
        <strong>{activePage}</strong>
      </div>

      <div className="topbar-actions">
        <span className="local-badge">
          <span className="status-dot" />
          MongoDB connected flow
        </span>

        <button
          className="icon-button"
          aria-label="Notifications"
          onClick={onNotify}
        >
          <Bell size={19} />
        </button>

        <div className="avatar">A</div>
      </div>
    </header>
  );
}

export function Notice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  if (!message) return null;

  return (
    <div className="notice" role="status">
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss notification">
        <X size={16} />
      </button>
    </div>
  );
}
