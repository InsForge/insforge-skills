'use client';

import { createClient, type InsForgeClient } from '@insforge/sdk';
import { authClient } from './auth-client';
import { useEffect, useMemo, useState } from 'react';

const REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 min for the 1h bridge JWT

// Pattern A — long-lived InsForge client + imperative refresh from the BA session.
// Fetches /api/insforge-token (same-origin, BA cookie auto-attached), pipes the
// resulting HS256 JWT into the SDK's HttpClient + TokenManager so that database
// AND realtime both see the bridged identity. Mirrors the existing Clerk integration.
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
      setBridgeToken(client, null);
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
        setBridgeToken(client, token);
        setIsReady(true);
      } catch {
        if (cancelled) return;
        setBridgeToken(client, null);
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

// Sets the JWT on BOTH the HTTP client (for database/storage/functions/AI/emails)
// AND the realtime TokenManager (for the WebSocket auth handshake).
// The SDK's setAuthToken only updates HTTP; realtime reads from TokenManager.
// tokenManager is `private` in TS but accessible at runtime.
function setBridgeToken(client: InsForgeClient, token: string | null) {
  client.getHttpClient().setAuthToken(token);
  // @ts-expect-error: tokenManager is private at compile-time, accessible at runtime
  client.realtime.tokenManager.setAccessToken(token);
}
