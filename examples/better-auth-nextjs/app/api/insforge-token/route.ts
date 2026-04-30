import { auth } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}.`);
  }
  return value;
}

// Reads the Better Auth session from the cookie, signs an HS256 JWT
// with the InsForge JWT secret, returns it. ~20 lines.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }
  // Mint the smallest claim set InsForge needs. Don't add email or other
  // PII — RLS reads sub via auth.jwt() ->> 'sub' and that's all that matters.
  const token = jwt.sign(
    {
      sub: session.user.id,
      role: 'authenticated',
      aud: 'insforge-api',
    },
    requireEnv('INSFORGE_JWT_SECRET'),
    { algorithm: 'HS256', expiresIn: '1h' },
  );
  // no-store: bridge tokens are short-lived and per-session — never cache.
  return NextResponse.json(
    { token },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
