'use client';

import { authClient } from '@/lib/auth-client';
import { useInsforgeClient } from '@/lib/insforge';
import { useEffect, useState } from 'react';

type Note = { id: string; user_id: string; body: string; created_at: string };

export default function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  const { client, isReady } = useInsforgeClient();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!isReady) return;
    void (async () => {
      const { data } = await client.database.from('notes').select('*').order('created_at', { ascending: false });
      setNotes((data as Note[]) ?? []);
    })();
  }, [isReady, client]);

  if (isPending) return <p>loading…</p>;
  if (!session?.user) {
    return (
      <main style={{ padding: 24 }}>
        <p>Not signed in.</p>
        <a href="/sign-in">Sign in</a> · <a href="/sign-up">Sign up</a>
      </main>
    );
  }

  const onAdd = async () => {
    const body = draft.trim();
    if (!body) return;
    const { data } = await client.database.from('notes').insert({ body }).select().single();
    if (data) setNotes((prev) => [data as Note, ...prev]);
    setDraft('');
  };

  const onSignOut = async () => {
    await authClient.signOut();
    // useInsforgeClient's effect clears the bridged token automatically when session.data.user goes away.
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Hi, {session.user.email}</h1>
      <p>
        BA id: <code>{session.user.id}</code> · <button onClick={onSignOut}>sign out</button>
      </p>
      <hr />
      <h2>Your notes ({notes.length})</h2>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="add a note" />
      <button onClick={onAdd} disabled={!isReady}>add</button>
      <ul>
        {notes.map((n) => (
          <li key={n.id}>{n.body}</li>
        ))}
      </ul>
    </main>
  );
}
