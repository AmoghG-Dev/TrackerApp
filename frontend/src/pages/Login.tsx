
import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail, UserPlus } from "lucide-react";
import {
  login,
  register,
  startGoogleLogin,
  type AuthUser,
} from "../services/authApi";
import "./Login.css";

type LoginProps = {
  onLogin: (user: AuthUser) => void;
};

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const result =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(
              email.trim(),
              password,
              invitationCode.trim(),
            );

      onLogin(result.user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <LockKeyhole size={24} />
          </div>
          <h1>TrackerApp</h1>
          <p>Your personal learning and coding tracker.</p>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email address</label>
          <div className="login-input">
            <Mail size={18} />
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            required
          />

          {mode === "register" && (
            <>
              <label htmlFor="invitation-code">Invitation code</label>
              <div className="login-input">
                <UserPlus size={18} />
                <input
                  id="invitation-code"
                  value={invitationCode}
                  onChange={(event) =>
                    setInvitationCode(event.target.value)
                  }
                  placeholder="Enter your invitation code"
                  required
                />
              </div>
            </>
          )}

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button className="login-submit" type="submit" disabled={busy}>
            {busy
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button
          className="google-login-button"
          type="button"
          disabled={busy}
          onClick={() => startGoogleLogin(
            mode === "register" ? invitationCode.trim() : undefined,
          )}
        >
          Continue with Google
        </button>

        <p className="login-footnote">
          {mode === "register"
            ? "Registration requires a valid invitation."
            : "Sign in to access your personal tracker."}
        </p>
      </section>
    </main>
  );
}
