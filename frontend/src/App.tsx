
import { useEffect, useState } from "react";
import {
  ChartNoAxesCombined,
  Check,
  Code2,
  Flame,
  ListChecks,
  Search,
  Target,
} from "lucide-react";

import type { Question, Status } from "./types/tracker";

import Sidebar from "./components/layout/Sidebar";
import Topbar, { Notice } from "./components/layout/Topbar";
import StatCard from "./components/tracker/StatCard";
import QuestionList, {
  type TrackerQuestion,
} from "./components/tracker/QuestionList";
import PlaceholderPage from "./components/tracker/PlaceholderPage";

import Dashboard from "./pages/Dashboard";
import Contests from "./pages/Contests";
import LearningPlanner from "./pages/LearningPlanner";

import {
  getDsaQuestions,
  recordDsaAttempt,
} from "./services/dsaApi";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [questions, setQuestions] = useState<TrackerQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState("");

  // Load questions from the backend.
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
        if (isActive) {
          setIsLoadingQuestions(false);
        }
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

  function openPage(page: string) {
    setActivePage(page);
    setNotice("");
  }

  // Save a status change and revert it if the API request fails.
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

  const filteredQuestions = questions.filter((question) => {
    const searchTerm = search.toLowerCase().trim();

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
      <Sidebar
        activePage={activePage}
        solved={solved}
        progress={progress}
        onNavigate={openPage}
      />

      <main className="main-area">
        <Topbar
          activePage={activePage}
          onNotify={() => setNotice("No new notifications.")}
        />

        <div className="page-content">
          <Notice
            message={notice}
            onDismiss={() => setNotice("")}
          />

          {activePage === "Dashboard" && (
            <Dashboard
              questions={questions}
              solved={solved}
              progress={progress}
              isLoadingQuestions={isLoadingQuestions}
              onStatusChange={updateStatus}
              onNavigate={openPage}
            />
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

                <span className="local-badge">
                  MongoDB question bank
                </span>
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
                  value={String(
                    Math.max(0, questions.length - solved),
                  )}
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

                {!isLoadingQuestions &&
                  filteredQuestions.length === 0 && (
                    <p className="empty-filter">
                      {questions.length === 0
                        ? "No questions found. Import questions into MongoDB to get started."
                        : "No questions match your filters."}
                    </p>
                  )}
              </section>
            </>
          )}

          {activePage === "Contests" && <Contests />}

          {activePage === "Learning (YouTube)" && (
            <LearningPlanner />
          )}

          {["Analytics", "Profile", "Settings"].includes(activePage) && (
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

export default App;
