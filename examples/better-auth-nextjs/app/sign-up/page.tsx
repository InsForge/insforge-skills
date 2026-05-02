'use client';
import { authClient } from '@/lib/auth-client';
import { useState } from 'react';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await authClient.signUp.email({ email, password, name });
      if (error) {
        setErr(error.message ?? 'sign-up failed');
        return;
      }
      if (data?.user) window.location.href = '/';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'sign-up failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell" style={{ maxWidth: 420 }}>
      <div className="card" style={{ padding: 28 }}>
        <h1 style={{ marginTop: 0 }}>Create account</h1>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="name" style={{ fontSize: 12, color: 'var(--muted)' }}>Name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
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
            <label htmlFor="password" style={{ fontSize: 12, color: 'var(--muted)' }}>Password (8 chars min)</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'creating…' : 'create account'}
          </button>
          {err && <p style={{ color: 'var(--danger)', marginTop: 12, fontSize: 12 }}>{err}</p>}
        </form>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
          Already have an account? <a href="/sign-in">Sign in</a>
        </p>
      </div>
    </main>
  );
}
