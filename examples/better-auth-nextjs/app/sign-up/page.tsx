'use client';
import { authClient } from '@/lib/auth-client';
import { useState } from 'react';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const { data, error } = await authClient.signUp.email({ email, password, name });
      if (error) {
        setErr(error.message ?? 'sign-up failed');
        return;
      }
      if (data?.user) window.location.href = '/';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'sign-up failed');
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Sign up</h1>
      <form onSubmit={onSubmit}>
        <p>
          <label htmlFor="name">Name</label>
          <br />
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </p>
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
          <label htmlFor="password">Password (8 chars min)</label>
          <br />
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </p>
        <p><button type="submit">create account</button></p>
        {err && <p style={{ color: 'red' }}>{err}</p>}
      </form>
      <p>Already have an account? <a href="/sign-in">Sign in</a></p>
    </main>
  );
}
