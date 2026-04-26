import { auth } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

// Reads the Better Auth session from the cookie, signs an HS256 JWT
// with the InsForge JWT secret, returns it. ~20 lines.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }
  const token = jwt.sign(
    {
      sub: session.user.id,
      role: 'authenticated',
      aud: 'insforge-api',
      email: session.user.email,
    },
    process.env.INSFORGE_JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
  return NextResponse.json({ token });
}
