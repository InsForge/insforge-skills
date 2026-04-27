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
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) {
      setErr(error.message ?? 'sign-in failed');
      return;
    }
    if (data?.user) window.location.href = '/';
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <p><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" /></p>
        <p><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" /></p>
        <p><button type="submit">sign in</button></p>
        {err && <p style={{ color: 'red' }}>{err}</p>}
      </form>
      <p>No account? <a href="/sign-up">Create one</a></p>
    </main>
  );
}
