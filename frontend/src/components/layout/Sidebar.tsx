
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleUserRound,
  Code2,
  LayoutDashboard,
  Settings,
  Target,
} from "lucide-react";

interface SidebarProps {
  activePage: string;
  solved: number;
  progress: number;
  onNavigate: (page: string) => void;
}

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "DSA Tracker", icon: Code2 },
  { label: "Contests", icon: CalendarDays },
  { label: "Learning (YouTube)", icon: BookOpen },
  { label: "Analytics", icon: ChartNoAxesCombined },
  { label: "Profile", icon: CircleUserRound },
  { label: "Settings", icon: Settings },
];

export default function Sidebar({
  activePage,
  solved,
  progress,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <button
        className="brand"
        onClick={() => onNavigate("Dashboard")}
        aria-label="Go to dashboard"
      >
        <span className="brand-icon">
          <Code2 size={23} />
        </span>
        <span>
          Tracker<span className="brand-light">App</span>
        </span>
      </button>

      <div className="nav-label">WORKSPACE</div>

      <nav className="navigation">
        {navigation.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => onNavigate(label)}
            className={`nav-item ${
              activePage === label ? "active" : ""
            }`}
            aria-current={activePage === label ? "page" : undefined}
          >
            <Icon size={18} />
            <span>{label}</span>
            {activePage === label && <span className="active-dot" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="daily-goal">
          <div className="goal-heading">
            <Target size={18} />
            <span>Daily goal</span>
          </div>

          <div className="goal-numbers">{solved} solved</div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p>Keep building consistency.</p>
        </div>

        <div className="sidebar-footer">
          Personal learning workspace
        </div>
      </div>
    </aside>
  );
}
