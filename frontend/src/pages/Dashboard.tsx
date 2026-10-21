
import { useEffect, useState } from "react";
import type { Status, Question } from "../types/tracker";
import { fetchContests, type Contest } from "../services/contestsApi";

import StatCard from "../components/tracker/StatCard";
import QuestionList from "../components/tracker/QuestionList";

import {
  Activity,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Code2,
  ExternalLink,
  Flame,
  Target,
  Trophy,
} from "lucide-react";

import "./Dashboard.css";

export type DashboardQuestion = Question & {
  apiId: string;
  platform?: string;
};

interface DashboardProps {
  questions: DashboardQuestion[];
  solved: number;
  progress: number;
  isLoadingQuestions: boolean;
  onStatusChange: (id: number, status: Status) => void;
  onNavigate: (page: string) => void;
}

function formatContestTime(startTime: string): string {
  return new Date(startTime).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatContestCountdown(
  startTimestamp: number,
  now: number,
): string {
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
  questions,
  solved,
  progress,
  isLoadingQuestions,
  onStatusChange,
  onNavigate,
}: DashboardProps) {
  const [upcomingContests, setUpcomingContests] = useState<Contest[]>([]);
  const [isLoadingContests, setIsLoadingContests] = useState(true);
  const [contestError, setContestError] = useState("");
  const [contestNow, setContestNow] = useState(Date.now());

  useEffect(() => {
    let isActive = true;

    async function loadUpcomingContests() {
      setIsLoadingContests(true);
      setContestError("");

      try {
        const result = await fetchContests("all", 50);

        if (isActive) {
          const futureContests = result.contests
            .filter(
              (contest) =>
                contest.start_timestamp * 1000 > Date.now(),
            )
            .sort(
              (a, b) => a.start_timestamp - b.start_timestamp,
            );

          setUpcomingContests(futureContests);
        }
      } catch (error) {
        console.error("Could not load upcoming contests:", error);

        if (isActive) {
          setUpcomingContests([]);
          setContestError(
            error instanceof Error
              ? error.message
              : "Unable to load upcoming contests.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingContests(false);
        }
      }
    }

    void loadUpcomingContests();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setContestNow(Date.now());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">YOUR PERSONAL WORKSPACE</div>
          <h1>
            Welcome back
            <span className="blue-period">.</span>
          </h1>
          <p className="subtitle">
            Make today count. One problem at a time.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => onNavigate("DSA Tracker")}
        >
          <Code2 size={17} />
          Start practicing
        </button>
      </section>

      <section className="stats-grid">
        <StatCard
          icon={<Check size={19} />}
          label="Questions solved"
          value={String(solved)}
          caption="From MongoDB"
          tone="green"
        />

        <StatCard
          icon={<Flame size={19} />}
          label="Daily streak"
          value="—"
          caption="Not yet integrated"
          tone="orange"
        />

        <StatCard
          icon={<Target size={19} />}
          label="Questions in bank"
          value={String(questions.length)}
          caption="Available questions"
          tone="blue"
        />

        <StatCard
          icon={<ChartNoAxesCombined size={19} />}
          label="Overall progress"
          value={`${progress}%`}
          caption="Based on loaded questions"
          tone="purple"
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel question-panel">
          <div className="panel-heading">
            <div>
              <h2>DSA questions</h2>
              <p>Questions from your connected question bank.</p>
            </div>

            <button
              className="text-button"
              onClick={() => onNavigate("DSA Tracker")}
            >
              View all <ChevronRight size={15} />
            </button>
          </div>

          {isLoadingQuestions ? (
            <p className="empty-filter">
              Loading questions from MongoDB...
            </p>
          ) : questions.length > 0 ? (
            <QuestionList
              questions={questions.slice(0, 3)}
              onStatusChange={onStatusChange}
            />
          ) : (
            <p className="empty-filter">
              No questions are available. Import questions into the
              database to get started.
            </p>
          )}

          <div className="panel-footnote">
            <Activity size={15} />
            Questions are loaded from your database.
          </div>
        </div>

        <div className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <h2>Your progress</h2>
              <p>Based on loaded questions</p>
            </div>
          </div>

          <div className="donut-wrap">
            <div
              className="donut"
              style={{
                background: `conic-gradient(#4adea0 ${progress}%, #263449 ${progress}% 100%)`,
              }}
            >
              <div className="donut-inner">
                <strong>{progress}%</strong>
                <span>Complete</span>
              </div>
            </div>
          </div>

          <div className="legend">
            <span>
              <i className="legend-dot green-dot" />
              Solved
            </span>
            <strong>{solved}</strong>
          </div>

          <div className="legend">
            <span>
              <i className="legend-dot grey-dot" />
              Remaining
            </span>
            <strong>{Math.max(0, questions.length - solved)}</strong>
          </div>

          <div className="divider" />

          <div className="goal-message">
            <Target size={18} />
            <span>Keep progressing one question at a time.</span>
          </div>
        </div>
      </section>

      <section className="bottom-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Learning roadmap</h2>
              <p>Your path toward AI/ML engineering</p>
            </div>
            <BookOpen size={20} className="muted-icon" />
          </div>

          <div className="roadmap-list">
            {roadmap.map(([number, title, description]) => (
              <div className="roadmap-item" key={number}>
                <span className="roadmap-number">{number}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <ChevronRight size={16} className="muted-icon" />
              </div>
            ))}
          </div>

          <button
            className="secondary-button full-button"
            onClick={() => onNavigate("Learning (YouTube)")}
          >
            Open learning planner
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="panel dashboard-contest-panel">
          <div className="panel-heading">
            <div>
              <h2>Contest tracker</h2>
              <p>Upcoming Codeforces and LeetCode contests</p>
            </div>
            <Trophy size={20} className="muted-icon" />
          </div>

          {isLoadingContests && (
            <div className="dashboard-contest-message">
              Loading upcoming contests...
            </div>
          )}

          {!isLoadingContests && contestError && (
            <div className="dashboard-contest-message" role="alert">
              <strong>Unable to load contests</strong>
              <p>Check that the backend is running and try again.</p>
            </div>
          )}

          {!isLoadingContests &&
            !contestError &&
            upcomingContests.length === 0 && (
              <div className="dashboard-contest-message">
                <strong>No upcoming contests found</strong>
                <p>Check the Contests page again later for updates.</p>
              </div>
            )}

          {!isLoadingContests &&
            !contestError &&
            upcomingContests.length > 0 && (
              <div className="dashboard-contest-list">
                {upcomingContests.slice(0, 2).map((contest) => (
                  <article
                    className="dashboard-contest-item"
                    key={`${contest.platform}-${contest.id}`}
                  >
                    <div className="dashboard-contest-info">
                      <div className="dashboard-contest-meta">
                        <span
                          className={`dashboard-contest-platform ${
                            contest.platform === "Codeforces"
                              ? "codeforces"
                              : "leetcode"
                          }`}
                        >
                          {contest.platform}
                        </span>

                        <span className="dashboard-contest-countdown">
                          {formatContestCountdown(
                            contest.start_timestamp,
                            contestNow,
                          )}
                        </span>
                      </div>

                      <strong className="dashboard-contest-name">
                        {contest.name}
                      </strong>

                      <span className="dashboard-contest-time">
                        {formatContestTime(contest.start_time)}
                      </span>
                    </div>

                    <a
                      className="dashboard-contest-link"
                      href={contest.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${contest.name}`}
                      title="Open contest"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </article>
                ))}
              </div>
            )}

          <button
            className="secondary-button full-button"
            onClick={() => onNavigate("Contests")}
          >
            View all contests
            <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </>
  );
}
