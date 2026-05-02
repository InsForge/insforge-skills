'use client';

import { authClient } from '@/lib/auth-client';
import { useInsforgeClient } from '@/lib/insforge';
import { useEffect, useMemo, useState } from 'react';

type Note = { id: string; user_id: string; body: string; created_at: string };

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  const { client, isReady } = useInsforgeClient();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await client.database
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) setError(error.message);
      else setNotes((data as Note[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, client]);

  const stats = useMemo(() => {
    const total = notes.length;
    const latest = notes[0]?.created_at ?? null;
    const days = new Set(notes.map((n) => n.created_at.slice(0, 10))).size;
    return { total, latest, days };
  }, [notes]);

  if (isPending) {
    return (
      <main className="shell">
        <p>loading…</p>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="shell">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h2 style={{ marginTop: 0 }}>Better Auth + InsForge</h2>
          <p style={{ color: 'var(--muted)' }}>You're signed out.</p>
          <p>
            <a href="/sign-in">Sign in</a> · <a href="/sign-up">Create an account</a>
          </p>
        </div>
      </main>
    );
  }

  const onAdd = async () => {
    const body = draft.trim();
    if (!body) return;
    const { data, error } = await client.database
      .from('notes')
      .insert({ body })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setNotes((prev) => [data as Note, ...prev]);
    setDraft('');
  };

  const onDelete = async (id: string) => {
    const prev = notes;
    setNotes((p) => p.filter((n) => n.id !== id));
    const { error } = await client.database.from('notes').delete().eq('id', id);
    if (error) {
      setError(error.message);
      setNotes(prev);
    }
  };

  const onStartEdit = (n: Note) => {
    setEditingId(n.id);
    setEditDraft(n.body);
  };

  const onSaveEdit = async () => {
    if (!editingId) return;
    const body = editDraft.trim();
    if (!body) {
      setEditingId(null);
      return;
    }
    const { data, error } = await client.database
      .from('notes')
      .update({ body })
      .eq('id', editingId)
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      setNotes((prev) => prev.map((n) => (n.id === editingId ? (data as Note) : n)));
    }
    setEditingId(null);
    setEditDraft('');
  };

  const onSignOut = async () => {
    await authClient.signOut();
  };

  const initial = (session.user.name || session.user.email || '?').slice(0, 1).toUpperCase();

  return (
    <main className="shell">
      <div className="topbar">
        <h1>Dashboard</h1>
        <div className="meta">
          <span className={`ready-dot ${isReady ? '' : 'off'}`} />
          {isReady ? 'InsForge bridged' : 'connecting…'}
          <span style={{ margin: '0 10px' }}>·</span>
          <button className="secondary" onClick={onSignOut}>
            sign out
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Profile</h3>
          <div className="profile">
            <div className="avatar">{initial}</div>
            <div>
              <div className="name">{session.user.name || session.user.email}</div>
              <div className="id">
                <code>{session.user.id}</code>
              </div>
            </div>
          </div>
          <div className="sub" style={{ marginTop: 10 }}>
            {session.user.email}
          </div>
        </div>

        <div className="card">
          <h3>Notes</h3>
          <div className="stat">{stats.total}</div>
          <div className="sub">total in your account</div>
        </div>

        <div className="card">
          <h3>Last activity</h3>
          <div className="stat" style={{ fontSize: 18 }}>
            {stats.latest ? relTime(stats.latest) : '—'}
          </div>
          <div className="sub">{stats.days} day{stats.days === 1 ? '' : 's'} active</div>
        </div>
      </div>

      <div className="notes">
        <header>
          <h2>Your notes</h2>
          <span className="count">{notes.length} item{notes.length === 1 ? '' : 's'} (RLS-scoped)</span>
        </header>

        <div className="composer">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onAdd();
            }}
          />
          <button onClick={() => void onAdd()} disabled={!isReady || !draft.trim()}>
            add
          </button>
        </div>

        {error && (
          <div
            style={{
              color: 'var(--danger)',
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            {error} <button className="secondary" onClick={() => setError(null)}>dismiss</button>
          </div>
        )}

        {notes.length === 0 ? (
          <div className="empty">No notes yet. Add one above to see RLS in action.</div>
        ) : (
          <div>
            {notes.map((n) => (
              <div key={n.id} className="note">
                <div className="body">
                  {editingId === n.id ? (
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void onSaveEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                  ) : (
                    n.body
                  )}
                  <div className="when">{relTime(n.created_at)}</div>
                </div>
                <div className="actions">
                  {editingId === n.id ? (
                    <>
                      <button onClick={() => void onSaveEdit()}>save</button>
                      <button className="secondary" onClick={() => setEditingId(null)}>
                        cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="secondary" onClick={() => onStartEdit(n)}>
                        edit
                      </button>
                      <button className="danger" onClick={() => void onDelete(n.id)}>
                        delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
