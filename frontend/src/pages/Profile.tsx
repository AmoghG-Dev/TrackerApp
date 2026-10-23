import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Briefcase,
  Check,
  Code2,
  ExternalLink,
  Globe,
  Link2,
  Save,
  UserCheck,
} from "lucide-react";
import {
  getUserProfile,
  updateUserProfile,
  type UserProfile,
} from "../services/profileApi";
import { getUserPlatforms, type UserPlatform } from "../services/platformsApi";

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [platforms, setPlatforms] = useState<UserPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetCompanies, setTargetCompanies] = useState("");
  const [primaryLanguage, setPrimaryLanguage] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [profileData, platformsData] = await Promise.all([
          getUserProfile(),
          getUserPlatforms(),
        ]);
        if (!cancelled) {
          setProfile(profileData);
          setPlatforms(platformsData);
          setName(profileData.name || "");
          setBio(profileData.bio || "");
          setTargetRole(profileData.target_role || "");
          setTargetCompanies(
            (profileData.target_companies || []).join(", "),
          );
          setPrimaryLanguage(profileData.primary_language || "");
          setGithubUsername(profileData.github_username || "");
          setLinkedinUrl(profileData.linkedin_url || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load profile.",
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const companies = targetCompanies
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await updateUserProfile({
        name,
        bio,
        target_role: targetRole,
        target_companies: companies,
        primary_language: primaryLanguage,
        github_username: githubUsername,
        linkedin_url: linkedinUrl,
      });

      setProfile(updated);
      setMessage("Profile saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="panel" style={{ padding: "40px", textAlign: "center" }}>
        <p style={{ color: "#94a3b8" }}>Loading profile details...</p>
      </div>
    );
  }

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">USER PROFILE</div>
          <h1>
            Profile<span className="blue-period">.</span>
          </h1>
          <p className="subtitle">
            Manage your personal bio, career goals, programming stack, and public handles.
          </p>
        </div>
        <span className="local-badge">
          {profile?.provider === "google" ? "Google Account" : "Standard Account"}
        </span>
      </section>

      {message && (
        <div className="google-calendar-alert success" role="status" style={{ marginBottom: "16px" }}>
          <Check size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="google-calendar-alert error" role="alert" style={{ marginBottom: "16px" }}>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <section className="dashboard-grid">
          {/* Personal Information */}
          <div className="panel question-panel">
            <div className="panel-heading">
              <div>
                <h2>Personal Details</h2>
                <p>Your identity and contact info</p>
              </div>
              <UserCheck size={20} className="muted-icon" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
              <label className="learning-form label" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Full Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amogh Gupta"
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
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Email Address</span>
                <input
                  type="email"
                  disabled
                  value={profile?.email || ""}
                  style={{
                    padding: "10px 12px",
                    background: "#09101a",
                    border: "1px solid #1c293a",
                    borderRadius: "6px",
                    color: "#64748b",
                    cursor: "not-allowed",
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Bio & Summary</span>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about your learning goals and tech interests..."
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    resize: "vertical",
                    fontSize: "13px",
                  }}
                />
              </label>
            </div>
          </div>

          {/* Goals & Focus */}
          <div className="panel progress-panel">
            <div className="panel-heading">
              <div>
                <h2>Career Goals & Stack</h2>
                <p>Targets and primary languages</p>
              </div>
              <Briefcase size={20} className="muted-icon" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Target Role</span>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. AI/ML Engineer, Backend Engineer"
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
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Target Companies (comma-separated)</span>
                <input
                  type="text"
                  value={targetCompanies}
                  onChange={(e) => setTargetCompanies(e.target.value)}
                  placeholder="Google, Microsoft, Meta, Amazon"
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
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>Primary Programming Language</span>
                <select
                  value={primaryLanguage}
                  onChange={(e) => setPrimaryLanguage(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    background: "#0c1523",
                    border: "1px solid #23344a",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                >
                  <option value="Python">Python</option>
                  <option value="C++">C++</option>
                  <option value="Java">Java</option>
                  <option value="TypeScript">TypeScript / JavaScript</option>
                  <option value="Go">Go</option>
                  <option value="Rust">Rust</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        {/* Public Links & Connected Platforms */}
        <section className="panel" style={{ marginTop: "20px" }}>
          <div className="panel-heading">
            <div>
              <h2>Public Profiles & Connected Platforms</h2>
              <p>Social links and verified competitive coding handles</p>
            </div>
            <Code2 size={20} className="muted-icon" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                <Globe size={15} /> GitHub Username
              </span>
              <input
                type="text"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                placeholder="e.g. AmoghG-Dev"
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
              <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                <Link2 size={15} /> LinkedIn Profile URL
              </span>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
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

          {/* Connected Handles from Coding Platforms */}
          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #1f2b3d" }}>
            <h3 style={{ fontSize: "13px", color: "#e2e8f0", marginBottom: "8px" }}>
              Active Coding Platforms ({platforms.length})
            </h3>
            {platforms.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "12px" }}>
                No platform accounts linked yet. Go to Settings or Contests to add LeetCode, Codeforces, etc.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {platforms.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: "#0d1a2d",
                      border: "1px solid #263852",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: p.status === "active" ? "#4adea0" : "#f87171",
                      }}
                    />
                    <div>
                      <strong style={{ color: "#f1f5f9", fontSize: "12px", display: "block" }}>{p.name}</strong>
                      <span style={{ color: "#94a3b8", fontSize: "11px" }}>@{p.handle}</span>
                    </div>
                    {p.website && (
                      <a
                        href={p.website}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#38bdf8", marginLeft: "4px" }}
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: "24px" }}>
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <Save size={16} />
              {saving ? "Saving profile..." : "Save Profile"}
            </button>
          </div>
        </section>
      </form>
    </>
  );
}
