'use client';

import { createClient, type InsForgeClient } from '@insforge/sdk';
import { authClient } from './auth-client';
import { useEffect, useMemo, useState } from 'react';

const REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 min for the 1h bridge JWT

// Pattern A — long-lived InsForge client + imperative refresh from the BA session.
// Fetches /api/insforge-token (same-origin, BA cookie auto-attached), pipes the
// resulting HS256 JWT into the SDK via client.setAccessToken — which updates
// HTTP (database/storage/functions/AI/emails) and realtime (WebSocket auth)
// in one call. Mirrors the existing Clerk integration.
export function useInsforgeClient(): { client: InsForgeClient; isReady: boolean } {
  const session = authClient.useSession();
  const [isReady, setIsReady] = useState(false);

  const client = useMemo(
    () =>
      createClient({
        baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
        anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
        autoRefreshToken: false,
      }),
    [],
  );

  useEffect(() => {
    if (!session.data?.user) {
      client.setAccessToken(null);
      setIsReady(false);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch('/api/insforge-token', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`bridge ${res.status}`);
        const { token } = (await res.json()) as { token: string };
        if (cancelled) return;
        client.setAccessToken(token);
        setIsReady(true);
      } catch {
        if (cancelled) return;
        client.setAccessToken(null);
        setIsReady(false);
      }
    };

    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, session.data?.user]);

  return { client, isReady };
}
