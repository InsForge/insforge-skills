// Pattern B — per-request InsForge client construction for server components,
// route handlers, and server actions. Use this when you don't want a long-lived
// client + refresh logic, e.g. for SSR data fetching.
import { createClient } from '@insforge/sdk';
import { auth } from './auth';
import { headers } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function createInsForgeClient() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const insforgeToken = jwt.sign(
    {
      sub: session.user.id,
      role: 'authenticated',
      aud: 'insforge-api',
    },
    process.env.INSFORGE_JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '1h' },
  );

  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
    edgeFunctionToken: insforgeToken, // sets BOTH HttpClient + TokenManager
  });
}
