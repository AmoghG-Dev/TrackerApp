import { useEffect, useState } from "react";
import type { Status, Question } from "./types/tracker";
import LearningPlanner from "./pages/LearningPlanner";
import { getDsaQuestions, recordDsaAttempt } from "./services/dsaApi";
import {
  Activity,
  Bell,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  CircleUserRound,
  Code2,
  ExternalLink,
  Flame,
  LayoutDashboard,
  ListChecks,
  Search,
  Settings,
  Target,
  Trophy,
  PlayCircle,
  X,
} from "lucide-react";

type TrackerQuestion = Question & {
  apiId: string;
  platform?: string;
};

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "DSA Tracker", icon: Code2 },
  { label: "Contests", icon: CalendarDays },
  { label: "Learning (YouTube)", icon: BookOpen },
  { label: "Analytics", icon: ChartNoAxesCombined },
  { label: "Profile", icon: CircleUserRound },
  { label: "Settings", icon: Settings },
];

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [questions, setQuestions] = useState<TrackerQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadQuestions() {
      setIsLoadingQuestions(true);

      try {
        const apiQuestions = await getDsaQuestions();

        if (!isActive) return;

        const mapped: TrackerQuestion[] = apiQuestions.map(
          (item, index) => {
            const difficulty: Question["difficulty"] =
              item.difficulty === "easy"
                ? "Easy"
                : item.difficulty === "medium"
                  ? "Medium"
                  : "Hard";

            const status: Status =
              item.status === "solved"
                ? "Solved"
                : item.status === "retry"
                  ? "Retry"
                  : "Pending";

            return {
              id: index + 1,
              apiId: item.id,
              title: item.title,
              difficulty,
              topics: item.topics ?? [],
              url: item.url,
              frequency: item.frequency_score ?? 0,
              status,
              platform: item.platform,
            };
          },
        );

        setQuestions(mapped);
        setNotice("");
      } catch (error) {
        console.error("Could not load questions from MongoDB:", error);

        if (isActive) {
          setQuestions([]);
          setNotice(
            "Could not load questions. Check that the backend and database are available.",
          );
        }
      } finally {
        if (isActive) setIsLoadingQuestions(false);
      }
    }

    void loadQuestions();

    return () => {
      isActive = false;
    };
  }, []);

  const solved = questions.filter(
    (question) => question.status === "Solved",
  ).length;

  const progress =
    questions.length > 0
      ? Math.round((solved / questions.length) * 100)
      : 0;

  async function updateStatus(id: number, status: Status) {
    const question = questions.find((item) => item.id === id);
    if (!question) return;

    const previousStatus = question.status;

    setQuestions((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status } : item,
      ),
    );

    const apiStatus =
      status === "Solved"
        ? "solved"
        : status === "Retry"
          ? "failed"
          : "pending";

    try {
      await recordDsaAttempt(question.apiId, apiStatus);
      setNotice("Question status saved successfully.");
    } catch (error) {
      console.error("Could not save question status:", error);

      setQuestions((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status: previousStatus }
            : item,
        ),
      );

      setNotice(
        "Could not save your status. Check that the backend is running and try again.",
      );
    }
  }

  function openPage(page: string) {
    setActivePage(page);
    setNotice("");
  }

  const filteredQuestions = questions.filter((question) => {
    const searchTerm = search.toLowerCase();

    const matchesSearch =
      question.title.toLowerCase().includes(searchTerm) ||
      question.topics.some((topic) =>
        topic.toLowerCase().includes(searchTerm),
      ) ||
      (question.platform ?? "").toLowerCase().includes(searchTerm);

    const matchesFilter =
      filter === "All" ||
      (filter === "Unsolved" && question.status !== "Solved") ||
      question.difficulty === filter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => openPage("Dashboard")}
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
              onClick={() => openPage(label)}
              className={`nav-item ${
                activePage === label ? "active" : ""
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {activePage === label && (
                <span className="active-dot" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="daily-goal">
            <div className="goal-heading">
              <Target size={18} />
              <span>Daily goal</span>
            </div>
            <div className="goal-numbers">
              {solved} solved
            </div>
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

      <main className="main-area">
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
              onClick={() => setNotice("No new notifications.")}
            >
              <Bell size={19} />
            </button>
            <div className="avatar">A</div>
          </div>
        </header>

        <div className="page-content">
          {notice && (
            <div className="notice">
              <span>{notice}</span>
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {activePage === "Dashboard" && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow">
                    YOUR PERSONAL WORKSPACE
                  </div>
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
                  onClick={() => openPage("DSA Tracker")}
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
                      onClick={() => openPage("DSA Tracker")}
                    >
                      View all <ChevronRight size={15} />
                    </button>
                  </div>

                  <QuestionList
                    questions={questions.slice(0, 3)}
                    onStatusChange={updateStatus}
                  />

                  {isLoadingQuestions && (
                    <p className="empty-filter">
                      Loading questions from MongoDB...
                    </p>
                  )}

                  {!isLoadingQuestions && questions.length === 0 && (
                    <p className="empty-filter">
                      No questions are available. Import questions into
                      the database to get started.
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
                    {[
                      ["01", "Python & Data Analysis", "Build foundations"],
                      ["02", "Machine Learning", "Learn core algorithms"],
                      ["03", "Deep Learning & NLP", "Neural networks and transformers"],
                      ["04", "GenAI & MLOps", "Build production-ready projects"],
                    ].map(([number, title, description]) => (
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
                    onClick={() => openPage("Learning (YouTube)")}
                  >
                    Open learning planner
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Contest tracker</h2>
                      <p>Stay prepared for upcoming contests</p>
                    </div>
                    <Trophy size={20} className="muted-icon" />
                  </div>

                  <div className="empty-state">
                    <div className="empty-icon">
                      <CalendarDays size={24} />
                    </div>
                    <strong>No contests connected yet</strong>
                    <p>
                      Contest tracking and calendar reminders can be
                      integrated here later.
                    </p>
                    <button
                      className="secondary-button"
                      onClick={() => openPage("Contests")}
                    >
                      Explore contests
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {activePage === "DSA Tracker" && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow">PRACTICE & IMPROVE</div>
                  <h1>
                    DSA Tracker
                    <span className="blue-period">.</span>
                  </h1>
                  <p className="subtitle">
                    Track attempts, build habits, and revisit weak topics.
                  </p>
                </div>
                <span className="local-badge">MongoDB question bank</span>
              </section>

              <section className="stats-grid">
                <StatCard
                  icon={<Check size={19} />}
                  label="Questions solved"
                  value={String(solved)}
                  caption="From the loaded question bank"
                  tone="green"
                />
                <StatCard
                  icon={<Target size={19} />}
                  label="Question bank"
                  value={String(questions.length)}
                  caption="Questions available"
                  tone="blue"
                />
                <StatCard
                  icon={<ListChecks size={19} />}
                  label="Remaining"
                  value={String(Math.max(0, questions.length - solved))}
                  caption="Not marked solved"
                  tone="purple"
                />
                <StatCard
                  icon={<Flame size={19} />}
                  label="Streak"
                  value="—"
                  caption="Not yet integrated"
                  tone="orange"
                />
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Question bank</h2>
                    <p>Find your next challenge.</p>
                  </div>
                  <span className="local-badge">
                    {questions.length} questions
                  </span>
                </div>

                <div className="filter-row">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search questions, topics, or platforms..."
                    />
                  </div>

                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    aria-label="Filter questions"
                  >
                    <option>All</option>
                    <option>Unsolved</option>
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </div>

                {isLoadingQuestions && (
                  <p className="empty-filter">
                    Loading questions from MongoDB...
                  </p>
                )}

                {!isLoadingQuestions && (
                  <QuestionList
                    questions={filteredQuestions}
                    onStatusChange={updateStatus}
                  />
                )}

                {!isLoadingQuestions && filteredQuestions.length === 0 && (
                  <p className="empty-filter">
                    {questions.length === 0
                      ? "No questions found. Import questions into MongoDB to get started."
                      : "No questions match your filters."}
                  </p>
                )}
              </section>
            </>
          )}

          {activePage === "Learning (YouTube)" && <LearningPlanner />}

          {activePage !== "Dashboard" &&
            activePage !== "DSA Tracker" &&
            activePage !== "Learning (YouTube)" && (
              <PlaceholderPage
                page={activePage}
                onBack={() => openPage("Dashboard")}
              />
            )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-caption">{caption}</div>
    </div>
  );
}

function QuestionList({
  questions,
  onStatusChange,
}: {
  questions: TrackerQuestion[];
  onStatusChange: (id: number, status: Status) => void;
}) {
  return (
    <div className="question-list">
      {questions.map((question) => (
        <article className="question-row" key={question.apiId}>
          <div
            className={`difficulty-badge ${question.difficulty.toLowerCase()}`}
          >
            {question.difficulty}
          </div>

          <div className="question-main">
            <a
              className="question-title"
              href={question.url}
              target="_blank"
              rel="noreferrer"
            >
              {question.title} <ExternalLink size={13} />
            </a>
            <div className="topic-list">
              {question.topics.map((topic) => (
                <span className="topic-tag" key={topic}>
                  {topic}
                </span>
              ))}
            </div>
            {question.platform && (
              <span className="topic-tag">{question.platform}</span>
            )}
          </div>

          <div className="frequency">
            <span>Frequency</span>
            <strong>{question.frequency}/10</strong>
          </div>

          <div className="question-actions">
            <select
              className={`status-select ${question.status.toLowerCase()}`}
              value={question.status}
              onChange={(event) =>
                onStatusChange(
                  question.id,
                  event.target.value as Status,
                )
              }
              aria-label={`Status for ${question.title}`}
            >
              <option value="Pending">Pending</option>
              <option value="Solved">Solved</option>
              <option value="Retry">Retry</option>
            </select>

            <a
              className="solve-button"
              href={question.url}
              target="_blank"
              rel="noreferrer"
            >
              Solve <ExternalLink size={14} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

function PlaceholderPage({
  page,
  onBack,
}: {
  page: string;
  onBack: () => void;
}) {
  const details: Record<
    string,
    { icon: React.ReactNode; description: string }
  > = {
    Contests: {
      icon: <Trophy size={25} />,
      description:
        "Upcoming Codeforces and LeetCode contests, profile synchronization, and calendar reminders will live here.",
    },
    "Learning (YouTube)": {
      icon: <PlayCircle size={25} />,
      description:
        "Import YouTube playlists, plan daily videos, track completion, and reschedule remaining lessons.",
    },
    Analytics: {
      icon: <ChartNoAxesCombined size={25} />,
      description:
        "Review solved questions, topic accuracy, revision performance, and learning consistency.",
    },
    Profile: {
      icon: <CircleUserRound size={25} />,
      description:
        "Manage your coding usernames, learning goals, and personal preferences.",
    },
    Settings: {
      icon: <Settings size={25} />,
      description:
        "Configure your daily target, preferred platforms, timezone, and scheduling preferences.",
    },
  };

  const detail = details[page] ?? details.Analytics;

  return (
    <section className="placeholder-page">
      <div className="placeholder-icon">{detail.icon}</div>
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

export default App;