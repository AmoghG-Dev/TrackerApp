
import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  caption: string;
  tone: string;
}

export default function StatCard({
  icon,
  label,
  value,
  caption,
  tone,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-caption">{caption}</div>
    </div>
  );
}
