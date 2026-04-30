'use client';
import { authClient } from '@/lib/auth-client';
import { useState } from 'react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) {
        setErr(error.message ?? 'sign-in failed');
        return;
      }
      if (data?.user) window.location.href = '/';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell" style={{ maxWidth: 420 }}>
      <div className="card" style={{ padding: 28 }}>
        <h1 style={{ marginTop: 0 }}>Sign in</h1>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="email" style={{ fontSize: 12, color: 'var(--muted)' }}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="password" style={{ fontSize: 12, color: 'var(--muted)' }}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'signing in…' : 'sign in'}
          </button>
          {err && <p style={{ color: 'var(--danger)', marginTop: 12, fontSize: 12 }}>{err}</p>}
        </form>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
          No account? <a href="/sign-up">Create one</a>
        </p>
      </div>
    </main>
  );
}
