# npx @insforge/cli posthog setup

One-shot command that ensures the InsForge dashboard has a PostHog connection, then runs the official PostHog setup wizard to wire PostHog into the app code.

## Availability

PostHog integration is in private beta. If `cli-start` returns `PostHog connect flow unavailable (HTTP 404)`, this project doesn't have PostHog enabled yet — wait for the rollout or ask the InsForge team for early access. Self-hosted backends don't currently expose `/integrations/posthog/v1/*` and this command won't work there; users on self-hosted should install PostHog directly per [PostHog's docs](https://posthog.com/docs/libraries).

## Usage

```bash
cd /path/to/your/app
npx @insforge/cli link --project-id <insforge-project-id>   # if not already linked
npx @insforge/cli posthog setup
```

| Flag | Description |
|------|-------------|
| `--skip-browser` | Don't auto-open the browser for InsForge's OAuth step; only print the URL (useful for headless / SSH sessions). Does **not** affect the wizard, which always opens a browser. |

Inherited global flags (e.g. `--json`, `--api-url`) work too — see the main CLI skill.

## What the CLI does in order

1. Reads `.insforge/project.json` from the current directory to find your InsForge project ID
2. Calls cloud-backend `/integrations/posthog/v1/cli-start`. Two outcomes:
   - **Already connected**: dashboard already has a PostHog connection → skip OAuth, go straight to step 4
   - **Not connected**: cloud-backend returns an authorize URL. CLI opens it in the browser (unless `--skip-browser`) and polls `/connection` until the dashboard receives the OAuth callback
3. (If step 2 needed OAuth) Confirms the InsForge dashboard now has a PostHog connection
4. Spawns `npx -y @posthog/wizard@latest` with stdio inherited. The wizard:
   - Opens its own browser for PostHog OAuth (this is independent of step 2)
   - Lets the user pick a PostHog project
   - Detects the app's framework, installs the SDK, writes env vars, and adds the SDK init / provider code
5. After the wizard exits cleanly, prints a "Open Analytics in your dashboard" outro

## Two OAuths, briefly explained

The command does two OAuths in sequence, both targeting PostHog but for different consumers:

| Step | What it sets up | What it writes |
|------|-----------------|----------------|
| 2 — InsForge cli-start | Server-side connection so the InsForge dashboard Analytics page can query PostHog on the user's behalf | `posthog_connections` row in cloud-backend |
| 4 — `@posthog/wizard` | Client-side instrumentation so events flow from the app to PostHog | Env vars + SDK init in the app code |

Practically the user signs in with the same PostHog account both times and ends up on the same PostHog project. The CLI doesn't try to deduplicate — the wizard's OAuth is the source of truth for which project the app sends events to.

## Web Analytics ingestion delay

PostHog's `sessions` materialized view (which powers Web Analytics queries) has multi-hour ingestion lag for new projects. Events show in PostHog's Activity page within seconds, but `visitors / views / sessions` on Web Analytics and the InsForge Analytics page can return 0 for the first 24h. This is not a CLI bug — wait it out.

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Running `npx @insforge/cli posthog setup` outside the linked project directory | The CLI reads `.insforge/project.json` from cwd. Run it from the project root after `npx @insforge/cli link --project-id <id>` |
| Headless environment, browser doesn't open for the InsForge OAuth step | Pass `--skip-browser` and copy the printed URL onto a machine with a browser. The wizard step also needs a browser — run the whole command on a workstation, not headless. |
| Wizard exits non-zero | The CLI surfaces the wizard's exit code in the error message. Re-run; if it keeps failing, file an issue with `@posthog/wizard`. |
