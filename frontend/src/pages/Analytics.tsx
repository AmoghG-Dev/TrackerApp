import { useEffect, useState } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  Flame,
  Layers,
  RotateCcw,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "../components/tracker/StatCard";
import {
  getAttemptHistory,
  getDsaStats,
  type AttemptHistoryItem,
  type DsaStats,
} from "../services/dsaApi";

export default function Analytics() {
  const [stats, setStats] = useState<DsaStats | null>(null);
  const [history, setHistory] = useState<AttemptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [statsData, historyData] = await Promise.all([
          getDsaStats(),
          getAttemptHistory(),
        ]);
        if (!cancelled) {
          setStats(statsData);
          setHistory(historyData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load analytics data.",
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

  if (loading) {
    return (
      <div className="panel" style={{ padding: "40px", textAlign: "center" }}>
        <p style={{ color: "#94a3b8" }}>Loading analytics and solving metrics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="panel" style={{ padding: "30px", textAlign: "center", color: "#f87171" }}>
        <p>{error || "Unable to load analytics."}</p>
      </div>
    );
  }

  const chartData = stats.activity_trend.map((item) => ({
    date: item.date.slice(5), // MM-DD
    attempts: item.attempts,
  }));

  const easyPct = stats.difficulty.easy.total
    ? Math.round((stats.difficulty.easy.solved / stats.difficulty.easy.total) * 100)
    : 0;
  const medPct = stats.difficulty.medium.total
    ? Math.round((stats.difficulty.medium.solved / stats.difficulty.medium.total) * 100)
    : 0;
  const hardPct = stats.difficulty.hard.total
    ? Math.round((stats.difficulty.hard.solved / stats.difficulty.hard.total) * 100)
    : 0;

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">DATA & INSIGHTS</div>
          <h1>
            Analytics<span className="blue-period">.</span>
          </h1>
          <p className="subtitle">
            Track solving velocity, difficulty breakdown, topic strengths, and streaks.
          </p>
        </div>
        <span className="local-badge">Real-time metrics</span>
      </section>

      <section className="stats-grid">
        <StatCard
          icon={<CheckCircle2 size={19} />}
          label="Total Solved"
          value={String(stats.solved_count)}
          caption={`${Math.round((stats.solved_count / Math.max(1, stats.total_questions)) * 100)}% of question bank`}
          tone="green"
        />
        <StatCard
          icon={<Flame size={19} />}
          label="Current Streak"
          value={`${stats.current_streak} days`}
          caption={`Best: ${stats.longest_streak} days`}
          tone="orange"
        />
        <StatCard
          icon={<Calendar size={19} />}
          label="Active Days"
          value={String(stats.total_active_days)}
          caption="Days with recorded attempts"
          tone="blue"
        />
        <StatCard
          icon={<RotateCcw size={19} />}
          label="Needs Revision"
          value={String(stats.retry_count)}
          caption="Questions marked retry"
          tone="purple"
        />
      </section>

      <section className="dashboard-grid">
        {/* Solving Activity Trend */}
        <div className="panel question-panel">
          <div className="panel-heading">
            <div>
              <h2>30-Day Solving Activity</h2>
              <p>Attempts recorded per day over the last month</p>
            </div>
            <TrendingUp size={20} className="muted-icon" />
          </div>

          <div style={{ height: "260px", marginTop: "12px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2b3d" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0d1829",
                    borderColor: "#26354a",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                    fontSize: "12px",
                  }}
                  cursor={{ fill: "rgba(56, 189, 248, 0.08)" }}
                />
                <Bar dataKey="attempts" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Difficulty Breakdown */}
        <div className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <h2>Difficulty Breakdown</h2>
              <p>Solved vs total by level</p>
            </div>
            <Layers size={19} className="muted-icon" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "10px" }}>
            {/* Easy */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#4adea0", fontWeight: 600, fontSize: "12px" }}>Easy</span>
                <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                  {stats.difficulty.easy.solved} / {stats.difficulty.easy.total} ({easyPct}%)
                </span>
              </div>
              <div style={{ background: "#1c2838", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${easyPct}%`, background: "#4adea0", height: "100%", transition: "width 0.3s" }} />
              </div>
            </div>

            {/* Medium */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#fbbf24", fontWeight: 600, fontSize: "12px" }}>Medium</span>
                <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                  {stats.difficulty.medium.solved} / {stats.difficulty.medium.total} ({medPct}%)
                </span>
              </div>
              <div style={{ background: "#1c2838", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${medPct}%`, background: "#fbbf24", height: "100%", transition: "width 0.3s" }} />
              </div>
            </div>

            {/* Hard */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#f87171", fontWeight: 600, fontSize: "12px" }}>Hard</span>
                <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                  {stats.difficulty.hard.solved} / {stats.difficulty.hard.total} ({hardPct}%)
                </span>
              </div>
              <div style={{ background: "#1c2838", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${hardPct}%`, background: "#f87171", height: "100%", transition: "width 0.3s" }} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #1f2b3d" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "12px" }}>
              <Target size={16} />
              <span>Practice harder questions to boost system design & problem solving.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Top Topics & Recent Attempts */}
      <section className="bottom-grid" style={{ marginTop: "20px" }}>
        {/* Top Topics */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Top Solved Topics</h2>
              <p>Topics where you have solved the most problems</p>
            </div>
            <Award size={20} className="muted-icon" />
          </div>

          {stats.top_topics.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "12px", padding: "16px 0" }}>
              No solved problems yet. Mark questions as solved to see topic insights.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
              {stats.top_topics.map((t) => (
                <div
                  key={t.topic}
                  style={{
                    background: "#142238",
                    border: "1px solid #283b56",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 500 }}>
                    {t.topic}
                  </span>
                  <span
                    style={{
                      background: "#22354e",
                      color: "#38bdf8",
                      borderRadius: "12px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {t.solved} solved
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Attempts History */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Attempts</h2>
              <p>Your last {history.length} logged actions</p>
            </div>
            <RotateCcw size={20} className="muted-icon" />
          </div>

          {history.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "12px", padding: "16px 0" }}>
              No attempts recorded yet. Change status on questions to build history.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px", maxHeight: "280px", overflowY: "auto" }}>
              {history.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #1c2a3d",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ minWidth: 0, paddingRight: "10px" }}>
                    <div style={{ color: "#f1f5f9", fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </div>
                    <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
                      {new Date(item.attempted_at).toLocaleDateString()} &bull; {item.platform}
                    </div>
                  </div>

                  <span
                    className={`difficulty-badge ${item.status === "solved" ? "easy" : item.status === "failed" ? "hard" : "medium"}`}
                    style={{ textTransform: "capitalize", fontSize: "11px", padding: "4px 8px" }}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
