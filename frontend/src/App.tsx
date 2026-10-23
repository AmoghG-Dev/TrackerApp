import { lazy, Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Check,
  Flame,
  ListChecks,
  Plus,
  Search,
  Target,
  X,
} from "lucide-react";

const GoogleCalendar = lazy(() => import("./pages/GoogleCalendar"));
const Login = lazy(() => import("./pages/Login"));
import type { AuthUser } from "./services/authApi";
import { getCurrentUser, logout } from "./services/authApi";
import type { Difficulty, Question, Status } from "./types/tracker";

import Sidebar from "./components/layout/Sidebar";
import Topbar, { Notice } from "./components/layout/Topbar";
import StatCard from "./components/tracker/StatCard";
import QuestionList, {
  type TrackerQuestion,
} from "./components/tracker/QuestionList";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Contests = lazy(() => import("./pages/Contests"));
const LearningPlanner = lazy(() => import("./pages/LearningPlanner"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));

import {
  createDsaQuestion,
  deleteDsaQuestion,
  getDsaQuestions,
  getDsaStats,
  recordDsaAttempt,
  updateDsaQuestion,
  type DsaStats,
} from "./services/dsaApi";

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [activePage, setActivePage] = useState("Dashboard");
  const [questions, setQuestions] = useState<TrackerQuestion[]>([]);
  const [stats, setStats] = useState<DsaStats | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState("");

  // Add Question Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addDifficulty, setAddDifficulty] = useState<Difficulty>("Medium");
  const [addPlatform, setAddPlatform] = useState("leetcode");
  const [addTopics, setAddTopics] = useState("");
  const [addFrequency, setAddFrequency] = useState(5);
  const [addingQuestion, setAddingQuestion] = useState(false);

  // Edit Question Modal State
  const [editingQuestion, setEditingQuestion] =
    useState<TrackerQuestion | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<Difficulty>("Medium");
  const [editPlatform, setEditPlatform] = useState("leetcode");
  const [editTopics, setEditTopics] = useState("");
  const [editFrequency, setEditFrequency] = useState(5);
  const [updatingQuestion, setUpdatingQuestion] = useState(false);

  // Restore the session after initial load or browser refresh.
  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const response = await getCurrentUser();

        if (active) {
          setUser(response.user);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  // Load questions and stats when the user is authenticated.
  useEffect(() => {
    let active = true;

    if (!user) {
      return;
    }

    async function init() {
      setIsLoadingQuestions(true);
      try {
        const [apiQuestions, dsaStats] = await Promise.all([
          getDsaQuestions(),
          getDsaStats().catch(() => null),
        ]);

        if (!active) return;

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
        if (dsaStats) setStats(dsaStats);
        setNotice("");
      } catch (error) {
        if (!active) return;
        console.error("Could not load questions:", error);
        setQuestions([]);
        setNotice(
          "Could not load questions. Check that the backend and database are available.",
        );
      } finally {
        if (active) setIsLoadingQuestions(false);
      }
    }

    void init();

    return () => {
      active = false;
    };
  }, [user]);

  function handleLogin(authenticatedUser: AuthUser) {
    setUser(authenticatedUser);
    setActivePage("Dashboard");
    setNotice("Signed in successfully.");
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logout();
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      setUser(null);
      setQuestions([]);
      setActivePage("Dashboard");
      setNotice("");
      setLoggingOut(false);
    }
  }

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
      // Refresh stats
      void getDsaStats().then((s) => setStats(s)).catch(() => null);
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
        "Could not save your status. Check your session and backend, then try again.",
      );
    }
  }

  // Add Question Handler
  async function handleAddQuestion(e: FormEvent) {
    e.preventDefault();
    if (!addTitle.trim() || !addUrl.trim()) return;

    setAddingQuestion(true);
    setNotice("");

    try {
      const created = await createDsaQuestion({
        title: addTitle.trim(),
        url: addUrl.trim(),
        difficulty: addDifficulty.toLowerCase() as "easy" | "medium" | "hard",
        platform: addPlatform.trim().toLowerCase(),
        topics: addTopics
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        frequency_score: addFrequency,
      });

      const newQ: TrackerQuestion = {
        id: questions.length + 1,
        apiId: created.id,
        title: created.title,
        difficulty: addDifficulty,
        topics: created.topics || [],
        url: created.url,
        frequency: created.frequency_score || 5,
        status: "Pending",
        platform: created.platform,
      };

      setQuestions((curr) => [newQ, ...curr]);
      setShowAddModal(false);
      setAddTitle("");
      setAddUrl("");
      setAddTopics("");
      setNotice(`Question '${created.title}' added successfully.`);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to add question.",
      );
    } finally {
      setAddingQuestion(false);
    }
  }

  // Open Edit Modal
  function handleOpenEdit(question: TrackerQuestion) {
    setEditingQuestion(question);
    setEditTitle(question.title);
    setEditUrl(question.url);
    setEditDifficulty(question.difficulty);
    setEditPlatform(question.platform || "leetcode");
    setEditTopics((question.topics || []).join(", "));
    setEditFrequency(question.frequency || 5);
  }

  // Submit Edit Question
  async function handleEditQuestion(e: FormEvent) {
    e.preventDefault();
    if (!editingQuestion) return;

    setUpdatingQuestion(true);
    setNotice("");

    try {
      const updated = await updateDsaQuestion(editingQuestion.apiId, {
        title: editTitle.trim(),
        url: editUrl.trim(),
        difficulty: editDifficulty.toLowerCase() as "easy" | "medium" | "hard",
        platform: editPlatform.trim().toLowerCase(),
        topics: editTopics
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        frequency_score: editFrequency,
      });

      setQuestions((curr) =>
        curr.map((q) =>
          q.apiId === editingQuestion.apiId
            ? {
                ...q,
                title: updated.title,
                url: updated.url,
                difficulty: editDifficulty,
                platform: updated.platform,
                topics: updated.topics || [],
                frequency: updated.frequency_score || 5,
              }
            : q,
        ),
      );

      setEditingQuestion(null);
      setNotice(`Question '${updated.title}' updated successfully.`);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to update question.",
      );
    } finally {
      setUpdatingQuestion(false);
    }
  }

  // Delete Question Handler
  async function handleDeleteQuestion(question: TrackerQuestion) {
    const confirmed = window.confirm(
      `Delete '${question.title}' from the question bank? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await deleteDsaQuestion(question.apiId);
      setQuestions((curr) =>
        curr.filter((q) => q.apiId !== question.apiId),
      );
      setNotice(`Question '${question.title}' deleted.`);
      void getDsaStats().then((s) => setStats(s)).catch(() => null);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Failed to delete question.",
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

  if (authLoading) {
    return (
      <main className="auth-loading">
        <p>Checking your session...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <Suspense
        fallback={
          <main className="auth-loading">
            <p>Loading login...</p>
          </main>
        }
      >
        <Login onLogin={handleLogin} />
      </Suspense>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        solved={solved}
        progress={progress}
        onNavigate={openPage}
        userName={user.name}
        userEmail={user.email}
        onLogout={handleLogout}
        loggingOut={loggingOut}
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

          <Suspense
            fallback={
              <div className="auth-loading" role="status" aria-live="polite">
                <p>Loading page...</p>
              </div>
            }
          >
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
                    Track attempts, add custom questions, and conquer coding challenges.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setShowAddModal(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Plus size={16} />
                    Add Question
                  </button>
                  <span className="local-badge">
                    MongoDB question bank
                  </span>
                </div>
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
                  value={stats ? `${stats.current_streak} days` : "0 days"}
                  caption={stats ? `Longest: ${stats.longest_streak} days` : "Calculated from attempts"}
                  tone="orange"
                />
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Question bank</h2>
                    <p>Find your next challenge or add new questions to practice.</p>
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
                    onEdit={handleOpenEdit}
                    onDelete={handleDeleteQuestion}
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

              {/* Add Question Modal */}
              {showAddModal && (
                <div className="modal-backdrop">
                  <div className="modal-dialog">
                    <div className="modal-header">
                      <h3>Add Question</h3>
                      <button
                        type="button"
                        className="modal-close"
                        onClick={() => setShowAddModal(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleAddQuestion} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Title *</span>
                        <input
                          type="text"
                          required
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
                          placeholder="e.g. Subarray Sum Equals K"
                          style={{
                            padding: "10px 12px",
                            background: "#0c1523",
                            border: "1px solid #23344a",
                            borderRadius: "6px",
                            color: "#f8fafc",
                          }}
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Problem URL *</span>
                        <input
                          type="url"
                          required
                          value={addUrl}
                          onChange={(e) => setAddUrl(e.target.value)}
                          placeholder="https://leetcode.com/problems/subarray-sum-equals-k/"
                          style={{
                            padding: "10px 12px",
                            background: "#0c1523",
                            border: "1px solid #23344a",
                            borderRadius: "6px",
                            color: "#f8fafc",
                          }}
                        />
                      </label>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Difficulty</span>
                          <select
                            value={addDifficulty}
                            onChange={(e) => setAddDifficulty(e.target.value as Difficulty)}
                            style={{
                              padding: "10px 12px",
                              background: "#0c1523",
                              border: "1px solid #23344a",
                              borderRadius: "6px",
                              color: "#f8fafc",
                            }}
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </label>

                        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Platform</span>
                          <select
                            value={addPlatform}
                            onChange={(e) => setAddPlatform(e.target.value)}
                            style={{
                              padding: "10px 12px",
                              background: "#0c1523",
                              border: "1px solid #23344a",
                              borderRadius: "6px",
                              color: "#f8fafc",
                            }}
                          >
                            <option value="leetcode">LeetCode</option>
                            <option value="codeforces">Codeforces</option>
                            <option value="atcoder">AtCoder</option>
                            <option value="custom">Custom</option>
                          </select>
                        </label>
                      </div>

                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Topics (comma-separated)</span>
                        <input
                          type="text"
                          value={addTopics}
                          onChange={(e) => setAddTopics(e.target.value)}
                          placeholder="Arrays, Hash Table, Prefix Sum"
                          style={{
                            padding: "10px 12px",
                            background: "#0c1523",
                            border: "1px solid #23344a",
                            borderRadius: "6px",
                            color: "#f8fafc",
                          }}
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Frequency Score (1 to 10)</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={addFrequency}
                          onChange={(e) => setAddFrequency(Number(e.target.value))}
                          style={{
                            padding: "10px 12px",
                            background: "#0c1523",
                            border: "1px solid #23344a",
                            borderRadius: "6px",
                            color: "#f8fafc",
                            width: "100px",
                          }}
                        />
                      </label>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setShowAddModal(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={addingQuestion}
                        >
                          {addingQuestion ? "Adding..." : "Add to Question Bank"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Edit Question Modal */}
              {editingQuestion && (
                <div className="modal-backdrop">
                  <div className="modal-dialog">
                    <div className="modal-header">
                      <h3>Edit Question</h3>
                      <button
                        type="button"
                        className="modal-close"
                        onClick={() => setEditingQuestion(null)}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleEditQuestion} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Title</span>
                        <input
                          type="text"
                          required
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          style={{
                            padding: "10px 12px",
                            background: "#0c1523",
                            border: "1px solid #23344a",
                            borderRadius: "6px",
                            color: "#f8fafc",
                          }}
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>URL</span>
                        <input
                          type="url"
                          required
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          style={{
                            padding: "10px 12px",
                            background: "#0c1523",
                            border: "1px solid #23344a",
                            borderRadius: "6px",
                            color: "#f8fafc",
                          }}
                        />
                      </label>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Difficulty</span>
                          <select
                            value={editDifficulty}
                            onChange={(e) => setEditDifficulty(e.target.value as Difficulty)}
                            style={{
                              padding: "10px 12px",
                              background: "#0c1523",
                              border: "1px solid #23344a",
                              borderRadius: "6px",
                              color: "#f8fafc",
                            }}
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </label>

                        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Frequency</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={editFrequency}
                            onChange={(e) => setEditFrequency(Number(e.target.value))}
                            style={{
                              padding: "10px 12px",
                              background: "#0c1523",
                              border: "1px solid #23344a",
                              borderRadius: "6px",
                              color: "#f8fafc",
                            }}
                          />
                        </label>
                      </div>

                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Topics (comma-separated)</span>
                        <input
                          type="text"
                          value={editTopics}
                          onChange={(e) => setEditTopics(e.target.value)}
                          style={{
                            padding: "10px 12px",
                            background: "#0c1523",
                            border: "1px solid #23344a",
                            borderRadius: "6px",
                            color: "#f8fafc",
                          }}
                        />
                      </label>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setEditingQuestion(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={updatingQuestion}
                        >
                          {updatingQuestion ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}

          {activePage === "Contests" && <Contests />}

          {activePage === "Google Calendar" && <GoogleCalendar />}

          {activePage === "Learning (YouTube)" && <LearningPlanner />}

          {activePage === "Analytics" && <Analytics />}

          {activePage === "Profile" && <Profile />}

          {activePage === "Settings" && <Settings />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default App;