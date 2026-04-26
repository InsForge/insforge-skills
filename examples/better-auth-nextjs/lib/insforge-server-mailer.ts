import { createClient } from '@insforge/sdk';
import jwt from 'jsonwebtoken';

// BA email callbacks fire server-side without an end-user session, so
// mint a short-lived "service" HS256 JWT (same secret as the bridge) and
// attach it as the bearer for client.emails.send().
export function serverMailer() {
  const token = jwt.sign(
    { sub: 'better-auth-service', role: 'authenticated', aud: 'insforge-api' },
    process.env.INSFORGE_JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '5m' },
  );
  const c = createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL! });
  c.getHttpClient().setAuthToken(token);
  return c;
}
