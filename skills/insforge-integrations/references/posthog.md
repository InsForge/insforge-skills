
# InsForge + PostHog Integration Guide

> ⚠️ **Private beta.** PostHog integration is currently being rolled out to early-access partners. The CLI installs the SDK using deterministic per-framework templates for the most common stacks (Next.js App/Pages Router, Vite + React, SvelteKit, Astro); other frameworks fall through to a manual instructions path that prints the `phc_` key for hand integration.

PostHog is integrated as a one-click OAuth connection inside InsForge: connect your PostHog account, then install the PostHog SDK into your app. Events sent from your app to PostHog appear in InsForge's Analytics view (KPI tiles, retention, web stats, session replay) with a "Open in PostHog" link for deeper analysis.

The two sides are decoupled — InsForge stores read credentials encrypted server-side so the dashboard can render analytics; your app sends events directly to PostHog using the public `phc_` ingestion key. They share a single PostHog project so the data lines up.

## Recommended Workflow (CLI, one command)

```bash
cd /path/to/your/app
npx @insforge/cli link --project-id <insforge-project-id>   # if not already linked
npx @insforge/cli posthog setup                             # one shot: connect + install SDK
```

What the CLI does in order:
1. Reads `.insforge/project.json` from the current directory to find your InsForge project ID
2. Calls cloud-backend `/integrations/posthog/v1/cli-start`. Two outcomes:
   - **New PostHog account** (your InsForge email isn't yet in PostHog): an account + project are auto-provisioned, no browser hop. PostHog sends a welcome email so you can later set a password and log in to PostHog directly
   - **Existing PostHog account**: the CLI prints a URL and opens the browser to PostHog's consent page; after you click Authorize, the CLI's polling picks up the connection
3. Calls cloud-backend `/integrations/posthog/v1/connection` to fetch the `phc_` ingestion key and PostHog host
4. Detects the project's framework from `package.json` + filesystem layout. Supported: Next.js App Router, Next.js Pages Router, Vite + React, SvelteKit, Astro
5. Installs `posthog-js` via the project's package manager (npm / yarn / pnpm / bun, auto-detected)
6. Renders the per-framework template into the right entry file:
   - **Next.js App Router**: writes `app/posthog-provider.tsx` (or `src/app/...`); emits a printable note instructing the caller to wrap `<body>{children}</body>` in `app/layout.tsx` with `<PostHogProvider>` (left as a manual or agent-applied step because layout files vary too much to safely auto-edit)
   - **Next.js Pages Router**: writes `pages/_app.tsx` if missing; emits a note if the file already exists
   - **Vite + React**: emits a snippet to add to `src/main.tsx` (variants too high to auto-edit)
   - **SvelteKit**: writes `src/hooks.client.ts` if missing; emits a note if it exists
   - **Astro**: writes `src/lib/posthog.ts` and emits a note instructing the caller to import it from a layout `<script>` tag
7. Writes the framework-appropriate env vars to `.env` (or `.env.local` for Next.js): `*_POSTHOG_KEY` and `*_POSTHOG_HOST`

## Verify events are flowing

After install, send a test event to confirm the connection works end-to-end:

```bash
curl -X POST https://us.i.posthog.com/i/v0/e/ \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "phc_...",
    "event": "$pageview",
    "distinct_id": "test_user_1",
    "properties": { "$current_url": "https://example.com" }
  }'
```

Returns `{"status": 1}` on success. The InsForge Analytics dashboard updates within a minute.

## Environment variables

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_POSTHOG_KEY` (or framework equivalent) | InsForge → Analytics → API Key card (`phc_...`) |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.posthog.com` (US) or `https://eu.posthog.com` (EU) — shown next to the key |

The CLI writes both automatically.

## PostHog plan notes

- **Free plan**: one PostHog project per account. If you connect multiple InsForge projects to the same PostHog account, they all share that single project — events from different InsForge projects get mixed together
- **Paid plans**: up to 6 projects. The CLI auto-provisions a fresh PostHog project each time you connect a new InsForge project

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| InsForge Analytics shows zero events even after install | Verify the `phc_` value in your app's `.env` matches the one on InsForge → Analytics → API Key card. Different keys = different projects |
| Embedding `phx_` (personal API key) in client code | Use only `phc_` in client code. `phx_` is sensitive and InsForge handles it server-side |
| Framework not auto-detected (Bun, Deno, Solid, custom setups) | The CLI prints the `phc_` key + host and a link to PostHog's docs for that framework — install posthog-js manually following PostHog's guide |
| Next.js App Router setup leaves PostHog "uninitialised" at runtime | The CLI writes `posthog-provider.tsx` but does **not** auto-edit `app/layout.tsx`. Wrap `<body>{children}</body>` with `<PostHogProvider>` from the printed note, or have your AI coding agent apply the change |
| Running `insforge posthog setup` outside the linked project directory | The CLI reads `.insforge/project.json` from cwd. Run it from the project root after `insforge link --project-id <id>` |
