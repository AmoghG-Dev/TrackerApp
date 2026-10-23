
import { useState, type FormEvent } from "react";
import {
  Lock,
  Mail,
  UserPlus,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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
        err instanceof Error
          ? err.message
          : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setShowPassword(false);
  }

  return (
    <main className="login-page">
      <section
        className="login-card"
        aria-label="TrackerApp authentication"
      >
        
<header className="login-brand">
  <div className="login-brand-icon" role="img" aria-label="TrackerApp logo" />

  <h1 className="login-brand-title">
    <span className="brand-tracker">Tracker</span>
    <span className="brand-app">App</span>
  </h1>

  <p className="login-brand-tagline">
    Track. Learn. Improve.
  </p>
</header>


        <div className="login-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => changeMode("login")}
          >
            Sign in
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => changeMode("register")}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="auth-email">Email address</label>

            <div className="login-input">
              <Mail
                size={17}
                className="input-icon"
                aria-hidden="true"
              />

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
          </div>

          <div className="login-field">
            <label htmlFor="auth-password">Password</label>

            <div className="login-input">
              <Lock
                size={17}
                className="input-icon"
                aria-hidden="true"
              />

              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </div>
          </div>

          {mode === "login" && (
            <div className="forgot-password-wrapper">
              <a href="#forgot" className="forgot-password-link">
                Forgot password?
              </a>
            </div>
          )}

          {mode === "register" && (
            <div className="login-field invitation-field">
              <label htmlFor="invitation-code">Invitation code</label>

              <div className="login-input">
                <UserPlus
                  size={17}
                  className="input-icon"
                  aria-hidden="true"
                />

                <input
                  id="invitation-code"
                  type="text"
                  autoComplete="off"
                  value={invitationCode}
                  onChange={(event) =>
                    setInvitationCode(event.target.value)
                  }
                  placeholder="Enter your invitation code"
                  required
                />
              </div>
            </div>
          )}

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="login-submit"
            type="submit"
            disabled={busy}
          >
            <span>
              {busy
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </span>

            {!busy && <ArrowRight size={17} />}
          </button>
        </form>

        <div className="login-divider" aria-hidden="true">
          <span>or</span>
        </div>

        <button
          className="google-login-button"
          type="button"
          disabled={busy}
          onClick={() =>
            startGoogleLogin(
              mode === "register"
                ? invitationCode.trim()
                : undefined,
            )
          }
        >
          <svg
            className="google-icon"
            viewBox="0 0 24 24"
            width="17"
            height="17"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>

          <span>Continue with Google</span>
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
