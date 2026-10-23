import { useState } from "react";

import {
  BookOpen,
  CalendarDays,
  CalendarCheck,
  ChartNoAxesCombined,
  CircleUserRound,
  Code2,
  LayoutDashboard,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

import "./Sidebar.css";

interface SidebarProps {
  activePage: string;
  solved: number;
  progress: number;
  onNavigate: (page: string) => void;
  userName?: string;
  userEmail?: string;
  onProfileClick?: () => void;
  onCollapseChange?: (collapsed: boolean) => void;
  onLogout?: () => void;
  loggingOut?: boolean;
}

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "DSA Tracker", icon: Code2 },
  { label: "Contests", icon: CalendarDays },
  { label: "Google Calendar", icon: CalendarCheck },
  { label: "Learning (YouTube)", icon: BookOpen },
  { label: "Analytics", icon: ChartNoAxesCombined },
  { label: "Profile", icon: CircleUserRound },
  { label: "Settings", icon: Settings },
];

export default function Sidebar({
  activePage,
  onNavigate,
  userName = "Amogh Gupta",
  userEmail = "your-email@example.com",
  onProfileClick,
  onCollapseChange,
  onLogout,
  loggingOut = false,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Avoid displaying generic placeholders or an email address as the user's name.
  // Pass the authenticated user's actual name through userName when available.
  const displayName =
    userName.trim() &&
    userName.trim().toLowerCase() !== "user" &&
    !userName.includes("@")
      ? userName.trim()
      : "Amogh Gupta";

  // Initials use the first character of the first and last name.
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const initials =
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (nameParts[0]?.slice(0, 2) || "AG").toUpperCase();

  const toggleSidebar = () => {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    onCollapseChange?.(nextCollapsed);
  };

  return (
    <aside
      className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}
      data-collapsed={collapsed}
    >
      <div className="sidebar-header">
        <button
          type="button"
          className="brand"
          onClick={() => onNavigate("Dashboard")}
          aria-label="Go to dashboard"
          title="TrackerApp"
        >
          <span className="brand-icon" aria-hidden="true" />

          <span className="brand-text">
            <span className="brand-tracker">Tracker</span>
            <span className="brand-app">App</span>
          </span>
        </button>

        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={20} strokeWidth={2.5} />
          ) : (
            <span className="collapse-double" aria-hidden="true">
              <ChevronLeft size={20} strokeWidth={2.7} />
              <ChevronLeft size={20} strokeWidth={2.7} />
            </span>
          )}
        </button>
      </div>

      <div className="nav-label">WORKSPACE</div>

      <nav className="navigation" aria-label="Main navigation">
        {navigation.map(({ label, icon: Icon }) => {
          const isActive = activePage === label;

          return (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate(label)}
              className={`nav-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={2.2} />
              <span className="nav-item-label">{label}</span>

              {isActive && (
                <span className="active-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="profile-panel">
          <button
            type="button"
            className="sidebar-profile"
            onClick={onProfileClick ?? (() => onNavigate("Profile"))}
            aria-label={`Open profile for ${displayName}`}
            title={collapsed ? displayName : undefined}
          >
            <span className="profile-avatar" aria-hidden="true">
              {initials}
            </span>

            <span className="profile-info">
              <span className="profile-name">{displayName}</span>
              <span className="profile-email">{userEmail}</span>
            </span>

            <ChevronDown
              className="profile-chevron"
              size={15}
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="sidebar-logout"
              title={collapsed ? "Sign out" : undefined}
              aria-label={loggingOut ? "Signing out" : "Sign out"}
            >
              <LogOut size={18} strokeWidth={2.4} />
              <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
