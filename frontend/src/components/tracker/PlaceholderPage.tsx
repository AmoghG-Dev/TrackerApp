
import {
  ChartNoAxesCombined,
  CircleUserRound,
  LayoutDashboard,
  Settings,
} from "lucide-react";

interface PlaceholderPageProps {
  page: string;
  onBack: () => void;
}

const details = {
  Analytics: {
    icon: ChartNoAxesCombined,
    description:
      "Review solved questions, topic accuracy, revision performance, and learning consistency.",
  },
  Profile: {
    icon: CircleUserRound,
    description:
      "Manage your coding usernames, learning goals, and personal preferences.",
  },
  Settings: {
    icon: Settings,
    description:
      "Configure your daily target, preferred platforms, timezone, and scheduling preferences.",
  },
};

export default function PlaceholderPage({
  page,
  onBack,
}: PlaceholderPageProps) {
  const detail =
    details[page as keyof typeof details] ?? details.Analytics;

  const Icon = detail.icon;

  return (
    <section className="placeholder-page">
      <div className="placeholder-icon">
        <Icon size={25} />
      </div>

      <div className="eyebrow">YOUR WORKSPACE</div>

      <h1>
        {page}
        <span className="blue-period">.</span>
      </h1>

      <p>{detail.description}</p>

      <span className="local-badge">Frontend module in progress</span>

      <button className="primary-button" onClick={onBack}>
        <LayoutDashboard size={16} />
        Back to dashboard
      </button>
    </section>
  );
}
