import { useState, type FormEvent, type ReactNode } from "react";
import { useSpacetime } from "../hooks/useSpacetime";

interface Props {
  children: ReactNode;
}

export function LoginGate({ children }: Props) {
  const { connection, currentAdmin, currentPublisher, dataReady } = useSpacetime();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!dataReady) {
    return <div className="loading">Connecting to site-feed...</div>;
  }

  if (currentAdmin) {
    return <>{children}</>;
  }

  // One account system: publishers can log in, but /admin/ is for admins only.
  if (currentPublisher) {
    return (
      <div className="username-gate">
        <div className="username-gate-card">
          <h1>Admins only</h1>
          <p><strong>{currentPublisher}</strong> is a publisher account. Publishers write at the web serial publisher page.</p>
          <div className="form-actions">
            <a className="btn-primary" href="/publisher/">Go to /publisher/</a>
            <button className="secondary" onClick={() => connection?.reducers.logout({})}>Log out</button>
          </div>
        </div>
      </div>
    );
  }

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = username.trim();
    if (!trimmed) {
      setError("Username is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }

    if (connection) {
      connection.reducers.login({ username: trimmed, password });
    }
  };

  return (
    <div className="username-gate">
      <div className="username-gate-card">
        <h1>Site Feed Admin</h1>
        <p>Log in to publish updates to the GREM Studio homepage</p>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            maxLength={32}
            autoFocus
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <button type="submit">Login</button>
        </form>
        {error && <p className="error">{error}</p>}
        <div className="info-box">
          <p><strong>No account?</strong> Admin accounts are created by the server operator with <code>scripts/add-admin.mjs</code>. Publisher accounts are created by an admin.</p>
        </div>
      </div>
    </div>
  );
}
