import { createAuthClient } from 'better-auth/react';

// Same-origin: BA routes are reachable at /api/auth/* via the Vite dev proxy
// (vite.config.ts → http://localhost:3030). To the browser, this looks like
// the Vite origin, so BA's session cookie is attached without any
// sameSite/secure/CORS dance.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL,
});
