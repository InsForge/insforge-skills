import { useEffect, useState } from 'react';
import { authClient } from './auth-client';
import { useInsforgeClient } from './insforge';

type Note = { id: string; user_id: string; body: string; created_at: string };

export function App() {
  const session = authClient.useSession();
  const { client, isReady } = useInsforgeClient();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!isReady) return;
    void (async () => {
      const { data } = await client.database
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });
      setNotes((data as Note[]) ?? []);
    })();
  }, [isReady, client]);

  if (session.isPending) return <p style={{ padding: 24 }}>loading…</p>;

  if (!session.data?.user) {
    return <AuthForms />;
  }

  const onAdd = async () => {
    const body = draft.trim();
    if (!body) return;
    const { data } = await client.database.from('notes').insert({ body }).select().single();
    if (data) setNotes((prev) => [data as Note, ...prev]);
    setDraft('');
  };

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Hi, {session.data.user.email}</h1>
      <p>
        BA id: <code>{session.data.user.id}</code> · framework: <strong>Vite + React</strong> ·{' '}
        <button onClick={() => authClient.signOut()}>sign out</button>
      </p>
      <hr />
      <h2>Your notes ({notes.length})</h2>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="add a note"
        data-testid="note-input"
      />
      <button onClick={onAdd} disabled={!isReady} data-testid="note-add">
        add
      </button>
      <ul>
        {notes.map((n) => (
          <li key={n.id} data-testid="note">
            {n.body}
          </li>
        ))}
      </ul>
    </main>
  );
}

function AuthForms() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const fn = mode === 'sign-up' ? authClient.signUp.email : authClient.signIn.email;
    const args =
      mode === 'sign-up' ? { email, password, name } : { email, password };
    const { error } = await fn(args);
    if (error) setErr(error.message ?? 'auth failed');
  };

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>{mode === 'sign-up' ? 'Sign up' : 'Sign in'}</h1>
      <form onSubmit={onSubmit}>
        {mode === 'sign-up' && (
          <p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" />
          </p>
        )}
        <p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            data-testid="email"
          />
        </p>
        <p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password (≥8)"
            data-testid="password"
          />
        </p>
        <p>
          <button type="submit" data-testid="submit">
            {mode === 'sign-up' ? 'create account' : 'sign in'}
          </button>
        </p>
        {err && <p style={{ color: 'red' }}>{err}</p>}
      </form>
      <p>
        <button onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}>
          {mode === 'sign-up' ? 'have an account? sign in' : 'no account? sign up'}
        </button>
      </p>
    </main>
  );
}
