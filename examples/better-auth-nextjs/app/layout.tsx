import type { ReactNode } from 'react';

export const metadata = { title: 'Better Auth + InsForge — Dashboard' };

const css = `
:root {
  --bg: #0b0d12;
  --panel: #12151c;
  --panel-2: #181c25;
  --line: #232836;
  --text: #e6e8ee;
  --muted: #8a93a6;
  --accent: #7c8cff;
  --accent-2: #5fcf7e;
  --danger: #ff6b6b;
  --radius: 10px;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: var(--bg); color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 14px; line-height: 1.45;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: var(--muted); }
button {
  background: var(--accent); color: #0b0d12;
  border: 0; padding: 6px 12px; border-radius: 6px;
  font-weight: 600; cursor: pointer; font: inherit;
}
button:hover { filter: brightness(1.1); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.secondary { background: var(--panel-2); color: var(--text); border: 1px solid var(--line); }
button.danger { background: transparent; color: var(--danger); border: 1px solid var(--line); }
input, textarea {
  background: var(--panel-2); color: var(--text);
  border: 1px solid var(--line); border-radius: 6px;
  padding: 8px 10px; font: inherit; width: 100%;
}
input:focus, textarea:focus { outline: 2px solid var(--accent); border-color: transparent; }
.shell { max-width: 980px; margin: 0 auto; padding: 32px 24px 80px; }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.topbar h1 { font-size: 18px; margin: 0; font-weight: 600; }
.topbar .meta { color: var(--muted); font-size: 12px; }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
@media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
.card h3 { margin: 0 0 8px; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.card .stat { font-size: 28px; font-weight: 600; }
.card .sub { color: var(--muted); font-size: 12px; margin-top: 4px; }
.profile { display: flex; align-items: center; gap: 12px; }
.avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  display: flex; align-items: center; justify-content: center;
  color: #0b0d12; font-weight: 700;
}
.profile .name { font-weight: 600; }
.profile .id { color: var(--muted); font-size: 11px; }
.notes { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
.notes header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.notes h2 { margin: 0; font-size: 16px; }
.notes .count { color: var(--muted); font-size: 12px; }
.composer { display: flex; gap: 8px; margin-bottom: 12px; }
.composer input { flex: 1; }
.note { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
.note:first-child { border-top: 0; }
.note .body { flex: 1; word-break: break-word; }
.note .when { color: var(--muted); font-size: 11px; margin-top: 4px; }
.note .actions { display: flex; gap: 6px; }
.empty { color: var(--muted); padding: 24px 0; text-align: center; }
.ready-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent-2); margin-right: 6px;
  box-shadow: 0 0 8px var(--accent-2);
}
.ready-dot.off { background: var(--muted); box-shadow: none; }
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
