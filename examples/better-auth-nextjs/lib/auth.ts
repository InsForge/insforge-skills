import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL!,
  }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,

  // ─────────────────────────────────────────────────────────────────────────
  // Optional: route BA's verification + reset emails through InsForge.
  // Enable by uncommenting and configuring SMTP via PUT /api/auth/smtp-config
  // (or use cloud-hosted InsForge where PROJECT_ID is set).
  //
  // emailAndPassword: {
  //   enabled: true,
  //   requireEmailVerification: true,
  //   sendResetPassword: async ({ user, url }) => {
  //     const c = await import('./insforge-server-mailer').then(m => m.serverMailer());
  //     const { error } = await c.emails.send({
  //       to: user.email,
  //       subject: 'Reset your password',
  //       html: `<p>Reset: <a href="${url}">${url}</a></p>`,
  //     });
  //     if (error) throw new Error(error.message);
  //   },
  // },
  // emailVerification: {
  //   sendOnSignUp: true,
  //   sendVerificationEmail: async ({ user, url }) => {
  //     const c = await import('./insforge-server-mailer').then(m => m.serverMailer());
  //     const { error } = await c.emails.send({
  //       to: user.email,
  //       subject: 'Verify your email',
  //       html: `<p>Verify: <a href="${url}">${url}</a></p>`,
  //     });
  //     if (error) throw new Error(error.message);
  //   },
  // },
});
