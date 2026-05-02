
# InsForge + PostHog Integration Guide

> ⚠️ **Private beta.** PostHog integration is currently being rolled out to early-access partners. Connecting InsForge to PostHog and rendering analytics in the InsForge dashboard works end-to-end. The CLI's automated SDK install step (`@posthog/wizard`) requires a PostHog-side scope (`llm_gateway:read`) that is not yet provisioned for our partner integration — until that lands, the SDK install step may fail with `Authentication failed (401)`. The connection itself still succeeds; users can install the SDK by following PostHog's own docs and copying the `phc_` value from the InsForge Analytics dashboard.

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
2. Calls cloud-backend `/integrations/posthog/cli-start`. Two outcomes:
   - **New PostHog account** (your InsForge email isn't yet in PostHog): an account + project are auto-provisioned, no browser hop. PostHog sends a welcome email so you can later set a password and log in to PostHog directly
   - **Existing PostHog account**: the CLI prints a URL and opens the browser to PostHog's consent page; after you click Authorize, the CLI's polling picks up the connection
3. Calls cloud-backend `/integrations/posthog/cli-credentials` to fetch the `phc_` ingestion key, the PostHog project ID, and region
4. Spawns `npx -y @posthog/wizard@latest --ci --api-key <phx_> --project-id <id> --region <region> --install-dir .` which detects the framework, installs the SDK package, writes init code, and updates `.env`

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

The CLI / wizard writes both automatically.

## PostHog plan notes

- **Free plan**: one PostHog project per account. If you connect multiple InsForge projects to the same PostHog account, they all share that single project — events from different InsForge projects get mixed together
- **Paid plans**: up to 6 projects. The CLI auto-provisions a fresh PostHog project each time you connect a new InsForge project

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| InsForge Analytics shows zero events even after install | Verify the `phc_` value in your app's `.env` matches the one on InsForge → Analytics → API Key card. Different keys = different projects |
| Wizard step fails with `Authentication failed (401)` | Currently expected during private beta (PostHog scope provisioning issue). The connection itself succeeded — install the SDK by following PostHog's own docs and copying the `phc_` value from InsForge → Analytics → API Key card |
| Embedding `phx_` (personal API key) in client code | Use only `phc_` in client code. `phx_` is sensitive and InsForge handles it server-side |
| Running `insforge posthog setup` outside the linked project directory | The CLI reads `.insforge/project.json` from cwd. Run it from the project root after `insforge link --project-id <id>` |
