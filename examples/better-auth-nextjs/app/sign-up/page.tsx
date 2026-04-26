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
    const { data, error } = await authClient.signUp.email({ email, password, name });
    if (error) {
      setErr(error.message ?? 'sign-up failed');
      return;
    }
    if (data?.user) window.location.href = '/';
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Sign up</h1>
      <form onSubmit={onSubmit}>
        <p><input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" /></p>
        <p><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" /></p>
        <p><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password (≥8)" /></p>
        <p><button type="submit">create account</button></p>
        {err && <p style={{ color: 'red' }}>{err}</p>}
      </form>
      <p>Already have an account? <a href="/sign-in">Sign in</a></p>
    </main>
  );
}
