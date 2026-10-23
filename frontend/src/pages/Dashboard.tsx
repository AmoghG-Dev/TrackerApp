import { useEffect, useState } from "react";
import type { Status } from "../types/tracker";
import { fetchContests, type Contest } from "../services/contestsApi";
import {
  getDailyQuestions,
  getDsaStats,
  recordDsaAttempt,
  type DailyAssignment,
  type DsaStats,
} from "../services/dsaApi";
import type { TrackerQuestion } from "../components/tracker/QuestionList";
import {
  BookOpen, CalendarCheck, ChartNoAxesCombined, Check, ChevronRight,
  Code2, ExternalLink, Flame, Target, Trophy,
} from "lucide-react";
import "./Dashboard.css";

interface DashboardProps {
  questions: TrackerQuestion[];
  solved: number;
  progress: number;
  isLoadingQuestions: boolean;
  onStatusChange: (id: number, status: Status) => void;
  onNavigate: (page: string) => void;
}

function formatContestTime(startTime: string): string {
  return new Date(startTime).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatContestCountdown(startTimestamp: number, now: number): string {
  const remaining = startTimestamp * 1000 - now;
  if (remaining <= 0) return "Starting soon";
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `In ${days}d ${hours}h`;
  if (hours > 0) return `In ${hours}h ${minutes}m`;
  return `In ${minutes}m`;
}

const roadmap = [
  ["01", "Python & Data Analysis", "Build foundations"],
  ["02", "Machine Learning", "Learn core algorithms"],
  ["03", "Deep Learning & NLP", "Neural networks and transformers"],
  ["04", "GenAI & MLOps", "Build production-ready projects"],
];

export default function Dashboard({
  questions, solved, progress, isLoadingQuestions, onStatusChange, onNavigate,
}: DashboardProps) {
  const [upcomingContests, setUpcomingContests] = useState<Contest[]>([]);
  const [isLoadingContests, setIsLoadingContests] = useState(true);
  const [contestError, setContestError] = useState("");
  const [contestNow, setContestNow] = useState(() => Date.now());
  const [dsaStats, setDsaStats] = useState<DsaStats | null>(null);
  const [dailyAssignment, setDailyAssignment] = useState<DailyAssignment | null>(null);

  useEffect(() => {
    let isActive = true;
    async function loadDashboardData() {
      setIsLoadingContests(true);
      setContestError("");
      try {
        const [contestRes, statsRes, dailyRes] = await Promise.all([
          fetchContests("all", 50),
          getDsaStats().catch(() => null),
          getDailyQuestions().catch(() => null),
        ]);
        if (isActive) {
          setUpcomingContests(contestRes.contests
            .filter((contest) => contest.start_timestamp * 1000 > Date.now())
            .sort((a, b) => a.start_timestamp - b.start_timestamp));
          if (statsRes) setDsaStats(statsRes);
          if (dailyRes) setDailyAssignment(dailyRes);
        }
      } catch (error) {
        console.error("Could not load dashboard data:", error);
        if (isActive) {
          setUpcomingContests([]);
          setContestError(error instanceof Error ? error.message : "Unable to load dashboard data.");
        }
      } finally {
        if (isActive) setIsLoadingContests(false);
      }
    }
    void loadDashboardData();
    return () => { isActive = false; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setContestNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleDailyStatusToggle(questionId: string, currentStatus: string) {
    const nextStatus = currentStatus === "solved" ? "pending" : "solved";
    try {
      await recordDsaAttempt(questionId, nextStatus);
      setDailyAssignment((curr) => curr ? {
        ...curr,
        questions: curr.questions.map((q) =>
          q.question_id === questionId ? { ...q, status: nextStatus } : q),
      } : null);
      const matchedQ = questions.find((q) => q.apiId === questionId);
      if (matchedQ) onStatusChange(matchedQ.id, nextStatus === "solved" ? "Solved" : "Pending");
    } catch (err) {
      console.error("Could not record daily attempt:", err);
    }
  }

  const streakDays = dsaStats?.current_streak ?? 0;
  const totalInBank = dsaStats?.total_questions ?? questions.length;
  const dbSolved = dsaStats?.solved_count ?? solved;
  const dbProgress = totalInBank > 0 ? Math.round((dbSolved / totalInBank) * 100) : progress;
  const remaining = Math.max(0, totalInBank - dbSolved);
  const dailySolved = dailyAssignment?.questions.filter((q) => q.status === "solved").length ?? 0;

  return (
    <div className="tracker-dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-eyebrow">YOUR PERSONAL WORKSPACE</div>
          <h1>Welcome back, <span>Amogh</span></h1>
          <p>Make today count. One problem at a time.</p>
        </div>
        <button className="dashboard-primary-button" onClick={() => onNavigate("DSA Tracker")}>
          <Code2 size={18} /> Start practicing <span className="button-arrow">→</span>
        </button>

        <section className="dashboard-stats-grid" aria-label="Your statistics">
          <article className="dashboard-stat-card stat-green">
            <div className="dashboard-stat-icon"><Check size={24} /></div>
            <div className="dashboard-stat-content"><span>Questions solved</span><strong>{dbSolved}</strong><small>Verified in MongoDB</small></div>
            <img className="stat-wave" src="/green-wave.png" alt="" aria-hidden="true" />
          </article>
          <article className="dashboard-stat-card stat-orange">
            <div className="dashboard-stat-icon"><Flame size={24} /></div>
            <div className="dashboard-stat-content"><span>Daily streak</span><strong>{streakDays} {streakDays === 1 ? "day" : "days"}</strong><small>Best streak: {dsaStats?.longest_streak ?? 0} days</small></div>
            <img className="stat-wave" src="/red-wave.png" alt="" aria-hidden="true" />
          </article>
          <article className="dashboard-stat-card stat-blue">
            <div className="dashboard-stat-icon"><Target size={24} /></div>
            <div className="dashboard-stat-content"><span>Questions in bank</span><strong>{totalInBank}</strong><small>Total available questions</small></div>
            <img className="stat-wave" src="/blue-wave.png" alt="" aria-hidden="true" />
          </article>
          <article className="dashboard-stat-card stat-purple">
            <div className="dashboard-stat-icon"><ChartNoAxesCombined size={24} /></div>
            <div className="dashboard-stat-content"><span>Overall progress</span><strong>{dbProgress}%</strong><small>Completion percentage</small></div>
            <img className="stat-wave" src="/purple-wave.png" alt="" aria-hidden="true" />
          </article>
        </section>
      </section>

      {dailyAssignment && dailyAssignment.questions.length > 0 && (
        <section className="dashboard-panel daily-panel">
          <div className="dashboard-panel-heading">
            <div className="dashboard-heading-title">
              <CalendarCheck size={26} className="dashboard-cyan-icon" />
              <div><h2>Today's Daily Challenge</h2><p>Generated daily set ({dailyAssignment.date}) tailored to build consistency</p></div>
            </div>
            <span className="dashboard-completion-badge"><Target size={18} /> {dailySolved} of {dailyAssignment.questions.length} completed</span>
          </div>
          <div className="daily-challenge-grid">
            {dailyAssignment.questions.map((dq) => (
              <article className={`daily-challenge-card ${dq.difficulty.toLowerCase()}`} key={dq.question_id}>
                <div className="daily-card-topline">
                  <span className={`dashboard-difficulty-badge ${dq.difficulty.toLowerCase()}`}>{dq.difficulty}</span>
                  <span className="dashboard-platform-badge">{dq.platform}</span>
                </div>
                <a className="daily-question-title" href={dq.url} target="_blank" rel="noreferrer">
                  {dq.title} <ExternalLink size={14} />
                </a>
                {dq.topics?.length ? <div className="daily-topic-list">{dq.topics.slice(0, 2).map((topic) => <span className="dashboard-topic-tag" key={topic}>{topic}</span>)}</div> : null}
                <div className="daily-card-actions">
                  <button className={`mark-solved-button ${dq.status === "solved" ? "is-solved" : ""}`} type="button" onClick={() => void handleDailyStatusToggle(dq.question_id, dq.status)}>
                    <Check size={17} /> {dq.status === "solved" ? "Completed" : "Mark Solved"}
                  </button>
                  <a className="dashboard-solve-button" href={dq.url} target="_blank" rel="noreferrer">Solve <span>→</span></a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="dashboard-bottom-grid">
        <article className="dashboard-panel dashboard-progress-panel">
          <div className="dashboard-panel-heading">
            <div><h2><ChartNoAxesCombined size={22} /> Your progress</h2><p>Based on MongoDB attempts</p></div>
            <button className="dashboard-text-button" onClick={() => onNavigate("DSA Tracker")}>All questions <ChevronRight size={16} /></button>
          </div>
          <div className="progress-details">
            <div className="dashboard-donut" style={{ background: `conic-gradient(#367dff ${dbProgress}%, #203d5f ${dbProgress}% 100%)` }}>
              <div className="dashboard-donut-inner"><strong>{dbProgress}%</strong><span>Complete</span></div>
            </div>
            <div className="dashboard-progress-legend">
              <div><span><i className="progress-dot solved-dot" />Solved</span><strong>{dbSolved}</strong></div>
              <div><span><i className="progress-dot attempted-dot" />Attempted</span><strong>{Math.max(0, totalInBank - dbSolved - remaining)}</strong></div>
              <div><span><i className="progress-dot remaining-dot" />Remaining</span><strong>{remaining}</strong></div>
              <div className="dashboard-progress-divider" />
            </div>
          </div>
          <div className="dashboard-goal-message"><Target size={22} /><span>Keep progressing one question at a time.</span></div>
        </article>

        <article className="dashboard-panel dashboard-roadmap-panel">
          <div className="dashboard-panel-heading">
            <div><h2><BookOpen size={23} /> Learning roadmap</h2><p>Your path toward AI/ML engineering</p></div>
            <button className="dashboard-text-button" onClick={() => onNavigate("Learning (YouTube)")}> <BookOpen size={16} /> Open all</button>
          </div>
          <div className="dashboard-roadmap-list">
            {roadmap.map(([number, title, description]) => (
              <button className="dashboard-roadmap-item" key={number} onClick={() => onNavigate("Learning (YouTube)")}>
                <span className="dashboard-roadmap-number">{number}</span><span className="dashboard-roadmap-copy"><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18} />
              </button>
            ))}
          </div>
          <button className="dashboard-secondary-button" onClick={() => onNavigate("Learning (YouTube)")}><BookOpen size={20} /> Open learning planner <ChevronRight size={17} /></button>
        </article>

        <article className="dashboard-panel dashboard-contest-panel">
          <div className="dashboard-panel-heading">
            <div><h2><Trophy size={22} /> Contest tracker</h2><p>Upcoming aggregated programming contests</p></div>
          </div>
          {isLoadingContests && <div className="dashboard-contest-message">Loading upcoming contests...</div>}
          {!isLoadingContests && contestError && <div className="dashboard-contest-message" role="alert"><strong>Unable to load contests</strong><p>Check that the backend is running and try again.</p></div>}
          {!isLoadingContests && !contestError && upcomingContests.length === 0 && <div className="dashboard-contest-message"><strong>No upcoming contests found</strong><p>Check the Contests page again later for updates.</p></div>}
          {!isLoadingContests && !contestError && upcomingContests.length > 0 && (
            <div className="dashboard-contest-list">
              {upcomingContests.slice(0, 2).map((contest) => (
                <article className="dashboard-contest-item" key={`${contest.platform}-${contest.id}`}>
                  <div className="dashboard-contest-info">
                    <div className="dashboard-contest-meta"><span className={`dashboard-contest-platform ${contest.platform.toLowerCase()}`}>{contest.platform}</span><span className="dashboard-contest-countdown">◷ {formatContestCountdown(contest.start_timestamp, contestNow)}</span></div>
                    <strong className="dashboard-contest-name">{contest.name}</strong>
                    <span className="dashboard-contest-time">{formatContestTime(contest.start_time)}</span>
                  </div>
                  <a className="dashboard-contest-link" href={contest.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${contest.name}`} title="Open contest"><ExternalLink size={17} /></a>
                </article>
              ))}
            </div>
          )}
          <button className="dashboard-secondary-button" onClick={() => onNavigate("Contests")}><CalendarCheck size={19} /> View all contests <ChevronRight size={17} /></button>
        </article>
      </section>
    </div>
  );
}