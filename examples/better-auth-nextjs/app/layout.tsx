import type { ReactNode } from 'react';

export const metadata = { title: 'Better Auth + InsForge' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '40px auto' }}>
        {children}
      </body>
    </html>
  );
}
