'use client';
import { authClient } from '@/lib/auth-client';
import { useState } from 'react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) {
        setErr(error.message ?? 'sign-in failed');
        return;
      }
      if (data?.user) window.location.href = '/';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'sign-in failed');
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <p>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </p>
        <p>
          <label htmlFor="password">Password</label>
          <br />
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </p>
        <p><button type="submit">sign in</button></p>
        {err && <p style={{ color: 'red' }}>{err}</p>}
      </form>
      <p>No account? <a href="/sign-up">Create one</a></p>
    </main>
  );
}
